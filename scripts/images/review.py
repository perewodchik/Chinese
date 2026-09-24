#!/usr/bin/env python3
"""
Lay the candidates out on one page, to choose between them.

Writes .cache/images/review.html: one row per concept — the query, the words
it is for, and its candidates numbered 0, 1, 2… — with the current choice from
scripts/images/picks.json outlined. With the dev server running it opens at
http://localhost:5173/@fs/<project>/.cache/images/review.html. Write the
numbers into picks.json (-1 for "none of these") and run build.py.

Run: python3 scripts/images/review.py [--todo] [--from N] [--count N]
"""

import html
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fetch import CACHE, concepts, slug  # noqa: E402


def main():
    args = sys.argv[1:]
    start = int(args[args.index("--from") + 1]) if "--from" in args else 0
    count = int(args[args.index("--count") + 1]) if "--count" in args else 10_000
    words = json.load(open(os.path.join(HERE, "words.json"), encoding="utf-8"))
    parts = json.load(open(os.path.join(HERE, "parts.json"), encoding="utf-8"))
    picks_path = os.path.join(HERE, "picks.json")
    picks = json.load(open(picks_path, encoding="utf-8")) if os.path.exists(picks_path) else {}

    used = {}
    for w, v in words.items():
        if w != "_" and v[0]:
            used.setdefault(slug(v[0]), []).append(w)
    for g, q in parts.items():
        if g != "_":
            used.setdefault(slug(q), []).append(f"({g})")

    listed = list(enumerate(concepts()))
    if "--todo" in args:
        # only what has candidates and no choice yet
        listed = [(n, q) for n, q in listed if slug(q) not in picks
                  and os.path.exists(os.path.join(CACHE, slug(q), "candidates.json"))]
    rows = []
    for n, q in listed[start:start + count]:
        s = slug(q)
        meta = os.path.join(CACHE, s, "candidates.json")
        cands = json.load(open(meta, encoding="utf-8"))["candidates"] if os.path.exists(meta) else []
        chosen = picks.get(s, 0)
        cells = "".join(
            f'<figure class="{"on" if i == chosen else ""}"><img loading="lazy" src="{html.escape(c["local"])}">'
            f"<figcaption>{i} · {c['source'][0]}</figcaption></figure>"
            for i, c in enumerate(cands)
        ) or '<em>no candidates</em>'
        rows.append(
            f'<tr><th><b>{n}. {html.escape(q)}</b><br><small>{s}</small><br>'
            f'<span>{html.escape(" ".join(used.get(s, [])))}</span></th><td>{cells}</td></tr>'
        )
    page = f"""<!doctype html><meta charset="utf-8"><title>Pick pictures</title>
<style>
body{{font:13px -apple-system,sans-serif;margin:8px;background:#f7f4ef}}
table{{border-collapse:collapse}} tr{{border-bottom:1px solid #ddd}}
th{{text-align:left;width:170px;vertical-align:top;padding:6px;font-weight:400}}
th span{{font-size:15px}}
td{{display:flex;gap:6px;padding:4px}}
figure{{margin:0;border:3px solid transparent;border-radius:6px}}
figure.on{{border-color:#b8452f}}
img{{width:150px;height:112px;object-fit:cover;display:block;border-radius:3px}}
figcaption{{text-align:center;font-size:12px}}
</style><table>{''.join(rows)}</table>"""
    out = os.path.join(CACHE, "review.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(page)
    print(out)


if __name__ == "__main__":
    main()
