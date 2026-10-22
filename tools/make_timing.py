#!/usr/bin/env python3
"""Genera content/timing.json: mappa tempo -> frase -> slide per il player.

Sincronizza slide e trascrizione karaoke con l'audio TTS di ogni capitolo.

Uso:
    python3 tools/make_timing.py                  # rigenera tutti i capitoli con audio pronto
    python3 tools/make_timing.py --chapter ch3-model-dev   # rigenera/aggiunge un solo capitolo

Sorgente dei capitoli: content/chapters/<id>.json (un oggetto per file, contratto v2).
Se ogni slide ha `narration`, i salti di slide si ricavano da solo: le frasi di
ogni narrazione (split_sentences) sono assegnate alla sua slide. Senza narrazioni
(ripiego) si usa la tabella SLIDE_BREAKS, da tenere solo per i capitoli vecchi.

Contratto di output (consumato dal player, rispettarlo esattamente):
    {"version": 1, "gap_sec": 0.25,
     "chapters": {"<id>": {"audio": "audio/<id>.mp3",
                            "duration": 286.45,
                            "sentences": [{"t0": 0.0, "t1": 3.2,
                                           "slide": 0, "text": "..."}]}}}

Regole di temporizzazione (identiche alla sintesi TTS):
  - splitter frasi: re.split(r"(?<=[.!?…])\\s+", ...) + ri-split a >300ch su [,;:]
  - pausa tra frasi nel wav: GAP_SEC = 0.25s
  - speech = durata_reale - (n-1) * GAP_SEC, ripartita sulle frasi in
    proporzione ai caratteri; tempi arrotondati a 2 decimali, prima frase
    t0 = 0.0, ultima frase t1 == duration.

Mappatura frasi -> slide: dalla narrazione di ogni slide (campo `narration`).
Ripiego per i capitoli senza narrazioni: SLIDE_BREAKS, coppie
(indice_prima_frase, indice_slide) con indici slide monotoni non decrescenti.

Solo stdlib + ffprobe. Capitoli senza audio (es. ch7 prima del TTS)
vengono saltati con un warning nel run completo.
"""

import argparse
import json
import logging
import re
import subprocess
import sys
from pathlib import Path

# Directory radice del sito (tools/ si trova subito sotto).
ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
CHAPTERS_DIR = CONTENT_DIR / "chapters"
AUDIO_DIR = ROOT / "audio"
OUT_PATH = CONTENT_DIR / "timing.json"
log = logging.getLogger("make-timing")

GAP_SEC = 0.25
VERSION = 1

# RIPIEGO per i capitoli senza `narration` nelle slide: capitolo ->
# [(indice_prima_frase, indice_slide), ...]. L'ultima coppia copre tutte le frasi
# fino alla fine del capitolo. I capitoli nuovi (ch8-ch14) non la usano.
# Se lo script di un capitolo cambia (e quindi il numero di frasi),
# make_timing.py fallisce con errore esplicito: aggiornare la mappa.
SLIDE_BREAKS = {
    # ch1: 79 frasi / 6 slide
    "ch1-exam-guide": [(0, 0), (13, 1), (26, 2), (39, 3), (52, 4), (65, 5)],
    # ch2: 84 frasi / 8 slide
    "ch2-data-prep": [(0, 0), (11, 1), (21, 2), (32, 3), (42, 4), (53, 5), (63, 6), (74, 7)],
    # ch3: 89 frasi / 7 slide
    "ch3-model-dev": [(0, 0), (13, 1), (25, 2), (38, 3), (51, 4), (63, 5), (76, 6)],
    # ch4: 30 frasi / 7 slide
    "ch4-deploy": [(0, 0), (4, 1), (9, 2), (13, 3), (17, 4), (22, 5), (26, 6)],
    # ch5: 30 frasi / 7 slide
    "ch5-monitor-security": [(0, 0), (4, 1), (9, 2), (13, 3), (17, 4), (22, 5), (26, 6)],
    # ch6: 27 frasi / 6 slide
    "ch6-genai": [(0, 0), (5, 1), (9, 2), (14, 3), (18, 4), (23, 5)],
    # ch7: 46 frasi / 6 slide
    "ch7-practice": [(0, 0), (8, 1), (15, 2), (23, 3), (31, 4), (38, 5)],
    # quick-ref: 13 frasi / 5 slide
    "quick-ref": [(0, 0), (3, 1), (5, 2), (8, 3), (10, 4)],
}


