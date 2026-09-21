#!/usr/bin/env python3
"""Sintesi TTS batch degli 8 capitoli MLA-C01 con Chatterbox (voce Persona4).

Pipeline (ricetta da VibeCoding/persona4, tts_chatterbox.py + benchmark 2026-07-17):
  - engine: ChatterboxTTS backend="mlx", model="mlx-community/chatterbox-fp16",
    language="it", reference_audio=marta_ref_it_female.wav (voce femminile IT)
  - prosodia neutra: ProsodyParams(exaggeration=0.5, cfg_weight=0.5, temperature=0.8)
  - conditionals della reference calcolati UNA volta e riusati per ogni frase
    (risparmia ~2s/frase); output nativo 24000 Hz mono float32
  - pause di GAP_SEC=0.25s tra frasi (stesso contratto del player e di make_timing.py)

Contratto rispettato (identico al TTS precedente, solo la voce cambia):
  - splitter frasi: importato da tools/make_timing.py (split_sentences) — NON duplicato
  - wav intermedio 24kHz mono -> mp3 via ffmpeg libmp3lame -b:a 64k (come gli mp3 attuali)
  - timing.json rigenerato con tools/make_timing.py dopo ogni capitolo

Uso (con il venv di persona4, che ha mlx-audio + soundfile):
    /Users/riccardo/Developer/VibeCoding/persona4/.venv/bin/python \\
        tools/tts_chatterbox_batch.py --chapter quick-ref   # pilot (13 frasi)
    ... --chapter ch1-exam-guide                            # un capitolo
    ... --all                                               # tutti gli 8 capitoli

Ogni frase sintetizzata passa un controllo energia (RMS minimo): se una frase
esce muta/sospetta lo script abortisce invece di scrivere audio corrotto.
"""

import argparse
import asyncio
import json
import logging
import subprocess
import sys
from pathlib import Path

# Directory radice del sito (tools/ si trova subito sotto).
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))  # per riusare split_sentences di make_timing
from make_timing import split_sentences  # noqa: E402

# Repo Persona4: riuso la classe ChatterboxTTS (stessa voce del progetto persona4).
PERSONA4_SRC = Path("/Users/riccardo/Developer/VibeCoding/persona4/src")
sys.path.insert(0, str(PERSONA4_SRC))

CONTENT_1 = ROOT / "content" / "chapters-1.json"
CONTENT_2 = ROOT / "content" / "chapters-2.json"
AUDIO_DIR = ROOT / "audio"

MODEL = "mlx-community/chatterbox-fp16"
LANGUAGE = "it"
REFERENCE_AUDIO = str(
    PERSONA4_SRC / "persona4" / "voice" / "assets" / "marta_ref_it_female.wav"
)
SAMPLE_RATE = 24000
GAP_SEC = 0.25  # identico a make_timing.GAP_SEC
MIN_RMS = 1e-4  # sotto questa energia la frase e' considerata muta -> abort

CHAPTERS = [
    "ch1-exam-guide",
    "ch2-data-prep",
    "ch3-model-dev",
    "ch4-deploy",
    "ch5-monitor-security",
    "ch6-genai",
    "ch7-practice",
    "quick-ref",
]

log = logging.getLogger("tts-batch")


def load_scripts():
    """Testo sorgente di ogni capitolo dai JSON dei contenuti."""
    out = {}
    for path in (CONTENT_1, CONTENT_2):
        for c in json.loads(path.read_text(encoding="utf-8")):
            out[c["id"]] = c["script"]
    return out


def check_energy(samples, idx):
    """Rifiuta frasi mute o quasi (modello impazzito / testo degenere)."""
    import numpy as np

    rms = float(np.sqrt(np.mean(np.asarray(samples, dtype=np.float64) ** 2)))
    if rms < MIN_RMS:
        raise RuntimeError(f"frase {idx}: energia sospetta (RMS={rms:.2e}), abort")
    return rms


