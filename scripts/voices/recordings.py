"""
Real people saying the words and sentences, fetched from where they were
given away.

    .cache/tts-venv/bin/python scripts/voices/recordings.py wanted.json
    .cache/tts-venv/bin/python scripts/voices/recordings.py wanted.json --refresh

build.ts runs it; `wanted.json` is every word the pronunciation section says.
Two sources, both recorded by native speakers and both under a licence that
allows this:

- **Wikimedia Commons** for words: the Lingua Libre recordings in Mandarin
  (`LL-Q9192 (cmn)-<speaker>-<word>.wav`, CC BY-SA 4.0 or CC0) and the older
  `Zh-<pinyin>.ogg` files, most of them Wei Gao's for the Shtooka project
  (CC BY 2.0 FR). A word is looked up by its characters and by its pinyin, and
  every speaker who said it is kept: hearing a tone pair in several voices is
  what teaches the ear which part is the tone and which part is the person.
- **The sentences in `shadowing.json`**, chosen by hand, each one a recording
  on Commons or on Tatoeba. Tatoeba's recordings are only used where the
  speaker has licensed them (CC BY-NC 4.0) — most of its Mandarin audio has no
  licence at all and is left alone.

Nothing is judged here. Everything is downloaded once into
`.cache/voices/recordings/`, decoded to 16-bit mono WAV (what the tone check
reads), and listed in `.cache/voices/recordings.json` with who said it and on
what terms. build.ts decides what to keep.
"""

import hashlib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

import numpy as np
import soundfile as sf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORK = os.path.join(ROOT, ".cache", "voices", "recordings")
ORIGINALS = os.path.join(WORK, "originals")
WAV = os.path.join(WORK, "wav")
INDEX = os.path.join(WORK, "commons-index.json")
OUT = os.path.join(ROOT, ".cache", "voices", "recordings.json")
SHADOWING = os.path.join(ROOT, "scripts", "voices", "shadowing.json")

UA = {"User-Agent": "HanziWorkshop/1.0 (https://github.com/perewodchik/Chinese; voice pack build, one file at a time)"}
COMMONS = "https://commons.wikimedia.org/w/api.php"
LL = re.compile(r"^File:LL-Q9192 \(cmn\)-(.+?)-(.+)\.(wav|ogg|oga|flac|mp3)$")
ZH = re.compile(r"^File:(?:Zh|Cmn)-(.+)\.(ogg|oga|wav|flac|mp3)$")

# Uploaders whose Mandarin is a learner's, or who cannot be told apart from
# one: a reference that is not a native speaker's is no reference.
NOT_NATIVE = {"Provoost", "Karmosin~commonswiki"}

# The names the speakers are credited under, shortened for a chip.
NAMES = {
    "Wei Gao": "Wei Gao",
    "Luilui6666": "Luilui",
    "雲角": "Yunjiao",
    "Vickylin77amis": "Vicky",
    "Levi Highway": "Levi",
    "Wang Cheng": "Wang Cheng",
    "Jun Da": "Jun Da",
}


def get(url, tries=8):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            # Wikimedia asks a script to slow down rather than refusing it, and
            # usually says for how long.
            if e.code in (429, 503) and i + 1 < tries:
                wait = e.headers.get("Retry-After")
                pause = int(wait) if wait and wait.isdigit() else min(120, 10 * 2**i)
                print(f"  asked to slow down; waiting {pause}s", flush=True)
                time.sleep(pause)
                continue
            raise


def api(**params):
    time.sleep(0.3)
    return json.loads(get(f"{COMMONS}?{urllib.parse.urlencode({**params, 'format': 'json'})}"))


def commons_titles(refresh):
    """Every Mandarin recording on Commons worth looking in, kept for a month."""
    if not refresh and os.path.exists(INDEX) and time.time() - os.path.getmtime(INDEX) < 30 * 86400:
        return json.load(open(INDEX, encoding="utf-8"))
    titles = []
    cont = {}
    while True:
        d = api(action="query", list="categorymembers", cmtitle="Category:Lingua_Libre_pronunciation-cmn",
                cmlimit="500", cmtype="file", **cont)
        titles += [m["title"] for m in d["query"]["categorymembers"]]
        if "continue" not in d:
            break
        cont = d["continue"]
    for prefix in ("Zh-", "Cmn-"):
        cont = {}
        while True:
            d = api(action="query", list="allpages", apnamespace="6", apprefix=prefix, aplimit="500", **cont)
            titles += [m["title"] for m in d["query"]["allpages"]]
            if "continue" not in d:
                break
            cont = d["continue"]
    os.makedirs(WORK, exist_ok=True)
    json.dump(titles, open(INDEX, "w", encoding="utf-8"), ensure_ascii=False)
    return titles


def key(s):
    return unicodedata.normalize("NFC", s).lower().replace(" ", "").replace("_", "")