def split_sentences(text):
    """Splitter IDENTICO a quello della sintesi TTS: non modificarlo."""
    parts = re.split(r"(?<=[.!?…])\s+", text.strip())
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if len(p) > 300:
            for q in re.split(r"(?<=[,;:])\s+", p):
                q = q.strip()
                if q:
                    out.append(q)
        else:
            out.append(p)
    return out


def norm_ws(text):
    """Spazi normalizzati: confronto tra copione e narrazioni."""
    return re.sub(r"\s+", " ", text).strip()


def expand_breaks(breaks, n_sentences, n_slides, chapter_id):
    """Espande le coppie (prima_frase, slide) in una slide per frase."""
    slides = []
    for i, (start, slide) in enumerate(breaks):
        end = breaks[i + 1][0] if i + 1 < len(breaks) else n_sentences
        slides.extend([slide] * (end - start))
    if len(slides) != n_sentences:
        raise ValueError(
            f"[{chapter_id}] mappa slide copre {len(slides)} frasi ma lo "
            f"script ne produce {n_sentences}: aggiornare SLIDE_BREAKS."
        )
    for i in range(1, len(slides)):
        if slides[i] < slides[i - 1]:
            raise ValueError(
                f"[{chapter_id}] slide non monotone alle frasi {i - 1} -> {i}: "
                "aggiornare SLIDE_BREAKS."
            )
    for s in slides:
        if s >= n_slides:
            raise ValueError(
                f"[{chapter_id}] slide {s} fuori range (il deck ne ha {n_slides})."
            )
    return slides


def chapter_units(chapter):
    """Frasi del capitolo con la slide di appartenenza: [(testo, slide), ...].

    Fonte unica per timing e TTS. Le frasi sono sempre split_sentences(copione),
    cioè le stesse unità già sintetizzate negli mp3 (inclusi gli spezzoni di
    frasi lunghe). Con `narration` in ogni slide la slide di ogni frase si
    ricava da quella narrazione: le frasi devono coprire la narrazione
    esattamente, altrimenti l'errore è esplicito. Senza narrazioni (ripiego)
    si usa la tabella SLIDE_BREAKS.
    """
    cid = chapter["id"]
    slides = chapter.get("slides") or []
    sentences = split_sentences(chapter["script"])
    has_narr = bool(slides) and all(
        isinstance(s.get("narration"), str) and s["narration"].strip() for s in slides
    )
    if not has_narr:
        if cid not in SLIDE_BREAKS:
            raise ValueError(f"[{cid}] niente `narration` e nessuna mappa in SLIDE_BREAKS.")
        slide_of = expand_breaks(SLIDE_BREAKS[cid], len(sentences), len(slides), cid)
        return list(zip(sentences, slide_of))

    joined = " ".join(s["narration"] for s in slides)
    if norm_ws(joined) != norm_ws(chapter["script"]):
        raise ValueError(f"[{cid}] le narrazioni unite non coincidono col copione `script`")

    # Ogni slide consuma frasi consecutive finché il loro testo eguaglia la narrazione.
    units = []
    pos = 0
    for i, slide in enumerate(slides):
        target = norm_ws(slide["narration"])
        acc = ""
        while norm_ws(acc) != target:
            if pos >= len(sentences):
                raise ValueError(f"[{cid}] la narrazione della slide {i} non coincide con le frasi del copione")
            acc = f"{acc} {sentences[pos]}".strip()
            if len(norm_ws(acc)) > len(target):
                raise ValueError(f"[{cid}] la narrazione della slide {i} spezza una frase del copione")
            units.append((sentences[pos], i))
            pos += 1
    if pos != len(sentences):
        raise ValueError(f"[{cid}] {len(sentences) - pos} frasi del copione restano fuori dalle slide")
    return units


