#!/usr/bin/env python3
"""Sintesi TTS batch dei capitoli MLA-C01 con Chatterbox (voce Persona4).

Pipeline (ricetta da VibeCoding/persona4, tts_chatterbox.py + benchmark 2026-07-17):
  - engine: ChatterboxTTS backend="mlx", model="mlx-community/chatterbox-fp16",
    language="it", reference_audio=marta_ref_it_female.wav (voce femminile IT)
  - prosodia neutra: ProsodyParams(exaggeration=0.5, cfg_weight=0.5, temperature=0.8)
  - conditionals della reference calcolati UNA volta e riusati per ogni frase
  - output nativo 24000 Hz mono float32
  - pause di GAP_SEC=0.25s tra frasi (stesso contratto del player e di make_timing.py)

Sorgente: content/chapters/<id>.json (un file per capitolo). Le frasi sono quelle
di tools/make_timing.chapter_units, cioè le stesse usate per timing.json.

Cache per frase: .tts-cache/<hash>.wav (ignorata da git). La chiave è l'hash del
testo della frase più i parametri di voce (modello, lingua, reference, prosodia).
Un'interruzione riprende da dove era; un capitolo modificato risintetizza solo le
frasi cambiate. Il modello si carica solo se c'è almeno una frase da sintetizzare.

Manifest: audio/manifest.json registra per ogni capitolo sintetizzato l'hash
sha256 del copione `script`. `--stale` sintetizza solo i capitoli senza mp3 o
con il copione cambiato rispetto al manifest. `--adopt` registra nel manifest il
copione attuale dei capitoli che hanno già un mp3, senza sintetizzare.

Uso (con il Python di persona4, che ha mlx-audio + soundfile):
    PY=<cartella di persona4>/.venv/bin/python   # cartella di persona4: variabile d'ambiente PERSONA4_SRC
                                                 # (default: ../VibeCoding/persona4/src rispetto al repo)
    $PY tools/tts_chatterbox_batch.py --chapter quick-ref
    $PY tools/tts_chatterbox_batch.py --chapter ch1-exam-guide,ch8-data-advanced
    $PY tools/tts_chatterbox_batch.py --all
    $PY tools/tts_chatterbox_batch.py --stale --dry-run   # elenco senza sintesi
    $PY tools/tts_chatterbox_batch.py --stale
    $PY tools/tts_chatterbox_batch.py --adopt ch1-exam-guide,ch2-data-prep
    # smoke test: nessun manifest, nessun timing, output nello scratchpad
    $PY tools/tts_chatterbox_batch.py --chapter quick-ref --max-sentences 3 --out-dir DIR

Dopo ogni capitolo completo lancia make_timing.py --chapter <id> per aggiornare
content/timing.json.

Ogni frase sintetizzata passa un controllo energia (RMS minimo): se una frase
esce muta/sospetta lo script abortisce invece di scrivere audio corrotto.
"""

import argparse
import asyncio
import dataclasses
import hashlib
import json
import logging
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# Directory radice del sito (tools/ si trova subito sotto).
ROOT = Path(__file__).resolve().parent.parent
TOOLS_DIR = ROOT / "tools"
sys.path.insert(0, str(TOOLS_DIR))  # per riusare chapter_units di make_timing
from make_timing import chapter_units  # noqa: E402

# Repo Persona4: riuso la classe ChatterboxTTS (stessa voce del progetto persona4).
# Cartella src di persona4: si imposta con la variabile d'ambiente PERSONA4_SRC (default: ../VibeCoding/persona4/src rispetto al repo).
PERSONA4_SRC = Path(os.environ.get("PERSONA4_SRC", ROOT.parent / "VibeCoding" / "persona4" / "src"))
sys.path.insert(0, str(PERSONA4_SRC))

CHAPTERS_DIR = ROOT / "content" / "chapters"
AUDIO_DIR = ROOT / "audio"
CACHE_DIR = ROOT / ".tts-cache"
MANIFEST_PATH = AUDIO_DIR / "manifest.json"

MODEL = "mlx-community/chatterbox-fp16"
LANGUAGE = "it"
REFERENCE_AUDIO = str(
    PERSONA4_SRC / "persona4" / "voice" / "assets" / "marta_ref_it_female.wav"
)
SAMPLE_RATE = 24000
GAP_SEC = 0.25  # identico a make_timing.GAP_SEC
MIN_RMS = 1e-4  # sotto questa energia la frase e' considerata muta -> abort
MANIFEST_VERSION = 1
# Prosodia neutra (uguale a ProsodyParams() di persona4): entra nella chiave di cache.
PROSODY = {"exaggeration": 0.5, "cfg_weight": 0.5, "temperature": 0.8}

log = logging.getLogger("tts-batch")


# ---------- capitoli e manifest ----------

