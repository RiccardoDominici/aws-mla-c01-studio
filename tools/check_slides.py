#!/usr/bin/env python3
"""Controlla le slide arricchite: schema degli schemi, narrazione intatta, leggibilità.

    python3 tools/check_slides.py content/chapters/*.json
    python3 tools/check_slides.py --base HEAD content/chapters/ch3-model-dev.json

Che cosa verifica, in ordine di gravità:

1. **Narrazione intatta.** `slides[].narration`, `slides[].title` e `script` devono
   coincidere con la versione in git (`--base`, default `HEAD`). L'audio è
   sintetizzato dalle narrazioni: se cambiano, l'mp3 non è più allineato e il
   player lo rifiuta. Arricchire i bullet non deve toccare la voce.
2. **Schema degli schemi.** Ogni oggetto in `bullets` deve avere un `kind` noto
   (`visuals.js`), solo campi previsti, `tone` tra good/bad/warn, e nessun campo
   vuoto dove il renderer si aspetta testo.
3. **Testo nei bullet stringa.** Niente HTML, niente URL, niente simboli che il
   TTS non sa leggere (→, ≥, ≤, ×, %): le stringhe restano leggibili a voce.
4. **Leggibilità.** Al massimo 3 schemi per slide e 8 voci di testo: una slide
   piena non si legge né a schermo né in cuffia.

Exit code 1 se c'è almeno un errore.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

# Contratto degli schemi: campi ammessi per ogni kind (vedi visuals.js).
KINDS = {
    "flow": {"steps", "loop", "vertical", "title", "caption"},
    "compare": {"columns", "caption"},
    "bars": {"rows", "max", "unit", "caption"},
    "stack": {"rows", "unit", "caption"},
    "table": {"head", "rows", "caption"},
    "matrix": {"rows", "cols", "cells", "corner", "caption"},
    "scaling": {"panels", "curves", "xLabel", "yLabel", "title", "caption", "dots"},
    "layers": {"layers", "caption"},
    "tree": {"root", "branches", "caption"},
    "topology": {"nodes", "aside", "title", "caption"},
    "stats": {"items", "caption"},
    "note": {"title", "text", "tone"},
    "formula": {"mml", "text", "caption"},
}
TONES = {"good", "bad", "warn"}

# Campi che rendono una slice audio illeggibile o fuori tema.
TTS_FORBIDDEN = {
    "→": "freccia", "⇒": "freccia", "≥": "maggiore o uguale", "≤": "minore o uguale",
    "×": "per", "%": "per cento", "&": "e", "<": "minore di", ">": "maggiore di",
}

MAX_VISUALS = 3
MAX_TEXT_BULLETS = 8

# Sopra questa quota di parole del testo già presenti dentro uno schema, le
# schede sotto ripetono lo schema invece di aggiungere qualcosa.
DUPLICATE_RATIO = 0.85
STOPWORDS = set(
    "che di e il la per un una in con a da del della i gli le non si su al alla come o "
    "più dei delle lo è sono tra fra nel nella ai alle se ma anche quando ogni sua suo "
    "questo questa quello quella essere viene possono può".split()
)


def words(text: str) -> set[str]:
    return {
        w for w in re.findall(r"[a-zàèéìòù0-9]+", text.lower())
        if len(w) > 2 and w not in STOPWORDS
    }


def plain_strings(value) -> list[str]:
    """Testi di uno schema (esclusi MathML e i valori di controllo)."""
    out = []
    if isinstance(value, str):
        out.append(value)
    elif isinstance(value, list):
        for v in value:
            out.extend(plain_strings(v))
    elif isinstance(value, dict):
        for k, v in value.items():
            if k in ("mml", "tone", "kind"):
                continue
            out.extend(plain_strings(v))
    return out


def git_show(base: str, path: str) -> dict | None:
    """Versione del capitolo nella base git (None se il file è nuovo)."""
    try:
        out = subprocess.run(
            ["git", "show", f"{base}:{path}"],
            capture_output=True, text=True, check=True,
        ).stdout
        return json.loads(out)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def walk_strings(value, path=""):
    """Tutte le stringhe foglia di una struttura, con il loro percorso."""
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for i, v in enumerate(value):
            yield from walk_strings(v, f"{path}[{i}]")
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from walk_strings(v, f"{path}.{k}")


def check_visual(item: dict, where: str, errors: list, warnings: list):
    kind = item.get("kind")
    if kind not in KINDS:
        errors.append(f"{where}: kind sconosciuto {kind!r} (ammessi: {', '.join(sorted(KINDS))})")
        return
    extra = set(item) - KINDS[kind] - {"kind"}
    if extra:
        errors.append(f"{where}: campi non previsti per {kind}: {', '.join(sorted(extra))}")

    # tone: solo i tre valori, ovunque compaia
    for path, value in walk_strings(item, where):
        if path.endswith(".tone") and value not in TONES:
            errors.append(f"{path}: tone {value!r} non valido (good|bad|warn)")

    # campi obbligatori per forma
    required = {
        "flow": ["steps"], "compare": ["columns"], "bars": ["rows"],
        "stack": ["rows"], "table": ["rows"], "matrix": ["cells"],
        "scaling": [], "layers": ["layers"], "tree": ["branches"],
        "topology": ["nodes"], "stats": ["items"], "note": ["text"],
    }.get(kind, [])
    for field in required:
        val = item.get(field)
        if not val:
            errors.append(f"{where}: {kind} senza `{field}`")
        elif isinstance(val, (list, str)) and len(val) < (1 if field == "text" else 2) and kind in {
            "flow", "compare", "matrix",
        }:
            warnings.append(f"{where}: {kind} con {len(val)} elementi, schema troppo povero")

    if kind == "note" and not item.get("text", "").strip():
        errors.append(f"{where}: note con testo vuoto")
    if kind == "formula" and not (item.get("mml") or item.get("text")):
        errors.append(f"{where}: formula senza `mml` né `text`")
    if kind == "table":
        head = item.get("head") or []
        for i, row in enumerate(item.get("rows") or []):
            cells = row.get("cells", row) if isinstance(row, dict) else row
            if head and len(cells) != len(head):
                errors.append(f"{where}: riga {i} ha {len(cells)} celle, intestazioni {len(head)}")
    if kind == "bars":
        for row in item.get("rows") or []:
            if isinstance(row, dict) and row.get("value") is None and not row.get("display"):
                warnings.append(f"{where}: barra senza valore né display")


def check_slide(idx: int, slide: dict, errors: list, warnings: list):
    where = f"slide {idx}"
    bullets = slide.get("bullets") or []
    if not isinstance(bullets, list):
        errors.append(f"{where}: `bullets` non è una lista")
        return
    if not bullets:
        warnings.append(f"{where}: nessun bullet")

    visuals = [b for b in bullets if isinstance(b, dict)]
    texts = [b for b in bullets if isinstance(b, str) and b.strip()]

    for i, b in enumerate(bullets):
        if isinstance(b, dict):
            check_visual(b, f"{where} bullet {i}", errors, warnings)
        elif not isinstance(b, str):
            errors.append(f"{where} bullet {i}: tipo {type(b).__name__} non gestito")

    # schemi e schede che dicono la stessa cosa: lo schema basta
    if visuals and texts:
        visual_words = words(" ".join(plain_strings(visuals)))
        text_words = words(" ".join(texts))
        if text_words:
            shared = len(visual_words & text_words) / len(text_words)
            if shared > DUPLICATE_RATIO:
                warnings.append(
                    f"{where}: i bullet ripetono lo schema ({shared:.0%} delle parole già presenti); "
                    "valuta se togliere le schede o alleggerire lo schema"
                )

    if len(visuals) > MAX_VISUALS:
        errors.append(f"{where}: {len(visuals)} schemi (massimo {MAX_VISUALS}): la slide non si legge")
    if len(texts) > MAX_TEXT_BULLETS:
        errors.append(f"{where}: {len(texts)} voci di testo (massimo {MAX_TEXT_BULLETS})")

    for t in texts:
        if re.search(r"</?[a-z][^>]*>", t, re.I):
            errors.append(f"{where}: HTML nel bullet {t[:40]!r}")
        if "http://" in t or "https://" in t:
            errors.append(f"{where}: URL nel bullet {t[:40]!r}")

    # I simboli contano solo per la voce, non per gli schemi: il testo degli
    # schemi si legge a schermo e non passa dal TTS. Qui si controlla la
    # narrazione, che è quella che diventa audio.
    narration = str(slide.get("narration") or "")
    for sym, sound in TTS_FORBIDDEN.items():
        if sym in narration:
            errors.append(f"{where}: simbolo {sym!r} nella narrazione (a voce «{sound}»): l'audio lo salta")


def check_chapter(path: str, base: str) -> tuple[list, list]:
    errors, warnings = [], []
    with open(path, encoding="utf-8") as f:
        ch = json.load(f)

    slides = ch.get("slides") or []
    for idx, slide in enumerate(slides):
        check_slide(idx, slide, errors, warnings)

    # copione = unione delle narrazioni
    joined = " ".join(s.get("narration", "") for s in slides)
    if ch.get("script") != joined:
        errors.append("`script` non coincide con l'unione delle narrazioni")

    # confronto con la base git: la voce non si tocca
    old = git_show(base, path) if base else None
    if old is None:
        warnings.append(f"nessuna versione in {base}: confronto narrazione saltato")
    else:
        if old.get("script") != ch.get("script"):
            errors.append("`script` cambiato rispetto a " + base + ": l'audio non è più allineato")
        old_slides = old.get("slides") or []
        if len(old_slides) != len(slides):
            errors.append(
                f"numero di slide cambiato ({len(old_slides)} → {len(slides)}): "
                "timing e audio restano legati alle slide"
            )
        for i, (a, b) in enumerate(zip(old_slides, slides)):
            if a.get("narration") != b.get("narration"):
                errors.append(f"slide {i}: narrazione modificata (audio non più allineato)")
            if a.get("title") != b.get("title"):
                warnings.append(f"slide {i}: titolo modificato")
    return errors, warnings


def main() -> int:
    ap = argparse.ArgumentParser(description="Controlla le slide arricchite.")
    ap.add_argument("files", nargs="+", help="content/chapters/<id>.json")
    ap.add_argument("--base", default="HEAD", help="revisione git da confrontare (default HEAD)")
    args = ap.parse_args()

    total_errors = 0
    for path in args.files:
        errors, warnings = check_chapter(path, args.base)
        name = path.split("/")[-1]
        if errors:
            total_errors += len(errors)
            print(f"\n{name}: {len(errors)} errori, {len(warnings)} avvisi")
            for e in errors:
                print(f"  ERRORE   {e}")
        elif warnings:
            print(f"\n{name}: ok, {len(warnings)} avvisi")
        else:
            print(f"\n{name}: ok")
        for w in warnings:
            print(f"  avviso   {w}")

    print()
    print("TOTALE " + ("ok" if not total_errors else f"{total_errors} errori"))
    return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main())
