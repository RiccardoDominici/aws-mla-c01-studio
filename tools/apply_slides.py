#!/usr/bin/env python3
"""Applica bullet arricchiti a un capitolo senza toccare la narrazione.

    python3 tools/apply_slides.py content/chapters/ch3-model-dev.json spec.py

`spec.py` espone `SLIDES = {indice_slide: [bullet, ...]}`, con la stessa forma
del campo `bullets` (stringhe e schemi, vedi `content/README`). Le slide non
elencate restano com'erano.

Lo script **non** riscrive le narrazioni e ricostruisce `script` dall'unione
delle narrazioni: se il risultato differisce, esce senza scrivere. L'audio è
sintetizzato dalle narrazioni (`tools/tts_chatterbox_batch.py`), quindi un
`.json` con la voce cambiata richiederebbe una nuova sintesi; arricchire solo i
bullet non la richiede.

Dopo l'applicazione conviene sempre controllare:

    python3 tools/check_slides.py content/chapters/<id>.json
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys


def load_spec(path: str) -> dict:
    spec = importlib.util.spec_from_file_location("slide_spec", path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"non riesco a caricare la specifica: {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    slides = getattr(mod, "SLIDES", None)
    if not isinstance(slides, dict):
        raise SystemExit(f"{path}: manca un dizionario SLIDES = {{indice: [bullet, ...]}}")
    return slides


def apply(chapter_path: str, spec: dict, dry_run: bool = False) -> bool:
    """Applica la specifica. Ritorna False se il copione cambierebbe per errore."""
    with open(chapter_path, encoding="utf-8") as f:
        data = json.load(f)
    slides = data.get("slides") or []

    out_of_range = sorted(i for i in spec if not (0 <= i < len(slides)))
    if out_of_range:
        print(f"{chapter_path}: slide inesistenti {out_of_range} (il capitolo ne ha {len(slides)})")
        return False

    narration_before = [s.get("narration") for s in slides]
    script_before = data.get("script")

    for idx, bullets in spec.items():
        slides[idx]["bullets"] = bullets

    # Invariante del contratto: il copione è l'unione delle narrazioni.
    joined = " ".join(s.get("narration", "") for s in slides)
    if [s.get("narration") for s in slides] != narration_before:
        print(f"{chapter_path}: le narrazioni sono cambiate: serve una nuova sintesi, non scrivo")
        return False
    if script_before is not None and script_before != joined:
        # Il capitolo aveva già un copione diverso: non lo tocco, ma lo segnalo.
        print(f"{chapter_path}: `script` non coincideva già con le narrazioni; lo riallineo")
    data["script"] = joined

    changed = sum(1 for i in spec)
    if dry_run:
        print(f"{chapter_path}: {changed} slide da aggiornare (dry run, niente scritto)")
        return True

    with open(chapter_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{chapter_path}: aggiornate {changed} slide")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description="Applica bullet arricchiti a un capitolo.")
    ap.add_argument("chapter", help="content/chapters/<id>.json")
    ap.add_argument("spec", help="file Python con SLIDES = {indice: [bullet, ...]}")
    ap.add_argument("--dry-run", action="store_true", help="mostra cosa cambierebbe")
    args = ap.parse_args()

    ok = apply(args.chapter, load_spec(args.spec), args.dry_run)
    if ok and not args.dry_run:
        print("ora verifica: python3 tools/check_slides.py " + args.chapter)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
