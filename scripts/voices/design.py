"""
A voice made from a description, rather than copied from anyone.

    .cache/tts-venv/bin/python scripts/voices/design.py <voice-id> [talk|teach]
    .cache/tts-venv/bin/python scripts/voices/design.py <voice-id> [talk|teach] --keep 2

Reads the voice's description from scripts/voices/voices.json and has
Qwen3-TTS VoiceDesign (Apache-2.0) invent a speaker to match it, reading a
short reference passage. Several candidates are made, one per temperature, in
`.cache/voices/design/` as `<name>-1.wav`, `-2` and `-3`. Listen to them and
file the one that sounds like the person with `--keep <n>`, which is that
number and designs nothing new. Every clip in that voice is then cloned from it
(generate.py, engine "clone"), which is what keeps one voice sounding like one
person — designing each clip afresh would give a slightly different speaker
every time.

**The recording and its transcript are kept together, by this script**, and
never copied by hand. Cloning is conditioned on both: the model is told what
the reference says, and lines it up against what the reference sounds like.
Hand them a transcript from a different recording and the alignment is
nonsense — the voice drifts, invents syllables, and reads pieces of the
transcript it was given instead of the sentence it was asked for. That is
precisely what happened here: `chen.wav` was designed again, `chen.txt` was
left behind, and for two months every clip in the pack and every slow reading
was cloned from a recording the model had been told said something else.
`references.json` records what each recording says, and both the build and the
live voice refuse a reference whose file no longer matches it.

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

import hashlib
import json
import os
import shutil
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


def keep(name: str, candidate: int, out_dir: str, design_dir: str) -> None:
    """
    Puts the chosen candidate where the pack and the conversation look for it,
    with its transcript and a note of what it says — all three in one step,
    because the failure this prevents is a pair that drifts apart.

    The transcript is the one the run that made this candidate wrote down, not
    whatever the script would say today: keeping a recording from Tuesday with
    Wednesday's passage is the whole bug again.
    """
    src = os.path.join(out_dir, f"{name}-{candidate}.wav")
    said = os.path.join(out_dir, f"{name}.txt")
    if not os.path.exists(src) or not os.path.exists(said):
        raise SystemExit(
            f"there is no {os.path.basename(src)} to keep."
            f" Run design.py without --keep first, listen to the candidates, then keep one of them."
        )
    with open(said, encoding="utf-8") as f:
        text = f.read().strip()
    wav = os.path.join(design_dir, f"{name}.wav")
    shutil.copyfile(src, wav)
    with open(os.path.join(design_dir, f"{name}.txt"), "w", encoding="utf-8") as f:
        f.write(text)
    manifest = os.path.join(design_dir, "references.json")
    known = json.load(open(manifest, encoding="utf-8")) if os.path.exists(manifest) else {}
    known[name] = {"sha256": hashlib.sha256(open(wav, "rb").read()).hexdigest(), "text": text}
    with open(manifest, "w", encoding="utf-8") as f:
        json.dump(known, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"  kept {src}\n  → {wav}, the transcript it was read from, and its line in references.json")


def main(voice_id: str, variant: str = "teach", keeping: int | None = None) -> None:
    spec_file = os.path.join(ROOT, "scripts", "voices", "voices.json")
    voices = json.load(open(spec_file, encoding="utf-8"))
    spec = next(v for v in voices if v["id"] == voice_id)
    how = VARIANTS[variant]
    # Who they are comes from voices.json and is the same both times; how fast
    # they are talking belongs to the job, not to the person.
    instruct = f"{spec['description']}{how['pace']}"
    name = f"{voice_id}{how['suffix']}"
    out_dir = os.path.join(ROOT, ".cache", "voices", "design")
    design_dir = os.path.join(ROOT, "scripts", "voices", "design")
    os.makedirs(out_dir, exist_ok=True)

    # Keeping is filing what was already made and listened to. It designs
    # nothing: three fresh candidates would be three the ear has never heard,
    # and the number would point at somebody else.
    if keeping:
        keep(name, keeping, out_dir, design_dir)
        return

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
    print(f"    design.py {voice_id} {variant} --keep 2")
    print("  The two numbers to go on: the pace, which every clip will be read at,")
    print("  and the breaths, which every clip will take with it.")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    chosen = int(sys.argv[sys.argv.index("--keep") + 1]) if "--keep" in sys.argv else None
    main(args[0], args[1] if len(args) > 1 else "teach", chosen)
