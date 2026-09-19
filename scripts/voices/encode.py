"""
Turns generated WAVs into the small MP3s the app ships.

    .cache/tts-venv/bin/python scripts/voices/encode.py pairs.json

`pairs.json` is a list of {"src": wav, "dst": mp3}. Silence is trimmed from
both ends, leaving a breath of 60 ms, because a clip that starts a third of a
second late feels like a button that did not work. MP3 because every browser
decodes it, Safari included; 40 kbps mono is plenty for one voice.
"""

import json
import os
import sys

import lameenc
import numpy as np
import soundfile as sf

PAD = 0.06
FLOOR_DB = -42.0


def trimmed(audio: np.ndarray, rate: int) -> np.ndarray:
    frame = int(rate * 0.01)
    if len(audio) < frame:
        return audio
    n = len(audio) // frame
    rms = np.sqrt(np.mean(audio[: n * frame].reshape(n, frame) ** 2, axis=1) + 1e-12)
    loud = np.where(20 * np.log10(rms / (rms.max() + 1e-12)) > FLOOR_DB)[0]
    if not len(loud):
        return audio
    pad = int(PAD * rate)
    start = max(0, loud[0] * frame - pad)
    end = min(len(audio), (loud[-1] + 1) * frame + pad)
    return audio[start:end]


def main(pairs_file: str) -> None:
    with open(pairs_file, encoding="utf-8") as f:
        pairs = json.load(f)
    for p in pairs:
        audio, rate = sf.read(p["src"], dtype="float32")
        audio = trimmed(audio, rate)
        pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
        enc = lameenc.Encoder()
        enc.set_bit_rate(40)
        enc.set_in_sample_rate(rate)
        enc.set_channels(1)
        enc.set_quality(2)
        data = enc.encode(pcm.tobytes()) + enc.flush()
        os.makedirs(os.path.dirname(p["dst"]), exist_ok=True)
        with open(p["dst"], "wb") as out:
            out.write(data)


if __name__ == "__main__":
    main(sys.argv[1])
