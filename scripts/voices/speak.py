"""
Reads Mandarin aloud on request, for as long as the server that started it runs.

    .cache/tts-venv/bin/python scripts/voices/speak.py

The voice pack (generate.py) reads a fixed list of words ahead of time. A
conversation cannot be read ahead of time: Claude's answer exists only once
it has been written. So the home server keeps this process running beside
it, with the models loaded once, and asks it for each sentence as it comes.

One JSON request a line on stdin, one answer a line on stdout, in order:

    {"id": "7", "text": "你好！", "voice": "chen", "mode": "conversation"}
    {"id": "7", "mp3": "<base64>"}            or  {"id": "7", "error": "..."}
    {"id": "8", "warm": true, "voice": "chen"} → {"id": "8", "ok": true}

The voices are the pack's own (voices.json): a designed voice is cloned from
its chosen reference in design/, a model speaker read as it comes. On an M2 a
sentence takes about as long to make as to hear, after a first load of
several seconds — which `warm` lets the server get out of the way early.

It stops when stdin closes, which is when the server exits.
"""

import base64
import hashlib
import json
import os
import re
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


def reference(voice, mode):
    """
    Which recording of a designed voice to clone from.

    The conversation clones from `<id>.talk.wav` in every mode, and from
    `<id>.wav` only where a voice has no talking recording at all.

    It used to pick per mode — the teaching recording for the slow modes,
    since cloning carries pace and manner along with the timbre, and a teacher
    is what the slow modes want. That traded away the one thing a voice cannot
    be wrong about. The two recordings are separate takes from a description,
    and nothing makes them the same person: Chen's teaching take came out at
    185 Hz against the talking take's 149 Hz, so choosing Guided or Normal
    swapped him for a woman mid-conversation. Timbre is the identity and pace
    is a setting, so the identity wins here and pace is asked for in the text
    instead — `spread` puts the pauses in as punctuation, which is a slowness
    the model performs rather than one cloned from a stranger.
    """
    talking = os.path.join(DESIGN_DIR, f"{voice}.talk.wav")
    base = os.path.join(DESIGN_DIR, f"{voice}.wav")
    return (f"{voice}.talk", talking) if os.path.exists(talking) else (voice, base)


def transcript(name, wav):
    """
    What that recording says — checked, not assumed.

    The model is given the reference audio and what it says, and lines the two
    up to work out how this speaker sounds. A transcript from a different
    recording makes the alignment nonsense: the voice drifts, invents
    syllables, and reads pieces of the transcript instead of the sentence it
    was asked for. It is invisible from the outside — two files that both
    exist, one of them wrong — so `references.json` records what each
    recording is, and a reference that no longer matches is refused here
    rather than read out.
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
                raise RuntimeError(
                    f"{name}: the reference recording and its transcript do not match what design.py kept."
                    " Design it again (design.py <voice> <variant> --keep <n>) rather than copying files by hand."
                )
    return text


def token_budget(text, mode):
    """
    A ceiling on how long the model may talk, as in generate.py: without one
    it now and then never stops. It is the mode's own slowest reading plus a
    little, so a budget can never be the thing that cuts a sentence short.
    """
    return int(12 * (MODES[mode]["band"][1] * len(text) + 2))


# What each mode asks for: which recording of the voice to clone from, whether
# the sentence is handed over a character at a time, and how long a character
# should then take. The bands are the ones in scripts/voices/pace.ts, which
# the pack is gated on and which says where they come from; written out here
# rather than imported, as the model names are.
# The lower bounds are looser than the pack's, because every mode now clones
# from the talking recording (see `reference`) and so starts from a talking
# pace. A clip that lands at the quick end is not a bad clip here — the page
# slows the modes that want slowing on the way out — but one that races or
# stalls still is, which is what the band is for.
MODES = {
    "breakdown": {"teacher": True, "apart": True, "band": (0.30, 1.80)},
    "teaching": {"teacher": True, "apart": False, "band": (0.22, 1.10)},
    # 0.17 at the quick end: a short question said at five characters a
    # second is a clear, ordinary reading, and turning it down sent whole
    # lines to the system voice. The blurs worth refusing come in near 0.13.
    "conversation": {"teacher": False, "apart": False, "band": (0.17, 0.60)},
    # Skim is this reading played faster by the page; what is made here is the
    # ordinary one.
    "skim": {"teacher": False, "apart": False, "band": (0.17, 0.60)},
}
ENDS = 0.35
HAN = re.compile(r"[\u3400-\u9fff]")


def spread(text):
    """
    The sentence a character at a time, for breakdown mode.

    A pause is not a speed: asking a model to read slowly gives you the same
    run-together reading stretched, where what is wanted is each character
    said and then left alone for a moment. Punctuation is how you ask for
    that, so the pause goes into the text — a comma between characters, and
    whatever punctuation was already there kept where it was.
    """
    out = []
    for c in text:
        if HAN.match(c):
            if out and out[-1] not in "，。！？、；：":
                out.append("，")
            out.append(c)
        else:
            out.append(c)
    return "".join(out)


def paced(audio, rate, text, mode):
    """
    Whether that is somebody talking, or the model having lost the thread.

    Asked for the same sentence twice it will spend twelve seconds on one and
    seven tenths of a second on the other. Both are audio; only one is speech.
    A clip outside the band for the pace being asked for is said again, and if
    no try lands in it the page is told, so the system voice reads the
    sentence rather than a blur playing in a voice the learner trusts.
    """
    chars = len(HAN.findall(text))
    if not chars:
        return True
    least, most = MODES[mode]["band"]
    seconds = len(audio) / rate
    if os.environ.get("SPEAK_DEBUG"):
        print(f"pace {text} {seconds / chars:.2f} s/char", file=sys.stderr, flush=True)
    return least * chars <= seconds <= most * chars + ENDS


def audio_for(text, voice, mode):
    spec = VOICES[voice]
    m = model(model_for(voice))
    said = spread(text) if MODES[mode]["apart"] else text
    # Low first and barely warmer after: every degree of temperature is a
    # degree of the model wandering off the sentence, and a wandered clip is
    # not a slower reading, it is a different one.
    for temperature in (0.25, 0.4, 0.55):
        if spec["source"] == "qwen3":
            parts = m.generate_custom_voice(
                text=said,
                speaker=spec["speaker"],
                language="chinese",
                instruct=SLOW if MODES[mode]["teacher"] else STYLE,
                temperature=temperature,
                max_tokens=token_budget(said, mode),
            )
        else:
            name, ref = reference(voice, mode)
            ref_text = transcript(name, ref)
            parts = m.generate(
                text=said,
                ref_audio=ref,
                ref_text=ref_text,
                lang_code="chinese",
                temperature=temperature,
                max_tokens=token_budget(said, mode),
            )
        chunks, rate = [], 24000
        for r in parts:
            chunks.append(np.asarray(r.audio, dtype=np.float32))
            rate = getattr(r, "sample_rate", rate) or rate
        audio = np.concatenate(chunks).reshape(-1) if chunks else None
        # Now and then the model returns silence; a warmer try almost always speaks.
        # The pace is judged on the speech, not on the silence around it —
        # the same length `mp3` below will keep.
        if audio is not None and len(audio) and np.abs(audio).max() > 0.02 and paced(trimmed(audio, rate), rate, text, mode):
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
    mode = req.get("mode") if req.get("mode") in MODES else "conversation"
    audio, rate = audio_for(text, voice, mode)
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
