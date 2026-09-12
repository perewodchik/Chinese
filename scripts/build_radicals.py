#!/usr/bin/env python3
"""
Build public/data/radicals.json: the 214 Kangxi radicals, every way each of
them is written, and an outline for each of those ways.

Radicals are a dataset of their own. The character sheets never read this file,
and nothing in it is read back into characters.json, so a mistake here can only
ever be a mistake about radicals. What each radical means, what it is called and
how it is written is hand-written in radicals_table.py; this script checks those
facts against the sources and fills in what can be counted.

    python scripts/build_radicals.py        (after build_data.py)

Each written form is drawn from a real character rather than from the radical's
own code point. Make Me a Hanzi records which component every stroke of a
character belongs to, so the strokes of 忄 can be lifted out of 快 exactly where
they sit: narrow, on the left, at the height a hand writes them. The code points
for radical shapes are drawn inconsistently — ⺼ and 讠 hug the left edge while
忄 and 扌 are centred — and ⻊, 牜, ⻗ and 𦍌 have no outline at all.
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_data as bd  # noqa: E402  - loaders, IDS parsing, the pinyin table
from radicals_table import (  # noqa: E402
    ALONE,
    EXAMPLE_GLOSS,
    EXAMPLE_REJECT,
    POSITIONS,
    RADICALS,
)

# Examples kept per form. The sheet shows as many as fit, the app all of them.
MAX_EXAMPLES = 6

# Senses that say nothing about what a character means on a worksheet.
NOISE = ("surname", "variant of", "old variant", "abbr.", "see ", "used in", "CL:",
         "Taiwan pr.", "erhua", "also written", "Japanese", "Korean", "radical",
         "Kangxi", "letter", "pr. ")
LEADING_NOTE = re.compile(r"^\((?:[^()]|\([^()]*\))*\)\s*")
TRAILING_NOTE = re.compile(r"\s*\((?:[^()]|\([^()]*\))*\)\s*$")

# The IDS operator a component sits under, and its place among the operands,
# decide where it is. Everything more deeply nested counts as "inside".
POSITION_OF = {
    ("⿰", 0): "left", ("⿰", 1): "right",
    ("⿱", 0): "top", ("⿱", 1): "bottom",
    ("⿲", 0): "left", ("⿲", 2): "right",
    ("⿳", 0): "top", ("⿳", 2): "bottom",
    ("⿴", 0): "around", ("⿵", 0): "around", ("⿶", 0): "around", ("⿷", 0): "around",
    ("⿸", 0): "topLeft", ("⿹", 0): "topRight", ("⿺", 0): "bottomLeft",
}


def find_path(tree, part, path=()):
    """Indices from the root of a decomposition down to `part`, or None."""
    if tree is None:
        return None
    if isinstance(tree, str):
        return path if tree == part else None
    if bd.flatten(tree) == part:
        return path
    for i, kid in enumerate(tree[1]):
        found = find_path(kid, part, path + (i,))
        if found is not None:
            return found
    return None


def position(c: str, part: str, mm) -> str | None:
    """Where `part` sits inside `c`: one of the form positions, "inside", or None."""
    if c == part:
        return ALONE
    dec = mm.get(c, {}).get("decomposition") or ""
    if not dec or dec == "？":
        return None
    tree = bd.parse_ids(dec)
    path = find_path(tree, part)
    if path is None:
        return None
    if not path:
        return ALONE
    return POSITION_OF.get((tree[0], path[0]), "inside")


def cut(host: str, part: str, mm, outlines) -> tuple[dict | None, str | None]:
    """The strokes of `part` as they sit inside `host`, still in writing order."""
    e = mm.get(host)
    d = outlines.get(host)
    if not e or not d:
        return None, f"no outline or decomposition for {host}"
    tree = bd.parse_ids(e.get("decomposition") or "")
    path = find_path(tree, part)
    if path is None:
        return None, f"{part} is not a part of {host} ({e.get('decomposition')})"
    matches = e.get("matches") or []
    if len(matches) != len(d["strokes"]):
        return None, f"{host}: {len(matches)} matches for {len(d['strokes'])} strokes"
    picked = [
        i for i, m in enumerate(matches)
        if m is not None and tuple(m[:len(path)]) == path
    ]
    if not picked:
        return None, f"no strokes of {host} belong to {part}"
    return {
        "s": [d["strokes"][i] for i in picked],
        "m": [d["medians"][i] for i in picked],
    }, None


def short_gloss(text: str, limit: int = 24) -> str:
    """The first sense of a definition, short enough to sit under a glyph."""
    text = bd.tidy(text)
    first = re.split(r"[;；]", text)[0].strip()
    head = first.split(",")[0].strip()
    gloss = head if len(head) >= 2 else first
    if len(gloss) > limit:
        gloss = gloss[:limit].rsplit(" ", 1)[0].rstrip(" ,;") + "…"
    return gloss


def clean_sense(sense: str) -> str:
    """One CC-CEDICT sense without its register notes: "(bound form) machine" → "machine"."""
    s = re.sub(r"\s*\[[^\]]*\]", "", sense)
    while True:
        stripped = LEADING_NOTE.sub("", s)
        if stripped == s:
            break
        s = stripped
    s = TRAILING_NOTE.sub("", s).strip(" ;,")
    return "measure word" if s.startswith("classifier") else s


def main() -> int:
    bd.log("· sources")
    bd.ensure_sources()
    mm = bd.load_mmah()
    hdb = bd.load_hanzidb()
    ced = bd.load_cedict()
    trad = bd.traditional_only(ced)
    chars_path = os.path.join(bd.OUT, "characters.json")
    if not os.path.exists(chars_path):
        bd.log("! characters.json is missing - run build_data.py first")
        return 1
    syllabus = json.load(open(chars_path, encoding="utf-8"))["items"]
    by_char = {c["c"]: c for c in syllabus}

    def freq(c: str) -> int:
        row = hdb.get(c)
        return int(row["frequency_rank"]) if row else 99999

    def kangxi_number(c: str) -> int | None:
        code = hdb.get(c, {}).get("radical_code", "").split(".")[0]
        return int(code) if code.isdigit() else None

    under: dict[int, list[str]] = defaultdict(list)
    kangxi: dict[int, str] = {}
    for ch, row in hdb.items():
        n = kangxi_number(ch)
        if n is None:
            continue
        kangxi.setdefault(n, row["radical"])
        under[n].append(ch)

    errors: list[str] = []
    warnings: list[str] = []

    # ------------------------------------------------------------ the forms
    specs: dict[int, dict] = {}
    for n in range(1, 215):
        spec = RADICALS.get(n)
        if not spec:
            errors.append(f"#{n}: missing from radicals_table.py")
            continue
        if spec["forms"]:
            forms = [dict(f) for f in spec["forms"]]
        else:
            g = spec["r"] or kangxi.get(n)
            forms = [{"g": g, "pos": ALONE, "host": None, "part": g,
                      "name": spec["name"], "tip": None, "ex": spec["ex"]}]
        for f in forms:
            if f["pos"] not in POSITIONS:
                errors.append(f"#{n} {f['g']}: unknown position {f['pos']}")
        specs[n] = {**spec, "forms": forms}

    need = set()
    for spec in specs.values():
        for f in spec["forms"]:
            need.add(f["host"] or f["g"])
    outlines = bd.fetch_strokes(sorted(need))

    def reading(c: str) -> str:
        e = by_char.get(c)
        if e and e["py"]:
            return e["py"][0]
        if c in bd.PINYIN_OVERRIDE:
            return bd.PINYIN_OVERRIDE[c][0]
        if mm.get(c, {}).get("pinyin"):
            return mm[c]["pinyin"][0]
        return (hdb.get(c, {}).get("pinyin") or "").split(" ")[0]

    def gloss(c: str) -> str:
        """
        What a character means, in a few words.

        CC-CEDICT rather than Make Me a Hanzi, whose first sense is often the
        oldest one: it opens 想 with "to believe", 题 with "forehead" and 机
        with "desk". CC-CEDICT's first entry can be the wrong reading instead
        (布 bù, "to announce", before "cloth"), so the entry read the way the
        syllabus reads the character goes first, and EXAMPLE_GLOSS settles
        what neither gets right.
        """
        if c in EXAMPLE_GLOSS:
            return EXAMPLE_GLOSS[c]
        want = reading(c)
        entries = [e for e in ced.get(c, []) if not e["py"][:1].isupper()]
        entries.sort(key=lambda e: e["py"] != want)
        for entry in entries:
            for sense in entry["defs"]:
                s = clean_sense(sense)
                if len(s) >= 2 and not s.startswith(NOISE) and not sense.startswith(NOISE):
                    return short_gloss(s)
        e = by_char.get(c)
        text = ((e and e["def"]) or mm.get(c, {}).get("definition")
                or hdb.get(c, {}).get("definition") or "")
        return short_gloss(text)

    def example(c: str) -> dict:
        e = by_char.get(c)
        return {"c": c, "py": reading(c), "d": gloss(c), "hsk": e["hsk"] if e else 0}

    def usable(c: str) -> bool:
        return (c in by_char or c in hdb) and c not in trad

    items = []
    strokes: dict[str, dict] = {}
    for n, spec in specs.items():
        forms = spec["forms"]
        own = {f["g"] for f in forms} | {f["part"] for f in forms}
        own |= {spec["word"] or "", kangxi.get(n, "")}

        out_forms = []
        for f in forms:
            glyphs = {f["g"], f["part"]}
            siblings = [o for o in forms if o is not f and ({o["g"], o["part"]} & glyphs)]
            claimed = {o["pos"] for o in siblings if o["pos"] != ALONE}

            # Every syllabus character filed under this radical and written
            # with this form, and where in it the form sits.
            found = []
            for c in by_char:
                if kangxi_number(c) != n:
                    continue
                written = mm.get(c, {}).get("radical")
                if written in glyphs:
                    found.append((c, position(c, written, mm)))
            found.sort(key=lambda t: (by_char[t[0]]["hsk"], freq(t[0])))

            # A form that sits somewhere in particular is shown in characters
            # where it sits there: 弓 on the left belongs with 张 and 强, not
            # with 弟. Where two forms share a glyph (土 on the left of 地, 土
            # anywhere else) the full form takes whatever the other leaves.
            if f["pos"] == ALONE:
                uses = [c for c, where in found if where not in claimed]
                others: list[str] = []
            else:
                uses = [c for c, where in found if where == f["pos"]]
                others = [c for c, where in found if where != f["pos"]] if len(forms) == 1 else []

            if f["ex"]:
                picked = []
                for c in f["ex"]:
                    if usable(c):
                        picked.append(c)
                    else:
                        warnings.append(f"#{n} {f['g']}: example {c} is not a simplified character")
            else:
                keep = lambda c: c not in own and c not in EXAMPLE_REJECT  # noqa: E731
                picked = [c for c in uses if keep(c)]
                if len(picked) < 3:
                    picked += [c for c in others if keep(c)]
                if len(forms) == 1 and len(picked) < 3:
                    # A rare radical: borrow from outside the syllabus, but only
                    # characters common enough to be worth meeting.
                    extra = sorted(
                        (c for c in under[n] if keep(c) and c not in picked and c not in by_char
                         and usable(c) and freq(c) <= 3500),
                        key=freq,
                    )
                    picked += extra[: 3 - len(picked)]
                if not picked and f["pos"] == ALONE and f["g"] in by_char:
                    # 雨, 网, 走 on their own: the character itself is the example.
                    picked = [f["g"]]
            picked = picked[:MAX_EXAMPLES]

            if f["host"]:
                outline, problem = cut(f["host"], f["part"], mm, outlines)
                key = f"{f['g']}@{f['host']}"
                own_count = len((outlines.get(f["part"]) or {}).get("strokes") or [])
                if outline and own_count and len(outline["s"]) != own_count and f["g"] == f["part"]:
                    warnings.append(
                        f"#{n} {f['g']}: {len(outline['s'])} strokes cut from {f['host']},"
                        f" {own_count} in the glyph on its own")
            else:
                d = outlines.get(f["g"])
                outline = {"s": d["strokes"], "m": d["medians"]} if d else None
                problem = None if d else f"no outline for {f['g']}"
                key = f["g"]
            if not outline:
                errors.append(f"#{n} {f['g']}: {problem}")
                continue
            strokes[key] = outline

            name = f["name"]
            out_forms.append({
                "g": f["g"],
                "k": key,
                "pos": f["pos"],
                "name": name[0] if name else None,
                "namePy": name[1] if name else None,
                "sc": len(outline["s"]),
                "tip": f["tip"],
                "host": f["host"],
                "uses": len(uses),
                "ex": [example(c) for c in picked],
            })

        if not out_forms:
            continue
        chars_under = under[n]
        items.append({
            "n": n,
            "r": out_forms[0]["g"],
            "kangxi": kangxi.get(n, out_forms[0]["g"]),
            "word": spec["word"] or next(
                (f["g"] for f in out_forms if f["pos"] == ALONE), out_forms[0]["g"]),
            "py": spec["py"],
            "mean": spec["mean"],
            "about": spec["about"],
            "note": spec["note"],
            "sc": out_forms[0]["sc"],
            "count": len(chars_under),
            "syllabus": sum(1 for c in chars_under if c in by_char),
            "useful": sum(1 for c in chars_under if freq(c) <= 3000),
            "forms": out_forms,
        })

    # Most useful first: how many syllabus characters use it, then how many of
    # the three thousand commonest, then how many characters at all.
    items.sort(key=lambda r: (-r["syllabus"], -r["useful"], -r["count"], r["n"]))
    for i, r in enumerate(items, 1):
        r["rank"] = i

    # ----------------------------------------------------------------- write
    os.makedirs(bd.OUT, exist_ok=True)
    path = os.path.join(bd.OUT, "radicals.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"version": 2, "count": len(items), "items": items, "strokes": strokes},
                  fh, ensure_ascii=False, separators=(",", ":"))
    bd.log(f"  wrote radicals.json  {os.path.getsize(path) / 1024:.0f} KB"
           f"  ({len(items)} radicals, {len(strokes)} outlines)")

    report = os.path.join(bd.CACHE, "radicals-report.txt")
    with open(report, "w", encoding="utf-8") as fh:
        for r in items:
            fh.write(f"#{r['rank']:>3} n{r['n']:>3} {r['r']} ({r['word']} {r['py']}) {r['mean']}"
                     f" · syllabus {r['syllabus']} · all {r['count']}\n")
            if r["about"]:
                fh.write(f"       about: {r['about']}\n")
            if r["note"]:
                fh.write(f"       note:  {r['note']}\n")
            for f in r["forms"]:
                ex = "  ".join(f"{e['c']} {e['py']} {e['d']} [{e['hsk']}]" for e in f["ex"])
                fh.write(f"     {f['g']} {f['pos']:<10} {f['sc']} strokes"
                         f" {f['name'] or ''} {f['namePy'] or ''} host={f['host']} uses={f['uses']}\n")
                if f["tip"]:
                    fh.write(f"         tip: {f['tip']}\n")
                fh.write(f"         ex:  {ex}\n")
    bd.log(f"  report: {report}")

    # A contact sheet of every cut outline, stroke by stroke and numbered. A
    # wrong cut is the one error the text report cannot show: the shape prints
    # cleanly and is simply not the shape the hand should learn.
    sheet = os.path.join(bd.CACHE, "radical-forms.html")
    with open(sheet, "w", encoding="utf-8") as fh:
        fh.write("<!doctype html><meta charset=utf-8><title>radical forms</title>"
                 "<style>body{font:12px sans-serif;margin:8px;background:#fff;color:#222}"
                 ".r{display:flex;gap:8px;align-items:flex-start;"
                 "border-bottom:1px solid #ddd;padding:4px 0}.h{width:130px}"
                 ".f{text-align:center;width:104px}svg{width:96px;height:96px;"
                 "border:1px solid #bbb;background:#fff}</style>")
        for r in items:
            fh.write(f"<div class=r><div class=h><b>#{r['rank']} n{r['n']} {r['r']}</b>"
                     f"<br>{html.escape(r['mean'])}</div>")
            for f in r["forms"]:
                d = strokes.get(f["k"], {})
                fh.write("<div class=f><svg viewBox='0 0 1024 1024'>"
                         "<line x1='0' y1='512' x2='1024' y2='512' stroke='#eee' stroke-width='8'/>"
                         "<line x1='512' y1='0' x2='512' y2='1024' stroke='#eee' stroke-width='8'/>"
                         "<g transform='translate(0,900) scale(1,-1)'>")
                for outline in d.get("s", []):
                    fh.write(f'<path d="{outline}" fill="#333"/>')
                fh.write("</g>")
                # Numbered where each stroke starts, so the order can be read.
                for i, median in enumerate(d.get("m", []), 1):
                    if not median:
                        continue
                    x, y = median[0]
                    fh.write(f'<text x="{x}" y="{900 - y}" font-size="90" fill="#d22">{i}</text>')
                fh.write(f"</svg><br>{f['g']} {f['pos']} {f['sc']}<br>{f['host'] or ''}</div>")
            fh.write("</div>")
    bd.log(f"  forms:  {sheet}")

    for w in warnings:
        bd.log(f"  ~ {w}")
    for e in errors:
        bd.log(f"  ! {e}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