def sha256_text(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_chapters():
    """Tutti i capitoli da content/chapters/<id>.json, indicizzati per id."""
    out = {}
    for path in sorted(CHAPTERS_DIR.glob("*.json")):
        obj = json.loads(path.read_text(encoding="utf-8"))
        out[obj["id"]] = obj
    return out


def load_manifest():
    if not MANIFEST_PATH.exists():
        return {"version": MANIFEST_VERSION, "chapters": {}}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def save_manifest(manifest):
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    tmp = MANIFEST_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, MANIFEST_PATH)


def is_stale(chapter, manifest):
    """Vero se il capitolo non ha mp3 o se il copione è diverso da quello sintetizzato."""
    cid = chapter["id"]
    entry = manifest["chapters"].get(cid)
    if not (AUDIO_DIR / f"{cid}.mp3").exists():
        return True
    return entry is None or entry.get("script_sha256") != sha256_text(chapter["script"])


# ---------- cache per frase ----------

def reference_sha256():
    return hashlib.sha256(Path(REFERENCE_AUDIO).read_bytes()).hexdigest()


def cache_key(text, voice):
    """Hash del testo della frase più i parametri di voce."""
    payload = {"text": text, "voice": voice}
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()


def cache_read(key):
    """Campioni float32 dalla cache, oppure None se la frase non c'è."""
    import numpy as np
    import soundfile as sf

    path = CACHE_DIR / f"{key}.wav"
    if not path.exists():
        return None
    try:
        samples, sr = sf.read(str(path), dtype="float32")
    except Exception as exc:  # file corrotto (interruzione durante la scrittura): risintetizza
        log.warning("cache illeggibile, risintetizzo (%s): %s", path.name, exc)
        return None
    if sr != SAMPLE_RATE:
        log.warning("cache con sample rate %d inatteso, risintetizzo: %s", sr, path.name)
        return None
    return np.asarray(samples, dtype=np.float32)


def cache_write(key, samples):
    """Scrittura atomica: file temporaneo poi rinomina, così un'interruzione non lascia wav a metà."""
    import soundfile as sf

    CACHE_DIR.mkdir(exist_ok=True)
    final = CACHE_DIR / f"{key}.wav"
    tmp = CACHE_DIR / f"{key}.tmp.wav"
    sf.write(str(tmp), samples, SAMPLE_RATE)
    os.replace(tmp, final)


def check_energy(samples, idx):
    """Rifiuta frasi mute o quasi (modello impazzito / testo degenere)."""
    import numpy as np

    rms = float(np.sqrt(np.mean(np.asarray(samples, dtype=np.float64) ** 2)))
    if rms < MIN_RMS:
        raise RuntimeError(f"frase {idx}: energia sospetta (RMS={rms:.2e}), abort")
    return rms


# ---------- sintesi ----------

class LazyTTS:
    """Carica il modello Chatterbox solo alla prima frase che non è in cache."""

    def __init__(self):
        self._tts = None
        self._prosody = None

    async def _ensure(self):
        if self._tts is not None:
            return
        from persona4.voice.tts_chatterbox import ChatterboxTTS
        from persona4.voice.types import ProsodyParams

        log.info("carico modello %s + conditionals reference (circa un minuto)", MODEL)
        self._tts = ChatterboxTTS(backend="mlx", model=MODEL,
                                  language=LANGUAGE, reference_audio=REFERENCE_AUDIO)
        self._prosody = ProsodyParams()
        # La chiave di cache usa PROSODY: se persona4 cambia i default, si ferma subito.
        if dataclasses.asdict(self._prosody) != PROSODY:
            raise SystemExit(f"prosodia di persona4 diversa da PROSODY: {self._prosody}")
        warm = await self._tts.synthesize("Prova di riscaldamento della voce.",
                                          prosody=self._prosody)
        log.info("warm-up ok (sr=%d, campioni=%d)", warm.sample_rate, len(warm.samples))
        assert warm.sample_rate == SAMPLE_RATE, warm.sample_rate

    async def synthesize(self, text):
        await self._ensure()
        buf = await self._tts.synthesize(text, prosody=self._prosody)
        if buf.sample_rate != SAMPLE_RATE:
            raise RuntimeError(f"sample rate {buf.sample_rate}, atteso {SAMPLE_RATE}")
        return buf.samples


async def synthesize_sentences(tts, sentences, voice, label):
    """Campioni di ogni frase: dalla cache se presenti, altrimenti sintetizzati e salvati."""
    import numpy as np

    out = []
    hits = 0
    for i, text in enumerate(sentences):
        key = cache_key(text, voice)
        samples = cache_read(key)
        if samples is not None:
            hits += 1
        else:
            samples = np.asarray(await tts.synthesize(text), dtype=np.float32)
            rms = check_energy(samples, i)
            cache_write(key, samples)
            log.debug("%s: frase %d sintetizzata (chars=%d rms=%.4f)", label, i + 1, len(text), rms)
        out.append(samples)
        if (i + 1) % 10 == 0 or i + 1 == len(sentences):
            log.info("%s: frase %d/%d (cache %d)", label, i + 1, len(sentences), hits)
    return out