def probe_duration(mp3_path):
    """Durata reale dell'mp3 via ffprobe, in secondi (float)."""
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(mp3_path)],
        capture_output=True, text=True, check=True,
    )
    return float(proc.stdout.strip())


def build_chapter(chapter):
    """Costruisce il blocco timing di un capitolo. Ritorna None se manca l'audio."""
    cid = chapter["id"]
    mp3 = AUDIO_DIR / f"{cid}.mp3"
    if not mp3.exists():
        log.warning("audio mancante, salto capitolo: %s", mp3)
        return None
    units = chapter_units(chapter)
    sentences = [text for text, _ in units]
    slides = [slide for _, slide in units]
    n = len(sentences)
    if n == 0:
        raise ValueError(f"[{cid}] nessuna frase da sincronizzare.")

    duration = probe_duration(mp3)
    speech = duration - (n - 1) * GAP_SEC
    if speech <= 0:
        raise ValueError(f"[{cid}] durata {duration}s insufficiente per {n} frasi.")
    weights = [len(s) for s in sentences]
    total = sum(weights)

    # Cumulo esatto, arrotondamento solo in output: inizio_frase[i] =
    # fine_parlato[i-1] + GAP_SEC; prima t0 = 0.0, ultima t1 == duration.
    speech_end = [0.0]  # fine cumulata della parte parlata (tempi esatti)
    acc = 0.0
    for w in weights:
        acc += speech * w / total
        speech_end.append(acc)
    out_sentences = []
    for i, s in enumerate(sentences):
        t0 = 0.0 if i == 0 else speech_end[i] + i * GAP_SEC
        t1 = speech_end[i + 1] + i * GAP_SEC
        out_sentences.append({
            "t0": 0.0 if i == 0 else round(t0, 2),
            "t1": round(t1, 2),
            "slide": slides[i],
            "text": s,
        })
    out_sentences[-1]["t1"] = round(duration, 2)

    log.info("%s: %d frasi, duration=%.2fs, speech=%.2fs",
             cid, n, round(duration, 2), round(speech, 2))
    return {
        "audio": f"audio/{cid}.mp3",
        "duration": round(duration, 2),
        "sentences": out_sentences,
    }


def load_chapters():
    """Tutti i capitoli da content/chapters/<id>.json, in ordine di id (un oggetto per file)."""
    chapters = []
    for path in sorted(CHAPTERS_DIR.glob("*.json")):
        obj = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(obj, dict) or "id" not in obj:
            raise ValueError(f"{path}: atteso un oggetto capitolo con campo id")
        chapters.append(obj)
    return chapters


def main():
    parser = argparse.ArgumentParser(description="Rigenera content/timing.json.")
    parser.add_argument("--chapter", default=None,
                        help="rigenera/aggiunge un solo capitolo (es. ch3-model-dev)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    chapters = load_chapters()
    if args.chapter:
        chapters = [c for c in chapters if c["id"] == args.chapter]
        if not chapters:
            log.error("capitolo '%s' non trovato in content/chapters/", args.chapter)
            return 2
        try:
            data = json.loads(OUT_PATH.read_text(encoding="utf-8"))
        except FileNotFoundError:
            data = {"version": VERSION, "gap_sec": GAP_SEC, "chapters": {}}
    else:
        data = {"version": VERSION, "gap_sec": GAP_SEC, "chapters": {}}

    data["version"] = VERSION
    data["gap_sec"] = GAP_SEC

    failed = False
    for chapter in chapters:
        try:
            block = build_chapter(chapter)
        except (ValueError, subprocess.CalledProcessError) as exc:
            log.error("[%s] %s", chapter["id"], exc)
            failed = True
            continue
        if block is None:
            if args.chapter:
                # Richiesta esplicita ma audio assente: fallimento rumoroso.
                log.error("audio mancante per '%s', niente da generare", chapter["id"])
                failed = True
            continue
        data["chapters"][chapter["id"]] = block

    if failed:
        return 1
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n",
                        encoding="utf-8")
    log.info("Scritto %s (%d capitoli).", OUT_PATH, len(data["chapters"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
