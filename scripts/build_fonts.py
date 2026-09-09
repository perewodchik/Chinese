#!/usr/bin/env python3
"""
Subset the worksheet fonts down to the glyphs this project actually uses.

The full LXGW WenKai is 25 MB, which is far too much to embed in every PDF or
to ship to the browser. Everything the app can print is known ahead of time, so
we cut the font to exactly that set - typically a few thousand glyphs, well
under a megabyte.

Big practice characters are drawn from stroke outlines rather than from a font,
so the Chinese subset only has to cover supporting text: words, example
sentences, radical names and example characters.

Run after build_data.py:   python scripts/build_fonts.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "fonts")
DATA = os.path.join(ROOT, "public", "data")
OUT = os.path.join(ROOT, "public", "fonts")

UA = {"User-Agent": "Mozilla/5.0 (hanzi-workshop build script)"}

SOURCES = {
    "LXGWWenKai-Regular.ttf":
        "https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf",
    "NotoSans-Regular.ttf":
        "https://github.com/notofonts/notofonts.github.io/raw/main/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf",
    "NotoSans-SemiBold.ttf":
        "https://github.com/notofonts/notofonts.github.io/raw/main/fonts/NotoSans/hinted/ttf/NotoSans-SemiBold.ttf",
}

# Latin, digits, punctuation, pinyin tone marks and the IDS operators used in
# the decomposition diagrams.
ALWAYS = (
    " !\"#$%&'()*+,-./0123456789:;<=>?@"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`"
    "abcdefghijklmnopqrstuvwxyz{|}~"
    "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜńňǹ"
    "·—–…“”‘’•×÷°→←↑↓✓✗"
    "⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻"
    "、。，；：？！（）《》「」【】"
)


def log(*a):
    print(*a, flush=True)


def ensure(name):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name)
    if os.path.exists(p) and os.path.getsize(p) > 10000:
        return p
    log(f"  downloading {name} ...")
    req = urllib.request.Request(SOURCES[name], headers=UA)
    with urllib.request.urlopen(req, timeout=300) as r:
        open(p, "wb").write(r.read())
    return p


def collect_chars(max_hsk: int = 99) -> set[str]:
    """
    Every character the app can put on a page, outside the stroke drawings.

    `max_hsk` limits it to the bands a sheet might reach, which is how the
    smaller "core" face is cut.
    """
    s = set(ALWAYS)
    chars = json.load(open(os.path.join(DATA, "characters.json"), encoding="utf-8"))
    rads = json.load(open(os.path.join(DATA, "radicals.json"), encoding="utf-8"))

    for it in chars["items"]:
        if it.get("hsk", 1) > max_hsk:
            continue
        s.add(it["c"])
        for k in ("ids", "rad", "trad"):
            if it.get(k):
                s.update(it[k])
        for k in ("parts", "leaves", "conf"):
            for v in it.get(k) or ():
                s.update(v)
        for w in it.get("words") or ():
            s.update(w["w"])
            s.update(w["p"])
            s.update(w["d"])
        if it.get("sent"):
            s.update(it["sent"]["zh"])
            s.update(it["sent"]["en"])
        if it.get("def"):
            s.update(it["def"])
        ety = it.get("ety") or {}
        for k in ("hint", "phonetic", "semantic"):
            if ety.get(k):
                s.update(ety[k])

    for r in rads["items"]:
        s.update(r["r"])
        s.update(r["kangxi"])
        for v in r["variants"]:
            s.update(v)
        for k in ("py", "mean", "cn", "cnPy", "note"):
            if r.get(k):
                s.update(r[k])
        for e in r["ex"]:
            s.update(e)

    return {c for c in s if c and c not in "\n\r\t"}


def cut(src: str, chars: set[str], stem: str, formats=("ttf", "woff2")):
    font = TTFont(src, lazy=True)
    cmap = font.getBestCmap()
    have = {c for c in chars if ord(c) in cmap}
    dropped = len(chars) - len(have)

    for fmt in formats:
        f = TTFont(src)
        opt = subset.Options()
        # Keep kerning and mark positioning, drop ligatures: pdf-lib maps the
        # "fi" ligature glyph to no code point, which corrupts text extraction.
        opt.layout_features = ["kern", "mark", "mkmk", "ccmp", "locl"]
        opt.name_IDs = ["*"]
        opt.notdef_outline = True
        opt.recalc_bounds = True
        opt.drop_tables += ["DSIG"]
        opt.desubroutinize = fmt == "ttf"
        s = subset.Subsetter(options=opt)
        s.populate(text="".join(sorted(have)))
        s.subset(f)
        f.flavor = "woff2" if fmt == "woff2" else None
        out = os.path.join(OUT, f"{stem}.{fmt}")
        f.save(out)
        f.close()
        log(f"  {stem}.{fmt:5s} {os.path.getsize(out)/1024:8.1f} KB"
            + (f"   ({len(have)} glyphs)" if fmt == "ttf" else ""))
    if dropped:
        log(f"    ! {dropped} requested characters are not in {os.path.basename(src)}")
    font.close()


# Sheets that stay inside this band use the smaller face. pdf-lib cannot subset
# a font itself - it drops almost every CJK glyph - so whatever we embed is
# carried whole in every PDF, which is why there are two sizes rather than one.
CORE_MAX_HSK = 3


def main():
    os.makedirs(OUT, exist_ok=True)
    chars = collect_chars()
    han = {c for c in chars if "⺀" <= c <= "鿿" or "㐀" <= c <= "䶿"}
    log(f"· {len(chars)} characters needed ({len(han)} CJK)")

    log("· LXGW WenKai, everything")
    cut(ensure("LXGWWenKai-Regular.ttf"), chars, "wenkai")

    core = collect_chars(CORE_MAX_HSK)
    log(f"· LXGW WenKai, core (HSK 1-{CORE_MAX_HSK} plus radicals)")
    cut(ensure("LXGWWenKai-Regular.ttf"), core, "wenkai-core", formats=("ttf",))
    src = TTFont(ensure("LXGWWenKai-Regular.ttf"), lazy=True).getBestCmap()
    covered = sorted(ord(c) for c in core if ord(c) in src)
    with open(os.path.join(OUT, "wenkai-core.json"), "w", encoding="utf-8") as f:
        json.dump({"maxHsk": CORE_MAX_HSK, "codepoints": covered}, f,
                  separators=(",", ":"))
    log(f"  wenkai-core.json {os.path.getsize(os.path.join(OUT, 'wenkai-core.json'))/1024:8.1f} KB"
        f"   ({len(covered)} code points)")

    latin = {c for c in chars if c not in han}
    log(f"· Noto Sans (Latin, {len(latin)} glyphs)")
    cut(ensure("NotoSans-Regular.ttf"), latin, "sans")
    cut(ensure("NotoSans-SemiBold.ttf"), latin, "sans-semibold")

    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    log(f"\n  total shipped font weight: {total/1024/1024:.2f} MB")


if __name__ == "__main__":
    main()
