#!/usr/bin/env python3
"""
Build src/data/mouth.json: side views of the mouth for the sounds that are
hard, from real phonetics diagrams — not drawn from imagination.

Two series from Wikimedia Commons, each consistent within itself:

  Tavin's "articulation" diagrams (CC BY-SA 4.0), facing left:
    x   Voiceless alveolo-palatal fricative   — j q x
    sh  Voiceless retroflex fricative         — zh ch sh r
    s   Voiceless alveolar fricative          — z c s
  Richard Wright and Dan McCloy's sagittal sections (CC0), facing right:
    n   IPA n    — -n
    ng  IPA ŋ    — -ng
    i   IPA i    — i, and the tongue of ü
    u   IPA u    — u, and the lips of ü

Within a series only the tongue changes from one sound to the next, which is
the point: the app draws every other line faint and the tongue in the colour
of pronunciation. Each diagram keeps the paths as they are, cropped to the
mouth.

Downloads into .cache/mouth/ (slowly — upload.wikimedia.org rate-limits).
Run: python3 scripts/mouth/build.py
"""

import html
import json
import os
import re
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, ".cache", "mouth")
OUT = os.path.join(ROOT, "src", "data", "mouth.json")
UA = {"User-Agent": "HanziWorkshop/1.0 (personal Chinese study app)"}

TAVIN = {"tongue": 0, "view": "0 -40 400 440", "faces": "left"}
MCCLOY = {"tongue": 4, "view": "95 72 88 80", "faces": "right"}

DIAGRAMS = {
    "x": ("Voiceless alveolo-palatal fricative articulation.svg", TAVIN),
    "sh": ("Voiceless retroflex fricative articulation.svg", TAVIN),
    "s": ("Voiceless alveolar fricative articulation.svg", TAVIN),
    "n": ("IPA n Sagittal Section.svg", MCCLOY),
    "ng": ("IPA ŋ Sagittal Section.svg", MCCLOY),
    "i": ("IPA i Sagittal Section.svg", MCCLOY),
    "u": ("IPA u Sagittal Section.svg", MCCLOY),
}


def plain(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def main():
    os.makedirs(CACHE, exist_ok=True)
    q = urllib.parse.urlencode({
        "action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata",
        "titles": "|".join("File:" + f for f, _ in DIAGRAMS.values()),
    })
    pages = json.load(urllib.request.urlopen(urllib.request.Request(
        "https://commons.wikimedia.org/w/api.php?" + q, headers=UA)))["query"]["pages"]
    info = {p["title"][5:]: p["imageinfo"][0] for p in pages.values() if p.get("imageinfo")}

    out = {}
    for key, (name, series) in DIAGRAMS.items():
        ii = info[name]
        path = os.path.join(CACHE, f"{key}.svg")
        if not os.path.exists(path) or os.path.getsize(path) == 0:
            time.sleep(4)
            with open(path, "wb") as f:
                f.write(urllib.request.urlopen(urllib.request.Request(ii["url"], headers=UA)).read())
        svg = open(path, encoding="utf-8").read()
        ds = re.findall(r'\sd="([^"]+)"', svg)
        meta = ii["extmetadata"]
        out[key] = {
            "view": series["view"],
            "faces": series["faces"],
            "paths": [{"d": d, **({"tongue": True} if i == series["tongue"] else {})} for i, d in enumerate(ds)],
            "credit": {
                "by": plain(meta.get("Artist", {}).get("value")),
                "license": plain(meta.get("LicenseShortName", {}).get("value")),
                "source": ii["descriptionurl"],
            },
        }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT}: {len(out)} diagrams, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