def assemble_wav_and_mp3(buffers, chapter_id, out_dir):
    """Concatena frasi + pause, scrive wav intermedio e mp3 finale. Ritorna la durata."""
    import numpy as np
    import soundfile as sf

    gap = np.zeros(int(SAMPLE_RATE * GAP_SEC), dtype=np.float32)
    parts = []
    for i, samples in enumerate(buffers):
        if i > 0:
            parts.append(gap)
        parts.append(np.asarray(samples, dtype=np.float32))
    audio = np.concatenate(parts)
    duration = len(audio) / SAMPLE_RATE

    out_dir.mkdir(parents=True, exist_ok=True)
    wav_path = out_dir / f"{chapter_id}.wav"
    mp3_path = out_dir / f"{chapter_id}.mp3"
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


async def synthesize_chapter(tts, chapter, args, out_dir, voice):
    """Sintetizza un capitolo intero. Ritorna (n_frasi, durata)."""
    cid = chapter["id"]
    units = chapter_units(chapter)
    sentences = [text for text, _ in units]
    if args.max_sentences:
        sentences = sentences[: args.max_sentences]
        log.warning("%s: SMOKE-TEST, solo %d frasi", cid, len(sentences))
    buffers = await synthesize_sentences(tts, sentences, voice, cid)
    duration = assemble_wav_and_mp3(buffers, cid, out_dir)
    return len(sentences), duration


def select_chapters(args, chapters, manifest):
    """Capitoli da sintetizzare secondo --chapter, --all, --stale o --adopt."""
    if args.all:
        return list(chapters)
    if args.stale:
        return [cid for cid in chapters if is_stale(chapters[cid], manifest)]
    return [c.strip() for c in args.chapter.split(",") if c.strip()]


async def amain(args):
    chapters = load_chapters()
    manifest = load_manifest()

    if args.adopt:
        for cid in [c.strip() for c in args.adopt.split(",") if c.strip()]:
            if cid not in chapters:
                raise SystemExit(f"capitolo sconosciuto: {cid}")
            if not (AUDIO_DIR / f"{cid}.mp3").exists():
                raise SystemExit(f"{cid}: manca audio/{cid}.mp3, nulla da registrare")
            manifest["chapters"][cid] = {
                "script_sha256": sha256_text(chapters[cid]["script"]),
                "adopted": True,
            }
            log.info("manifest: %s registrato con il copione attuale", cid)
        save_manifest(manifest)
        return

    targets = select_chapters(args, chapters, manifest)
    if not targets:
        log.info("niente da sintetizzare (capitoli aggiornati)")
        return
    for cid in targets:
        if cid not in chapters:
            raise SystemExit(f"capitolo sconosciuto: {cid} (file: {sorted(chapters)})")
    log.info("capitoli da sintetizzare: %s", ", ".join(targets))
    if args.dry_run:
        log.info("--dry-run: nessuna sintesi")
        return

    out_dir = Path(args.out_dir) if args.out_dir else AUDIO_DIR
    tts = LazyTTS()
    # Parametri di voce che entrano nella chiave di cache di ogni frase.
    voice = {
        "model": MODEL, "language": LANGUAGE, "reference_sha256": reference_sha256(),
        "prosody": PROSODY, "sample_rate": SAMPLE_RATE,
    }

    for cid in targets:
        chapter = chapters[cid]
        n, duration = await synthesize_chapter(tts, chapter, args, out_dir, voice)
        log.info("%s: COMPLETATO (%d frasi, %.1fs)", cid, n, duration)
        if args.max_sentences or args.out_dir:
            continue  # smoke test o output di prova: nessun manifest né timing
        manifest["chapters"][cid] = {
            "script_sha256": sha256_text(chapter["script"]),
            "sentences": n,
            "duration": round(duration, 2),
            "synthesized_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        save_manifest(manifest)
        subprocess.run([sys.executable, str(TOOLS_DIR / "make_timing.py"), "--chapter", cid],
                       check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--chapter", help="id capitolo o elenco separato da virgole (es. quick-ref)")
    g.add_argument("--all", action="store_true", help="tutti i capitoli in content/chapters/")
    g.add_argument("--stale", action="store_true",
                   help="solo capitoli senza mp3 o con copione cambiato rispetto al manifest")
    g.add_argument("--adopt", help="registra nel manifest il copione attuale (mp3 già esistenti)")
    ap.add_argument("--max-sentences", type=int, default=0,
                    help="smoke-test: sintetizza solo le prime N frasi")
    ap.add_argument("--dry-run", action="store_true",
                    help="mostra i capitoli scelti senza sintetizzare")
    ap.add_argument("--out-dir", default="",
                    help="cartella di output (test): niente manifest, niente timing")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(amain(args))


if __name__ == "__main__":
    main()
