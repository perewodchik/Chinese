"""
A voice made from a description, rather than copied from anyone.

    .cache/tts-venv/bin/python scripts/voices/design.py <voice-id> [talk|teach]

Reads the voice's description from scripts/voices/voices.json and has
Qwen3-TTS VoiceDesign (Apache-2.0) invent a speaker to match it, reading a
short reference passage. Several candidates are made, one per temperature, in
`.cache/voices/design/`. Listen to them, pick the one that sounds like the
person, and copy it and its `.txt` into scripts/voices/design/ under the name
the script prints. Every clip in that voice is then cloned from it
(generate.py, engine "clone"), which is what keeps one voice sounding like one
person — designing each clip afresh would give a slightly different speaker
every time.

**A voice needs both references.** Cloning copies the pace and the manner as
much as the timbre, so one recording cannot serve both jobs: a conversation
partner read at a teacher's pace sounds like somebody who has forgotten how
the sentence ends, and a teacher read at conversation pace is no use for
hearing a tone land. So the same description is designed twice —

    design.py chen teach    → chen.wav       the pronunciation section, and anything asked for slowly
    design.py chen talk     → chen.talk.wav  the conversation

— and the two differ only in how fast the person is talking and what they are
saying while they do it.

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

# What each reference says, and how fast. Both passages carry every tone in
# short clauses with pauses between them, and run about ten seconds, which is
# what the cloning model wants. The teacher's is read the way a word is
# demonstrated; the talking one at the speed the learner will be answered at —
# around three characters a second, which is slower than a native conversation
# and is the point. The paces are the two bands in pace.ts, which every clip
# is then measured against.
VARIANTS = {
    "teach": {
        "suffix": "",
        "pace": "语速很慢，一个字一个字地念清楚，字与字之间留出停顿，像老师在示范每一个声调。",
        "text": "你好，我是你的中文老师。我们慢慢来，一个字一个字地说清楚。听我念：妈，麻，马，骂。声调要念准，不用着急，你跟着我再说一遍。",
    },
    "talk": {
        "suffix": ".talk",
        "pace": "语速自然平稳，像平常跟朋友聊天，比新闻播报慢一点，从头到尾保持同一个速度。",
        "text": "你好，我是你的中文练习伙伴。今天天气真好，你想出去走走吗？我们一边走一边聊，说错了也没关系，我会等你。",
    },
}


def breaths(audio: np.ndarray, rate: int) -> int:
    """
    How many times this candidate can be heard breathing.

    A breath is quieter than speech and far louder than the silence a
    generated voice leaves between clauses, and it lasts: a tenth of a second
    and up. So the stretches that sit between the two, for long enough, are
    counted. It is an estimate, not a verdict — a held 十 or a long 是 can
    look the same — but between three candidates of the same passage the one
    with the fewest is the one that is not breathing, and that matters more
    than it sounds: cloning copies the breath along with the voice, and then
    every clip breathes.

    Which is also why nothing here removes them. Mandarin's own x, sh and h
    live at exactly this level, and a gate that silenced breaths would silence
    those as well, in the one app that cannot afford to lose a consonant.
    """
    frame = int(rate * 0.01)
    if len(audio) < frame:
        return 0
    n = len(audio) // frame
    rms = np.sqrt(np.mean(audio[: n * frame].reshape(n, frame) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms / (rms.max() + 1e-12))
    between = (db > -45) & (db < -22)
    runs, length = 0, 0
    for quiet in between:
        if quiet:
            length += 1
        else:
            runs += length >= 10
            length = 0
    return runs + (length >= 10)


def main(voice_id: str, variant: str = "teach") -> None:
    spec_file = os.path.join(ROOT, "scripts", "voices", "voices.json")
    voices = json.load(open(spec_file, encoding="utf-8"))
    spec = next(v for v in voices if v["id"] == voice_id)
    how = VARIANTS[variant]
    # Who they are comes from voices.json and is the same both times; how fast
    # they are talking belongs to the job, not to the person.
    instruct = f"{spec['description']}{how['pace']}"
    name = f"{voice_id}{how['suffix']}"
    out_dir = os.path.join(ROOT, ".cache", "voices", "design")
    os.makedirs(out_dir, exist_ok=True)

    from mlx_audio.tts.utils import load_model

    model = load_model(MODEL)
    for n, temperature in enumerate((0.6, 0.8, 0.9), 1):
        chunks, rate = [], 24000
        for r in model.generate_voice_design(
            text=how["text"], instruct=instruct, language="chinese", temperature=temperature
        ):
            chunks.append(np.asarray(r.audio, dtype=np.float32))
            rate = getattr(r, "sample_rate", rate) or rate
        audio = np.concatenate(chunks) if chunks else np.zeros(1, dtype=np.float32)
        path = os.path.join(out_dir, f"{name}-{n}.wav")
        sf.write(path, audio.reshape(-1), rate, subtype="PCM_16")
        seconds = len(audio) / rate
        chars = sum(1 for c in how["text"] if "㐀" <= c <= "鿿")
        print(
            f"  {path}  {seconds:.1f}s  {chars / seconds:.1f} characters a second"
            f"  peak {np.abs(audio).max():.2f}  breaths ~{breaths(audio.reshape(-1), rate)}",
            flush=True,
        )
    with open(os.path.join(out_dir, f"{name}.txt"), "w", encoding="utf-8") as f:
        f.write(how["text"])
    print("\n  Listen, then keep the one that sounds like the person:")
    print(f"    cp .cache/voices/design/{name}-2.wav scripts/voices/design/{name}.wav")
    print(f"    cp .cache/voices/design/{name}.txt  scripts/voices/design/{name}.txt")
    print("  The two numbers to go on: the pace, which every clip will be read at,")
    print("  and the breaths, which every clip will take with it.")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "teach")
