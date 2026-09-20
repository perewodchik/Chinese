"""
Reads Mandarin aloud on this machine, with an open model.

    .cache/tts-venv/bin/python scripts/voices/generate.py jobs.json out_dir [--engine qwen3|kokoro]

`jobs.json` is a list of {"id", "text", "voice", "speed"}; each job becomes
`<out_dir>/<id>.wav` (24 kHz, 16-bit mono). Jobs whose file already exists are
skipped, so a run that stops half way picks up where it left off.

Why this rather than a cloud voice: no account, no key, nothing to be blocked,
and Apache-licensed models whose output can be shipped with the app.

Two engines. **qwen3** (Qwen3-TTS 0.6B CustomVoice, through MLX on Apple
Silicon) is the one the pack is built with: its Mandarin speakers get the
tones right, and it takes an instruction in words — clear, standard, a little
slow. **kokoro** (Kokoro-82M-v1.1-zh) was tried first and is kept for
comparison; the tone check passed barely a third of its clips.

The setup, once:

    python3.12 -m venv .cache/tts-venv
    .cache/tts-venv/bin/pip install "kokoro>=0.9.4" "misaki[zh]>=0.9.4" mlx-audio soundfile lameenc numpy
"""

import hashlib
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from kokoro import KModel, KPipeline  # noqa: E402

KOKORO = "hexgrad/Kokoro-82M-v1.1-zh"


def token_budget(text: str) -> int:
    """
    How long the model may talk, in its 12 Hz codec frames: about three
    quarters of a second a character, plus two seconds. Without a ceiling the
    model occasionally never stops, and one sentence takes the whole default
    of 4,096 frames — five and a half minutes of a voice trailing off.
    """
    return int(12 * (0.75 * len(text) + 2))
QWEN3 = "mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16"
# Said to the model with every line: the voice a teacher uses on a recording
# for learners, not the voice of a news anchor.
QWEN3_STYLE = "用标准普通话，吐字清晰，声调准确，语速稍慢。"


def kokoro_engine():
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = KModel(repo_id=KOKORO).to(device).eval()
    # English words are not expected; anything Latin is read letter by letter
    # rather than failing the job.
    pipeline = KPipeline(lang_code="z", repo_id=KOKORO, model=model, en_callable=lambda text: text)

    def say(job):
        chunks = [
            r.audio.detach().cpu().numpy() if hasattr(r.audio, "detach") else np.asarray(r.audio)
            for r in pipeline(job["text"], voice=job["voice"], speed=job.get("speed", 1.0))
            if r.audio is not None
        ]
        return (np.concatenate(chunks) if chunks else None), 24000

    return say


def qwen3_engine():
    from mlx_audio.tts.utils import load_model

    model = load_model(QWEN3)

    def once(job, temperature):
        chunks, rate = [], 24000
        for r in model.generate_custom_voice(
            text=job["text"],
            speaker=job["voice"],
            language="chinese",
            instruct=QWEN3_STYLE,
            temperature=temperature,
            max_tokens=token_budget(job["text"]),
        ):
            chunks.append(np.asarray(r.audio, dtype=np.float32))
            rate = getattr(r, "sample_rate", rate) or rate
        return (np.concatenate(chunks) if chunks else None), rate

    def say(job):
        # Now and then the model returns silence for a line; a warmer second
        # or third try almost always speaks.
        for temperature in (0.3, 0.6, 0.8):
            audio, rate = once(job, temperature)
            if audio is not None and len(audio) and np.abs(audio).max() > 0.02:
                return audio, rate
        return None, 24000

    return say


BASE = "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit"
# The chosen reference of each designed voice, kept in the repository so the
# voice survives a clean checkout (design.py makes the candidates).
DESIGN_DIR = os.path.join(os.path.dirname(__file__), "design")


def transcript(name: str, wav: str) -> str:
    """
    What that reference says, checked against what design.py kept.

    The model lines the reference audio up against its transcript to work out
    how the speaker sounds; a transcript from a different recording makes that
    alignment nonsense and every clip drifts. Two files that both exist and
    disagree look fine from the outside, so the pair is verified here and the
    build stops rather than voicing three hundred sentences from a broken one.
    """
    with open(os.path.join(DESIGN_DIR, f"{name}.txt"), encoding="utf-8") as f:
        text = f.read().strip()
    manifest = os.path.join(DESIGN_DIR, "references.json")
    if os.path.exists(manifest):
        with open(manifest, encoding="utf-8") as f:
            known = json.load(f).get(name)
        if known:
            digest = hashlib.sha256(open(wav, "rb").read()).hexdigest()
            if digest != known["sha256"] or text != known["text"]:
                raise SystemExit(
                    f"{name}: the reference recording and its transcript do not match what design.py kept."
                    " Design it again (design.py <voice> <variant> --keep <n>) rather than copying files by hand."
                )
    return text


def clone_engine():
    """Every clip in a designed voice, cloned from that voice's one reference (design.py)."""
    from mlx_audio.tts.utils import load_model

    model = load_model(BASE)

    def say(job):
        ref = os.path.join(DESIGN_DIR, f"{job['voice']}.wav")
        ref_text = transcript(job["voice"], ref)
        for temperature in (0.3, 0.6, 0.8):
            chunks, rate = [], 24000
            for r in model.generate(
                text=job["text"],
                ref_audio=ref,
                ref_text=ref_text,
                lang_code="chinese",
                temperature=temperature,
                max_tokens=token_budget(job["text"]),
            ):
                chunks.append(np.asarray(r.audio, dtype=np.float32))
                rate = getattr(r, "sample_rate", rate) or rate
            audio = np.concatenate(chunks) if chunks else None
            if audio is not None and len(audio) and np.abs(audio).max() > 0.02:
                return audio, rate
        return None, 24000

    return say


def main(jobs_file: str, out_dir: str, engine: str) -> None:
    with open(jobs_file, encoding="utf-8") as f:
        jobs = json.load(f)
    os.makedirs(out_dir, exist_ok=True)
    todo = [j for j in jobs if not os.path.exists(os.path.join(out_dir, f"{j['id']}.wav"))]
    # --shard i/n: this process takes every n-th job, so n of them can run at once.
    if "--shard" in sys.argv:
        i, n = map(int, sys.argv[sys.argv.index("--shard") + 1].split("/"))
        todo = todo[i::n]
    if not todo:
        print(f"all {len(jobs)} already made")
        return

    say = {"qwen3": qwen3_engine, "clone": clone_engine, "kokoro": kokoro_engine}[engine]()
    for n, job in enumerate(todo, 1):
        audio, rate = say(job)
        if audio is None or not len(audio):
            print(f"  nothing for {job['id']} ({job['text']})", file=sys.stderr)
            continue
        sf.write(os.path.join(out_dir, f"{job['id']}.wav"), audio.reshape(-1), rate, subtype="PCM_16")
        if n % 25 == 0 or n == len(todo):
            print(f"  {n}/{len(todo)}", flush=True)


if __name__ == "__main__":
    def flag(name, default=None):
        return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

    engine = flag("--engine", "qwen3")
    main(sys.argv[1], sys.argv[2], engine)
