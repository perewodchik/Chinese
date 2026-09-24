#!/usr/bin/env python3
"""
Ship the word pictures: the chosen photo for every concept, and the manifest.

Reads the candidates scripts/images/fetch.py saved under .cache/images/, and
scripts/images/picks.json — which candidate to use for each concept, by slug:
a number picks that candidate, -1 means none of them fits and the concept goes
without. A concept missing from picks.json takes its first candidate.

Writes:
  public/images/words/<slug>.jpg   each picture, at most 440px on its long side
  public/images/words/CREDITS.md   author, licence and source of every one
  src/data/pictures.json           word -> picture, and its literal parts:
                                     "火车": { "img": "train", "parts": [["火","fire","fire"], ["车","car","car"]] }
                                   imported by the app, so which words have a
                                   picture is known before any image loads.

Resizing uses `sips`, which every Mac has — no Python packages needed.

Run: python3 scripts/images/build.py
"""

import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from fetch import CACHE, DOWNLOAD_EVERY, THUMB, get, slug  # noqa: E402

OUT = os.path.join(ROOT, "public", "images", "words")
MANIFEST = os.path.join(ROOT, "src", "data", "pictures.json")
EDGE = 440
# Candidates are fetched small, to be chosen between; the one chosen is
# fetched again at this width, which is sharp in the drawer on an iPad.
SHIP_THUMB = 500


def dims(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path], capture_output=True, text=True).stdout
    return int(out.split("pixelWidth:")[1].split()[0]), int(out.split("pixelHeight:")[1].split()[0])


def load(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        d = json.load(f)
    d.pop("_", None)
    return d


def main():
    words = load("words.json")
    parts_map = load("parts.json")
    picks = load("picks.json") if os.path.exists(os.path.join(HERE, "picks.json")) else {}

    os.makedirs(OUT, exist_ok=True)
    shipped = {}  # slug -> credit

    def ship(query):
        s = slug(query)
        if s in shipped:
            return s if shipped[s] else None
        meta = os.path.join(CACHE, s, "candidates.json")
        if not os.path.exists(meta):
            shipped[s] = None
            return None
        cands = json.load(open(meta, encoding="utf-8"))["candidates"]
        i = picks.get(s, 0)
        if i is None or i < 0 or i >= len(cands):
            shipped[s] = None
            return None
        c = cands[i]
        src = os.path.join(CACHE, s, f"ship-{i}.jpg")
        if not os.path.exists(src):
            big = c["thumb"].replace(f"/{THUMB}px-", f"/{SHIP_THUMB}px-")
            try:
                data = get(big, binary=True, polite=DOWNLOAD_EVERY) if big != c["thumb"] else None
            except Exception:
                data = None
            if data:
                with open(src, "wb") as f:
                    f.write(data)
            else:
                src = os.path.join(CACHE, c["local"])
        dst = os.path.join(OUT, f"{s}.jpg")
        tmp = dst + ".tmp.jpg"
        shutil.copyfile(src, tmp)
        # never enlarge: a candidate kept at its small size stays that size
        resize = ["-Z", str(EDGE)] if max(dims(tmp)) > EDGE else []
        subprocess.run(
            ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "62", *resize, tmp, "--out", dst],
            check=True, capture_output=True,
        )
        os.remove(tmp)
        w, h = dims(dst)
        shipped[s] = {"query": query, "w": w, "h": h, **{k: c[k] for k in ("file", "page", "artist", "license", "licenseUrl")}}
        return s

    manifest_words = {}
    for w, v in words.items():
        entry = {}
        if v[0]:
            s = ship(v[0])
            if s:
                entry["img"] = s
        if len(v) > 1:
            glosses = v[1].split("+")
            if len(glosses) != len(w):
                raise SystemExit(f"{w}: {len(glosses)} parts for {len(w)} characters")
            parts = []
            for ch, g in zip(w, glosses):
                q = parts_map.get(g)
                s = ship(q) if q else None
                parts.append([ch, g] + ([s] if s else []))
            entry["parts"] = parts
        if entry:
            manifest_words[w] = entry

    pictures = {s: {"w": c["w"], "h": c["h"], "by": c["artist"], "lic": c["license"], "src": c["page"]}
                for s, c in shipped.items() if c}
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "pictures": pictures, "words": manifest_words}, f, ensure_ascii=False,
                  separators=(",", ":"))

    # drop pictures no longer chosen
    keep = {f"{s}.jpg" for s in pictures}
    for name in os.listdir(OUT):
        if name.endswith(".jpg") and name not in keep:
            os.remove(os.path.join(OUT, name))

    lines = [
        "# Word pictures — credits",
        "",
        "Photos from Wikimedia Commons (found through Wikidata and Commons search by",
        "`scripts/images/fetch.py`), resized. Each is used under the licence named here;",
        "follow the link for the original and its full terms.",
        "",
        "| Picture | For | Author | Licence | Source |",
        "|---|---|---|---|---|",
    ]
    for s, c in sorted(shipped.items()):
        if not c:
            continue
        author = c["artist"].replace("|", "/").replace("\n", " ")
        lic = f"[{c['license']}]({c['licenseUrl']})" if c["licenseUrl"] else c["license"]
        lines.append(f"| `{s}.jpg` | {c['query']} | {author} | {lic} | [{c['file']}]({c['page']}) |")
    with open(os.path.join(OUT, "CREDITS.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    size = sum(os.path.getsize(os.path.join(OUT, n)) for n in os.listdir(OUT) if n.endswith(".jpg"))
    with_img = sum(1 for e in manifest_words.values() if "img" in e)
    print(f"{len(pictures)} pictures ({size // 1024} KB), {with_img} words with a picture, "
          f"{sum(1 for e in manifest_words.values() if 'parts' in e)} compounds -> {MANIFEST}")


if __name__ == "__main__":
    main()
