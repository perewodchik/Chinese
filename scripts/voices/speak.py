"""
Reads Mandarin aloud on request, for as long as the server that started it runs.

    .cache/tts-venv/bin/python scripts/voices/speak.py

The voice pack (generate.py) reads a fixed list of words ahead of time. A
conversation cannot be read ahead of time: Claude's answer exists only once
it has been written. So the home server keeps this process running beside
it, with the models loaded once, and asks it for each sentence as it comes.

One JSON request a line on stdin, one answer a line on stdout, in order:

    {"id": "7", "text": "你好！", "voice": "chen", "slow": false}
    {"id": "7", "mp3": "<base64>"}            or  {"id": "7", "error": "..."}
    {"id": "8", "warm": true, "voice": "chen"} → {"id": "8", "ok": true}

The voices are the pack's own (voices.json): the Qwen3-TTS speakers, and the
designed voices cloned from their chosen reference in design/. On an M2 a
sentence takes about as long to make as to hear, after a first load of
several seconds — which `warm` lets the server get out of the way early.

It stops when stdin closes, which is when the server exits.
"""

import base64
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")

# The answers go out on the real stdout. Everything the model libraries print
# — progress bars, notices — is sent to stderr instead, where it cannot be
# mistaken for an answer.
out = os.fdopen(os.dup(1), "w", encoding="utf-8", buffering=1)
os.dup2(2, 1)
sys.stdout = sys.stderr

import lameenc  # noqa: E402
import numpy as np  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from encode import trimmed  # noqa: E402

# As in generate.py, which is not imported because it loads torch and Kokoro.
QWEN3 = "mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16"
BASE = "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit"
STYLE = "用标准普通话，吐字清晰，声调准确，语速稍慢。"
SLOW = "用标准普通话，吐字清晰，声调准确，语速很慢，一个字一个字地说。"
DESIGN_DIR = os.path.join(HERE, "design")

with open(os.path.join(HERE, "voices.json"), encoding="utf-8") as f:
    VOICES = {v["id"]: v for v in json.load(f)}

models = {}


def model(name):
    if name not in models:
        from mlx_audio.tts.utils import load_model

        models[name] = load_model(name)
    return models[name]


def model_for(voice):
    return QWEN3 if VOICES[voice]["source"] == "qwen3" else BASE


def token_budget(text, slow):
    """A ceiling on how long the model may talk, as in generate.py: without one it now and then never stops."""
    return int(12 * ((1.0 if slow else 0.75) * len(text) + 2))


def long_enough(audio, rate, text):
    """
    Mandarin at a teacher's pace runs about a quarter of a second a character.
    Now and then the model stops after a word or two and returns something
    that sounds like a cut-off, so anything under half that is thrown away
    and tried again — and if no try is long enough, the page is told, and the
    system voice reads the sentence instead of a clipped one playing.
    """
    return len(audio) / rate >= 0.12 * max(1, len(text.strip()))


def audio_for(text, voice, slow):
    spec = VOICES[voice]
    m = model(model_for(voice))
    for temperature in (0.3, 0.6, 0.8):
        if spec["source"] == "qwen3":
            parts = m.generate_custom_voice(
                text=text,
                speaker=spec["speaker"],
                language="chinese",
                instruct=SLOW if slow else STYLE,
                temperature=temperature,
                max_tokens=token_budget(text, slow),
            )
        else:
            with open(os.path.join(DESIGN_DIR, f"{voice}.txt"), encoding="utf-8") as f:
                ref_text = f.read().strip()
            parts = m.generate(
                text=text,
                ref_audio=os.path.join(DESIGN_DIR, f"{voice}.wav"),
                ref_text=ref_text,
                lang_code="chinese",
                temperature=temperature,
                max_tokens=token_budget(text, slow),
            )
        chunks, rate = [], 24000
        for r in parts:
            chunks.append(np.asarray(r.audio, dtype=np.float32))
            rate = getattr(r, "sample_rate", rate) or rate
        audio = np.concatenate(chunks).reshape(-1) if chunks else None
        # Now and then the model returns silence; a warmer try almost always speaks.
        if audio is not None and len(audio) and np.abs(audio).max() > 0.02 and long_enough(audio, rate, text):
            return audio, rate
    return None, 24000


def mp3(audio, rate):
    pcm = (np.clip(trimmed(audio, rate), -1, 1) * 32767).astype(np.int16)
    enc = lameenc.Encoder()
    enc.set_bit_rate(48)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm.tobytes()) + enc.flush()


def answer(req):
    voice = req.get("voice")
    if voice not in VOICES or VOICES[voice]["source"] == "native":
        return {"error": f"no voice called {voice}"}
    if req.get("warm"):
        model(model_for(voice))
        return {"ok": True}
    text = (req.get("text") or "").strip()
    if not text:
        return {"error": "nothing to say"}
    audio, rate = audio_for(text, voice, bool(req.get("slow")))
    if audio is None:
        return {"error": "the model said nothing usable"}
    return {"mp3": base64.b64encode(mp3(audio, rate)).decode("ascii")}


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    req = {}
    try:
        req = json.loads(line)
        res = answer(req)
    except Exception as e:  # noqa: BLE001 — one bad request must not end the process
        res = {"error": str(e)[:300]}
    out.write(json.dumps({"id": req.get("id"), **res}) + "\n")
