#!/usr/bin/env python3
"""Genera content/timing.json: mappa tempo -> frase -> slide per il player.

Sincronizza slide e trascrizione karaoke con l'audio TTS di ogni capitolo.

Uso:
    python3 tools/make_timing.py                  # rigenera tutti i capitoli con audio pronto
    python3 tools/make_timing.py --chapter ch3-model-dev   # rigenera/aggiunge un solo capitolo

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

Mappatura frasi -> slide: definita a mano in SLIDE_BREAKS come lista di
coppie (indice_prima_frase, indice_slide); gli indici slide sono monotoni
non-decrescenti lungo le frasi. Se lo script di un capitolo cambia (e quindi
il numero di frasi), lo script fallisce con un errore esplicito: aggiornare
la mappa di quel capitolo.

Solo stdlib + ffprobe. Capitoli senza audio (es. ch7 prima del TTS)
vengono saltati con un warning nel run completo.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

# Directory radice del sito (tools/ si trova subito sotto).
ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
AUDIO_DIR = ROOT / "audio"
OUT_PATH = CONTENT_DIR / "timing.json"

GAP_SEC = 0.25
VERSION = 1

# Capitolo -> [(indice_prima_frase, indice_slide), ...].
# L'ultima coppia copre tutte le frasi fino alla fine del capitolo.
# Mappa MLA-C01: split proporzionale frasi/slide per capitolo.
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
        print(f"WARN: audio mancante, salto capitolo: {mp3}", file=sys.stderr)
        return None
    sentences = split_sentences(chapter["script"])
    n = len(sentences)
    if cid not in SLIDE_BREAKS:
        raise ValueError(f"[{cid}] nessuna mappa in SLIDE_BREAKS: aggiungerla.")
    slides = expand_breaks(SLIDE_BREAKS[cid], n, len(chapter["slides"]), cid)

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

    print(f"OK {cid}: {n} frasi, duration={round(duration, 2)}s, "
          f"speech={round(speech, 2)}s")
    return {
        "audio": f"audio/{cid}.mp3",
        "duration": round(duration, 2),
        "sentences": out_sentences,
    }


def load_chapters():
    """Tutti i capitoli da content/chapters-*.json, in ordine di file."""
    chapters = []
    for path in sorted(CONTENT_DIR.glob("chapters-*.json")):
        chapters.extend(json.loads(path.read_text(encoding="utf-8")))
    return chapters


def main():
    parser = argparse.ArgumentParser(description="Rigenera content/timing.json.")
    parser.add_argument("--chapter", default=None,
                        help="rigenera/aggiunge un solo capitolo (es. ch3-model-dev)")
    args = parser.parse_args()

    chapters = load_chapters()
    if args.chapter:
        chapters = [c for c in chapters if c["id"] == args.chapter]
        if not chapters:
            print(f"ERRORE: capitolo '{args.chapter}' non trovato nei chapters-*.json.",
                  file=sys.stderr)
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
            print(f"ERRORE [{chapter['id']}]: {exc}", file=sys.stderr)
            failed = True
            continue
        if block is None:
            if args.chapter:
                # Richiesta esplicita ma audio assente: fallimento rumoroso.
                print(f"ERRORE: audio mancante per '{chapter['id']}', "
                      f"niente da generare.", file=sys.stderr)
                failed = True
            continue
        data["chapters"][chapter["id"]] = block

    if failed:
        return 1
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n",
                        encoding="utf-8")
    print(f"Scritto {OUT_PATH} ({len(data['chapters'])} capitoli).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
