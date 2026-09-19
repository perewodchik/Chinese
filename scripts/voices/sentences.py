"""
Sentences to shadow: short, everyday, with a translation, and written only in
characters the syllabus teaches.

    .cache/tts-venv/bin/python scripts/voices/sentences.py

Taken from Tatoeba, whose sentences are CC BY 2.0 FR — the same source the
example sentences on the worksheets come from. Tatoeba's own Mandarin
*recordings* are not used: almost all of them carry no licence that allows
reuse outside the site, so the sentences are voiced here instead (build.ts).

Writes .cache/voices/sentences.json, which build.ts reads.
"""

import bz2
import json
import os
import re
import sys
import urllib.request

from pypinyin import Style, lazy_pinyin

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TATOEBA = os.path.join(ROOT, ".cache", "tatoeba")
OUT = os.path.join(ROOT, ".cache", "voices", "sentences.json")

HAN = re.compile(r"[一-鿿]")
# Anything but Han characters and ordinary Chinese punctuation is a sentence
# about something a learner cannot say yet: numbers in digits, Latin names.
ALLOWED = re.compile(r"^[一-鿿，。！？、：；“”‘’]+$")

MAX_HSK = 3
MIN_LEN, MAX_LEN = 4, 16
LIMIT = 300


EXPORTS = "https://downloads.tatoeba.org/exports/per_language"


def tsv(name):
    path = os.path.join(TATOEBA, name)
    if not os.path.exists(path):
        # Fetched once and kept in .cache: cmn_sentences.tsv → cmn/cmn_sentences.tsv.bz2
        lang = name.split("_")[0].split("-")[0]
        os.makedirs(TATOEBA, exist_ok=True)
        print(f"  downloading {name}", flush=True)
        with urllib.request.urlopen(f"{EXPORTS}/{lang}/{name}.bz2") as r:
            open(path, "wb").write(bz2.decompress(r.read()))
    with open(path, encoding="utf-8") as f:
        for line in f:
            yield line.rstrip("\n").split("\t")


def main():
    chars = json.load(open(os.path.join(ROOT, "public", "data", "characters.json"), encoding="utf-8"))["items"]
    band = {c["c"]: c["hsk"] for c in chars}
    themes = json.load(open(os.path.join(ROOT, "public", "data", "themes.json"), encoding="utf-8"))["items"]

    cmn = {row[0]: row[2] for row in tsv("cmn_sentences.tsv")}
    links = {}
    for row in tsv("cmn-eng_links.tsv"):
        links.setdefault(row[0], []).append(row[1])
    wanted = {e for ids in links.values() for e in ids}
    eng = {row[0]: row[2] for row in tsv("eng_sentences.tsv") if row[0] in wanted}

    seen = set()
    picked = []
    for sid, text in cmn.items():
        text = text.strip()
        if not ALLOWED.match(text):
            continue
        han = HAN.findall(text)
        if not (MIN_LEN <= len(han) <= MAX_LEN):
            continue
        if any(ch not in band for ch in han):
            continue  # traditional characters, or beyond the syllabus
        level = max(band[ch] for ch in han)
        if level > MAX_HSK:
            continue
        english = next((eng[e] for e in links.get(sid, []) if e in eng), None)
        if not english:
            continue
        key = re.sub(r"[，。！？、：；“”‘’]", "", text)
        if key in seen:
            continue
        seen.add(key)
        py = lazy_pinyin("".join(han), style=Style.TONE, neutral_tone_with_five=False)
        if len(py) != len(han):
            continue
        topics = [t["id"] for t in themes if sum(ch in t["items"] for ch in set(han)) >= 2]
        picked.append(
            {
                "id": int(sid),
                "zh": text,
                "py": " ".join(py),
                "en": english,
                "hsk": level,
                "len": len(han),
                "topics": topics,
            }
        )

    # Easiest first, then shortest; a learner at HSK 1 gets a full shelf of
    # things they can actually read before anything reaches for band 3.
    picked.sort(key=lambda s: (s["hsk"], s["len"], s["id"]))
    by_band = {b: [s for s in picked if s["hsk"] == b] for b in range(1, MAX_HSK + 1)}
    share = {1: 0.4, 2: 0.35, 3: 0.25}
    out = []
    for b, rows in by_band.items():
        # Spread across lengths rather than taking the shortest few hundred.
        n = int(LIMIT * share[b])
        step = max(1, len(rows) / max(1, n))
        out += [rows[int(i * step)] for i in range(min(n, len(rows)))]
    out.sort(key=lambda s: (s["hsk"], s["len"], s["id"]))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"{len(picked)} usable, {len(out)} kept: " + ", ".join(f"HSK{b} {sum(s['hsk'] == b for s in out)}" for b in by_band))
    for s in out[:5] + out[-3:]:
        print(" ", s["zh"], "|", s["py"], "|", s["en"], s["topics"])


if __name__ == "__main__":
    sys.exit(main())