def details(titles):
    """Where each file is, who said it, and on what licence — fifty at a time."""
    out = {}
    titles = sorted(set(titles))
    for i in range(0, len(titles), 50):
        d = api(action="query", prop="imageinfo", iiprop="url|user|extmetadata", titles="|".join(titles[i : i + 50]))
        for p in d["query"]["pages"].values():
            info = (p.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            text = lambda k: re.sub(r"<[^>]+>", "", meta.get(k, {}).get("value", "")).strip()  # noqa: E731
            artist = text("Artist")
            # Lingua Libre writes "Speaker: X Recorder: Y"; the speaker is the voice.
            m = re.search(r"Speaker:\s*(.+?)\s*(?:Recorder:|$)", artist, re.S)
            speaker = (m.group(1) if m else artist.split(",")[0]).strip()
            out[p["title"]] = {
                "url": info.get("url"),
                "page": info.get("descriptionurl"),
                "user": info.get("user"),
                "speaker": speaker or info.get("user") or "unknown",
                "license": text("LicenseShortName"),
            }
    return out


def digest(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower())
    return s.strip("-") or f"speaker-{digest(name)[:6]}"


def decode(src, dst):
    """Any of the formats Commons and Tatoeba use, as 16-bit mono WAV."""
    if os.path.exists(dst):
        return True
    try:
        audio, rate = sf.read(src, dtype="float32")
    except Exception as e:  # noqa: BLE001 — one unreadable file must not stop the rest
        print(f"  cannot read {os.path.basename(src)}: {e}", flush=True)
        return False
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    peak = float(np.abs(audio).max()) if len(audio) else 0.0
    if peak < 0.01:
        print(f"  {os.path.basename(src)} is silent", flush=True)
        return False
    # Levelled to the same peak, so switching speakers is not switching volume.
    audio = audio * (0.9 / peak)
    sf.write(dst, audio, rate, subtype="PCM_16")
    return True


def fetch(url, name):
    """
    One file, once. A file that still cannot be had after all the waiting is
    skipped rather than ending the run: the next run fetches only what is
    missing, so it can simply be run again.
    """
    path = os.path.join(ORIGINALS, name)
    if not os.path.exists(path):
        try:
            data = get(url)
        except Exception as e:  # noqa: BLE001
            print(f"  could not fetch {url}: {e}", flush=True)
            return None
        with open(path, "wb") as f:
            f.write(data)
        # One at a time and unhurried: the media servers limit scripts
        # far more tightly than the API does.
        time.sleep(1.0)
    return path


def main(wanted_file, refresh=False):
    os.makedirs(ORIGINALS, exist_ok=True)
    os.makedirs(WAV, exist_ok=True)
    wanted = json.load(open(wanted_file, encoding="utf-8"))
    shadowing = json.load(open(SHADOWING, encoding="utf-8"))

    titles = commons_titles(refresh)
    by_text = {}
    for t in titles:
        m = LL.match(t)
        if m:
            by_text.setdefault(key(m.group(2)), []).append(t)
            continue
        m = ZH.match(t)
        if m:
            by_text.setdefault(key(m.group(1)), []).append(t)

    matches = {}
    for w in wanted:
        found = by_text.get(key(w["text"]), []) + (by_text.get(key(w["reading"]), []) if w.get("reading") else [])
        if found:
            matches[w["text"]] = sorted(set(found))
    sentence_titles = [s["source"]["file"] for s in shadowing if s["source"]["kind"] == "commons"]
    info = details([t for ts in matches.values() for t in ts] + sentence_titles)

    speakers = {}

    def speaker_of(name, license_, source, page):
        sid = slug(NAMES.get(name, name))
        sp = speakers.setdefault(sid, {"id": sid, "name": NAMES.get(name, name), "credit": name, "licenses": [],
                                       "source": source, "page": page})
        if license_ and license_ not in sp["licenses"]:
            sp["licenses"].append(license_)
        return sid

    words = []
    for text, ts in matches.items():
        for t in ts:
            meta = info.get(t)
            if not meta or not meta["url"] or meta["user"] in NOT_NATIVE:
                continue
            ext = os.path.splitext(meta["url"])[1]
            original = fetch(meta["url"], f"{digest(t)}{ext}")
            if not original:
                continue
            wav = os.path.join(WAV, os.path.splitext(os.path.basename(original))[0] + ".wav")
            if not decode(original, wav):
                continue
            sid = speaker_of(meta["speaker"], meta["license"], "Wikimedia Commons", None)
            words.append({"text": text, "speaker": sid, "wav": wav, "file": t, "page": meta["page"],
                          "license": meta["license"]})

    sentences = []
    for s in shadowing:
        src = s["source"]
        if src["kind"] == "commons":
            meta = info.get(src["file"])
            if not meta or not meta["url"]:
                print(f"  {src['file']} is not on Commons any more", flush=True)
                continue
            url, page, lic, who = meta["url"], meta["page"], meta["license"], meta["speaker"]
            where = "Wikimedia Commons"
        else:
            url = f"https://tatoeba.org/audio/download/{src['audio']}"
            page = f"https://tatoeba.org/en/sentences/show/{src['sentence']}"
            lic, who, where = src["license"], src["speaker"], "Tatoeba"
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".mp3"
        original = fetch(url, f"sentence-{digest(s['zh'])}{ext}")
        if not original:
            continue
        wav = os.path.join(WAV, os.path.splitext(os.path.basename(original))[0] + ".wav")
        if not decode(original, wav):
            continue
        sid = speaker_of(who, lic, where, None)
        sentences.append({**{k: v for k, v in s.items() if k != "source"}, "speaker": sid, "wav": wav, "page": page,
                          "license": lic})

    json.dump({"speakers": list(speakers.values()), "words": words, "sentences": sentences},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"  {len(words)} word recordings of {len({w['text'] for w in words})} words,"
          f" {len(sentences)} sentences, {len(speakers)} speakers", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], "--refresh" in sys.argv)
