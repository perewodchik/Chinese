"""
A voice made from a description, rather than copied from anyone.

    .cache/tts-venv/bin/python scripts/voices/design.py <voice-id>

Reads the voice's description from scripts/voices/voices.json and has
Qwen3-TTS VoiceDesign (Apache-2.0) invent a speaker to match it, reading a
short reference passage. Several candidates are made, one per temperature;
`.cache/voices/design/<voice-id>-<n>.wav`. The chosen one is copied, with the
passage it reads, to scripts/voices/design/<voice-id>.wav and .txt, and every
clip in that voice is cloned from it (generate.py, engine "clone"). That is
what keeps one voice sounding like one person — designing each clip afresh
would give a slightly different speaker every time.

It describes a kind of voice. It does not imitate a real person's: a voice
actor's voice is theirs, and a game's recordings are not ours to clone.
"""

import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit"

# What the reference says: every tone, short clauses with pauses between them,
# and long enough (about ten seconds) for the cloning model to take the voice
# from. It is read the way the clips should be read, because cloning copies the
# pace and the manner as much as the timbre — a reference that rushes makes
# every clip rush.
REFERENCE = "你好，我是你的中文老师。我们慢慢来，一个字一个字地说清楚。听我念：妈，麻，马，骂。声调要念准，不用着急，你跟着我再说一遍。"


def main(voice_id: str) -> None:
    voices = json.load(open(os.path.join(ROOT, "scripts", "voices", "voices.json"), encoding="utf-8"))
    spec = next(v for v in voices if v["id"] == voice_id)
    out_dir = os.path.join(ROOT, ".cache", "voices", "design")
    os.makedirs(out_dir, exist_ok=True)

    from mlx_audio.tts.utils import load_model

    model = load_model(MODEL)
    for n, temperature in enumerate((0.6, 0.8, 0.9), 1):
        chunks, rate = [], 24000
        for r in model.generate_voice_design(
            text=REFERENCE, instruct=spec["description"], language="chinese", temperature=temperature
        ):
            chunks.append(np.asarray(r.audio, dtype=np.float32))
            rate = getattr(r, "sample_rate", rate) or rate
        audio = np.concatenate(chunks) if chunks else np.zeros(1, dtype=np.float32)
        path = os.path.join(out_dir, f"{voice_id}-{n}.wav")
        sf.write(path, audio.reshape(-1), rate, subtype="PCM_16")
        print(f"  {path}  {len(audio) / rate:.1f}s  peak {np.abs(audio).max():.2f}", flush=True)
    with open(os.path.join(out_dir, f"{voice_id}.txt"), "w", encoding="utf-8") as f:
        f.write(REFERENCE)


if __name__ == "__main__":
    main(sys.argv[1])