async def synthesize_chapter(tts, prosody, text, label):
    """Sintetizza tutte le frasi di un capitolo, ritorna lista di AudioBuffer."""
    import numpy as np

    sentences = split_sentences(text)
    log.info("%s: %d frasi da sintetizzare", label, len(sentences))
    buffers = []
    gap = np.zeros(int(SAMPLE_RATE * GAP_SEC), dtype=np.float32)
    for i, s in enumerate(sentences):
        buf = await tts.synthesize(s, prosody=prosody)
        rms = check_energy(buf.samples, i)
        buffers.append((buf, gap if i > 0 else None))
        if (i + 1) % 10 == 0 or i + 1 == len(sentences):
            log.info("%s: frase %d/%d (chars=%d rms=%.4f)",
                     label, i + 1, len(sentences), len(s), rms)
    return sentences, buffers


def write_chapter_mp3(sentences, buffers, chapter_id):
    """Concatena frasi + pause, scrive wav intermedio e mp3 finale. Ritorna durata."""
    import numpy as np
    import soundfile as sf

    parts = []
    for buf, gap in buffers:
        if gap is not None:
            parts.append(gap)
        parts.append(np.asarray(buf.samples, dtype=np.float32))
    audio = np.concatenate(parts)
    duration = len(audio) / SAMPLE_RATE

    wav_path = AUDIO_DIR / f"{chapter_id}.wav"
    mp3_path = AUDIO_DIR / f"{chapter_id}.mp3"
    sf.write(str(wav_path), audio, SAMPLE_RATE)
    log.info("%s: wav scritto (%.1fs, %d campioni)", chapter_id, duration, len(audio))

    # Stesso encoding degli mp3 attuali (mono 24kHz ~64kbit) cosi' il player
    # e make_timing.py (ffprobe duration) non vedono alcuna differenza di formato.
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(wav_path),
         "-codec:a", "libmp3lame", "-b:a", "64k",
         "-ar", "24000", "-ac", "1", str(mp3_path)],
        check=True,
    )
    log.info("%s: mp3 scritto (%d byte)", chapter_id, mp3_path.stat().st_size)
    return duration


async def amain(args):
    from persona4.voice.tts_chatterbox import ChatterboxTTS
    from persona4.voice.types import ProsodyParams

    scripts = load_scripts()
    targets = CHAPTERS if args.all else [args.chapter]
    for t in targets:
        if t not in scripts:
            raise SystemExit(f"capitolo sconosciuto: {t} (file: {sorted(scripts)})")

    tts = ChatterboxTTS(backend="mlx", model=MODEL,
                        language=LANGUAGE, reference_audio=REFERENCE_AUDIO)
    prosody = ProsodyParams()  # neutra 0.5/0.5/0.8
    log.info("warm-up: carico modello %s + conditionals reference", MODEL)
    warm = await tts.synthesize("Prova di riscaldamento della voce.", prosody=prosody)
    log.info("warm-up ok (sr=%d, campioni=%d)", warm.sample_rate, len(warm.samples))
    assert warm.sample_rate == SAMPLE_RATE, warm.sample_rate

    for chapter_id in targets:
        text = scripts[chapter_id]
        if args.max_sentences:
            cut = split_sentences(text)[: args.max_sentences]
            text = " ".join(cut)
            log.warning("%s: SMOKE-TEST, solo %d frasi", chapter_id, len(cut))
        sentences, buffers = await synthesize_chapter(tts, prosody, text, chapter_id)
        duration = write_chapter_mp3(sentences, buffers, chapter_id)
        log.info("%s: COMPLETATO (%d frasi, %.1fs)", chapter_id, len(sentences), duration)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--chapter", help="id capitolo (es. ch1-exam-guide, quick-ref)")
    g.add_argument("--all", action="store_true", help="tutti gli 8 capitoli")
    ap.add_argument("--max-sentences", type=int, default=0,
                    help="smoke-test: sintetizza solo le prime N frasi")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(amain(args))


if __name__ == "__main__":
    main()
