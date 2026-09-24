#!/usr/bin/env python3
"""
Build public/data/families.json: how every radical grows into characters.

For each of the 214 radicals, every syllabus character that has the radical
somewhere inside it, and the path it takes to get there: 口 → 吾 → 语 says that
语 is 讠 beside 吾, and 吾 is 五 over 口. Each step is labelled with what the
part does in the character it goes into — gives the meaning, gives the sound,
or is only there as a shape — which is what turns a list of characters into a
family: 妈 吗 骂 码 are 马's because 马 is how they sound, 骑 驾 because 马 is
what they are about.

Reads:
  public/data/characters.json   the 3000 syllabus characters (their own parts)
  public/data/radicals.json     the 214 radicals and every form of each
  .cache/mmah_dictionary.txt    Make Me a Hanzi, for the parts of the parts

Writes public/data/families.json:
  {
    "version": 1,
    "parts": { "吾": { "py": "wú", "d": "I; my" } },   # steps that are not syllabus characters
    "trees": { "30": [["吾", "口", "m"], ["语", "吾", "s"], ...] }
  }

Each tree is a list of edges [child, parent, role] in a stable order, with the
radical's forms as the parents of the first generation. A character appears in
a radical's tree once, by its shortest path, preferring a path through another
syllabus character (森 under 林 rather than straight under 木) only when the
IDS itself goes that way.

Run: python scripts/build_families.py
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache")
DATA = os.path.join(ROOT, "public", "data")

IDC_3 = "⿲⿳"
IDC_2 = "⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻"
IDC = IDC_2 + IDC_3

# Deeper than this, a radical is a stroke inside a stroke inside a part, and
# nobody reading the character sees it there.
MAX_DEPTH = 3

# 阝 is two radicals that share a shape: on the left it is 阜 (mound, 170),
# on the right 邑 (city, 163).
MOUND, CITY = 170, 163
# 月 as a part is usually 肉 (flesh, 130) in disguise — 脑 胖 腿 — and only
# sometimes the moon (74).
MOON, FLESH = 74, 130
FLESHY = re.compile(r"flesh|meat|body|organ|limb|belly|fat", re.I)


def parse_ids(s):
    pos = 0

    def node():
        nonlocal pos
        if pos >= len(s):
            return None
        ch = s[pos]
        pos += 1
        if ch in IDC:
            n = 3 if ch in IDC_3 else 2
            kids = [node() for _ in range(n)]
            return (ch, [k for k in kids if k is not None])
        return ch

    return node()


def operands(ids):
    """Top-level operands as (glyph-or-subtree, operator, index)."""
    if not ids or ids == "？":
        return []
    tree = parse_ids(ids)
    if not isinstance(tree, tuple):
        return []
    op, kids = tree
    return [(k, op, i) for i, k in enumerate(kids)]


def load_mm():
    mm = {}
    with open(os.path.join(CACHE, "mmah_dictionary.txt"), encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            mm[e["character"]] = e
    return mm


def short(d):
    """The first sense of a definition, short enough for a tile."""
    if not d:
        return ""
    first = re.split(r"[;,]", d)[0].strip()
    return first[:28]


def main():
    chars = json.load(open(os.path.join(DATA, "characters.json"), encoding="utf-8"))["items"]
    radicals = json.load(open(os.path.join(DATA, "radicals.json"), encoding="utf-8"))["items"]
    by_char = {c["c"]: c for c in chars}
    mm = load_mm()

    # glyph -> radical numbers it can be a form of
    form_of = {}
    for r in radicals:
        for f in r["forms"]:
            form_of.setdefault(f["g"], set()).add(r["n"])
        form_of.setdefault(r["kangxi"], set()).add(r["n"])

    def ety_of(g):
        if g in by_char:
            return by_char[g].get("ety") or {}
        return (mm.get(g) or {}).get("etymology") or {}

    def ids_of(g):
        if g in by_char and by_char[g].get("ids"):
            return by_char[g]["ids"]
        return (mm.get(g) or {}).get("decomposition")

    def rad_num(g):
        return by_char[g]["radNum"] if g in by_char else None

    def radicals_for_part(part, child, op, idx):
        """Which radicals a part is, in the place it has in `child`."""
        ns = set(form_of.get(part, ()))
        if part == "阝":
            if op == "⿰":
                return {MOUND} if idx == 0 else {CITY}
            rn = rad_num(child)
            return {rn} if rn in (MOUND, CITY) else {MOUND, CITY}
        if part in ("月", "⺼"):
            hint = ety_of(child).get("hint") or ""
            if rad_num(child) == FLESH or FLESHY.search(hint):
                return {FLESH}
            return {MOON}
        return ns

    def role(child, parent, radical_forms):
        e = ety_of(child)
        t = e.get("type")
        same = lambda x: x == parent or (radical_forms and x in radical_forms)
        if t == "pictophonetic":
            if e.get("phonetic") and same(e["phonetic"]):
                return "s"
            if e.get("semantic") and same(e["semantic"]):
                return "m"
            return "p"
        if t == "ideographic":
            return "m"
        return "p"

    def parts(g):
        """Named parts of g, flattening unnamed nested structures (⿰木木 in 森)."""
        out = []
        # A pictograph is a picture, not an assembly: 日 is drawn as a sun,
        # and that it can be cut into 口 and 一 says nothing a learner needs.
        if ety_of(g).get("type") == "pictographic":
            return out

        def walk(node, op, idx):
            if isinstance(node, tuple):
                sub_op, kids = node
                for i, k in enumerate(kids):
                    walk(k, sub_op, i)
            elif node and node != "？":
                out.append((node, op, idx))

        for node, op, idx in operands(ids_of(g)):
            walk(node, op, idx)
        return out

    # For each radical, find each syllabus character's path down to it.
    trees = {r["n"]: [] for r in radicals}
    used_parts = set()
    radical_forms = {r["n"]: {f["g"] for f in r["forms"]} | {r["kangxi"]} for r in radicals}

    def paths(g, depth, seen):
        """Every (radical, [g, ..., form]) reachable from g within MAX_DEPTH."""
        if depth > MAX_DEPTH or g in seen:
            return []
        out = []
        for part, op, idx in parts(g):
            for n in radicals_for_part(part, g, op, idx):
                out.append((n, [g, part]))
            if part in form_of and part not in by_char and part not in mm:
                continue
            for n, p in paths(part, depth + 1, seen | {g}):
                out.append((n, [g] + p))
        return out

    # Single-stroke radicals (一 丨 丶 丿 乙 亅) are inside nearly everything;
    # only the characters that show them at the top level are family.
    one_stroke = {r["n"] for r in radicals if r["sc"] <= 1}

    for c in sorted(chars, key=lambda x: x["i"]):
        g = c["c"]
        best = {}
        for n, p in paths(g, 1, set()):
            if n in one_stroke and len(p) > 2:
                continue
            # the radical written on its own is the root, not a member of itself
            if len(p) == 2 and p[0] in radical_forms[n]:
                continue
            prev = best.get(n)
            # shortest wins; among equals, one through a syllabus character
            key = (len(p), 0 if all(x in by_char for x in p[1:-1]) else 1)
            if prev is None or key < prev[0]:
                best[n] = (key, p)
        for n, (_, p) in best.items():
            trees[n].append(p)

    out_trees = {}
    for n, plist in trees.items():
        edges = []
        placed = set()
        forms = radical_forms[n]
        for p in plist:
            # p = [char, ..., form]; walk from the form up
            chain = list(reversed(p))
            for i in range(1, len(chain)):
                child, parent = chain[i], chain[i - 1]
                if child in placed:
                    continue
                placed.add(child)
                edges.append([child, parent, role(child, parent, forms if i == 1 else None)])
                if child not in by_char:
                    used_parts.add(child)
        if edges:
            out_trees[str(n)] = edges

    gloss = {}
    for g in sorted(used_parts):
        e = mm.get(g) or {}
        py = (e.get("pinyin") or [""])[0]
        gloss[g] = {"py": py, "d": short(e.get("definition"))}

    out = {"version": 1, "parts": gloss, "trees": out_trees}
    path = os.path.join(DATA, "families.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    n_edges = sum(len(v) for v in out_trees.values())
    print(f"wrote {path}: {len(out_trees)} radicals, {n_edges} edges, {len(gloss)} intermediate parts, "
          f"{os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    main()
