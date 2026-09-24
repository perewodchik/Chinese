#!/usr/bin/env python3
"""
Find real photos for the word pictures: a few candidates per concept, cached.

Every picture query in scripts/images/words.json (whole words) and
scripts/images/parts.json (the literal parts of compounds: 火 fire, 车 car) is
a *concept*. For each one this looks in two free places that need no key:

  1. English Wikipedia — the lead image of the article the query names
     ("Apple", "Train"): the picture editors chose to stand for that thing.
     When it exists it is usually the best one. Looked up fifty at a time.
  2. Wikimedia Commons search — photos whose title and description match.

Up to MAX candidates per concept are saved under .cache/images/<slug>/ with
their licence and author, for scripts/images/review.py to lay out and
scripts/images/build.py to ship. Resumable: a concept with candidates already
saved is skipped. Thumbnail renders are rate-limited, so downloads are one
every few seconds and back off on 429.

Run: python3 scripts/images/fetch.py [--only slug,slug] [--refresh]
"""

import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, ".cache", "images")
UA = "HanziWorkshop/1.0 (personal Chinese study app; image picker) python-urllib"
MAX = 4
# A standard thumbnail step on Wikimedia. Thumbnails that are not cached yet
# are rendered on request, and those renders are rate-limited per address —
# hence one download every few seconds.
THUMB = 330
DOWNLOAD_EVERY = 1.5

OK_MIME = {"image/jpeg", "image/png", "image/webp"}
# titles that are almost never a photo of the thing itself
NOISE = re.compile(
    r"logo|map of|diagram|chart|flag of|coat of arms|stamp|poster|cover|screenshot|"
    r"icon|symbol of|seal of|\.svg|\.pdf|\.tif|scan|page \d|manuscript|text",
    re.I,
)


def slug(q):
    return re.sub(r"[^a-z0-9]+", "-", q.lower()).strip("-")


def concepts():
    words = json.load(open(os.path.join(HERE, "words.json"), encoding="utf-8"))
    parts = json.load(open(os.path.join(HERE, "parts.json"), encoding="utf-8"))
    qs = []
    for k, v in words.items():
        if k != "_" and v and v[0]:
            qs.append(v[0])
    for k, v in parts.items():
        if k != "_":
            qs.append(v)
    seen, out = set(), []
    for q in qs:
        if slug(q) not in seen:
            seen.add(slug(q))
            out.append(q)
    return out


_last = [0.0]


def get(url, binary=False, polite=0.25):
    for attempt in range(6):
        wait = _last[0] + polite - time.time()
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                return data if binary else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                after = e.headers.get("retry-after")
                back = int(after) if after and after.isdigit() else 10 * (attempt + 1)
                print(f"    {e.code} from {urllib.parse.urlsplit(url).netloc}, waiting {back}s", flush=True)
                time.sleep(back)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"    {type(e).__name__} on {url[:70]}, retrying", flush=True)
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"gave up on {url}")


def api(base, **params):
    params.setdefault("format", "json")
    return get(f"{base}?{urllib.parse.urlencode(params)}")


ENWIKI = "https://en.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"


def lead_images(queries):
    """
    The lead image of the English Wikipedia article named by each query —
    "Apple", "Train", "Elephant" — fifty to a request. It is the picture the
    article's editors chose to stand for the thing, so when there is one it is
    usually the best candidate. Queries that are not article titles ("person
    eating") simply find nothing here and rely on the search.
    """
    out = {}
    for i in range(0, len(queries), 50):
        chunk = queries[i:i + 50]
        titles = {q[:1].upper() + q[1:]: q for q in chunk}
        d = api(ENWIKI, action="query", titles="|".join(titles), prop="pageimages", piprop="name",
                redirects=1, formatversion=2)
        q_ = d.get("query", {})
        back = {}
        for n in q_.get("normalized", []):
            back[n["to"]] = titles.get(n["from"], n["from"])
        for r in q_.get("redirects", []):
            back[r["to"]] = back.get(r["from"], titles.get(r["from"], r["from"]))
        for page in q_.get("pages", []):
            name = page.get("pageimage")
            t = page.get("title")
            q = back.get(t, titles.get(t))
            if name and q:
                out[q] = "File:" + name
    return out


def commons_info(titles):
    """Image info for Commons files, fifty to a request."""
    pages = []
    for i in range(0, len(titles), 50):
        d = api(COMMONS, action="query", titles="|".join(titles[i:i + 50]), prop="imageinfo",
                iiprop="url|size|mime|extmetadata", iiurlwidth=THUMB)
        pages += list(d.get("query", {}).get("pages", {}).values())
    return pages


def commons_search(q):
    d = api(COMMONS, action="query", generator="search", gsrsearch=f"{q} filetype:bitmap",
            gsrnamespace=6, gsrlimit=12, prop="imageinfo", iiprop="url|size|mime|extmetadata",
            iiurlwidth=THUMB)
    pages = list(d.get("query", {}).get("pages", {}).values())
    pages.sort(key=lambda p: p.get("index", 99))
    return pages


def plain(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def candidate(page, source):
    ii = (page.get("imageinfo") or [None])[0]
    if not ii or ii.get("mime") not in OK_MIME:
        return None
    title = page.get("title", "")
    if source == "search" and NOISE.search(title):
        return None
    if ii.get("width", 0) < 300 or ii.get("height", 0) < 240:
        return None
    ratio = ii["width"] / max(1, ii["height"])
    if ratio > 2.4 or ratio < 0.42:
        return None
    meta = ii.get("extmetadata", {})
    lic = plain(meta.get("LicenseShortName", {}).get("value"))
    if not lic:
        return None
    return {
        "file": title,
        "source": source,
        "thumb": ii.get("thumburl") or ii["url"],
        "page": ii.get("descriptionurl"),
        "w": ii["width"],
        "h": ii["height"],
        "artist": plain(meta.get("Artist", {}).get("value"))[:120] or "unknown",
        "license": lic,
        "licenseUrl": plain(meta.get("LicenseUrl", {}).get("value")),
        "credit": plain(meta.get("Credit", {}).get("value"))[:160],
    }


def fetch(q, lead=None, refresh=False):
    s = slug(q)
    d = os.path.join(CACHE, s)
    meta_path = os.path.join(d, "candidates.json")
    if os.path.exists(meta_path) and not refresh:
        return "cached"
    os.makedirs(d, exist_ok=True)

    cands, seen = [], set()
    for page in [lead] if lead else []:
        c = candidate(page, "wikipedia")
        if c and c["file"] not in seen:
            seen.add(c["file"])
            cands.append(c)
    for page in commons_search(q):
        if len(cands) >= MAX:
            break
        c = candidate(page, "search")
        if c and c["file"] not in seen:
            seen.add(c["file"])
            cands.append(c)

    for i, c in enumerate(cands):
        ext = ".png" if c["thumb"].lower().endswith(".png") else ".jpg"
        path = os.path.join(d, f"{i}{ext}")
        if not os.path.exists(path):
            data = get(c["thumb"], binary=True, polite=DOWNLOAD_EVERY)
            with open(path, "wb") as f:
                f.write(data)
        c["local"] = os.path.relpath(path, CACHE)

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"query": q, "candidates": cands}, f, ensure_ascii=False, indent=1)
    return f"{len(cands)} candidates"


def main():
    args = sys.argv[1:]
    refresh = "--refresh" in args
    only = None
    if "--only" in args:
        only = set(args[args.index("--only") + 1].split(","))
    qs = concepts()
    if only:
        qs = [q for q in qs if slug(q) in only]
    print(f"{len(qs)} concepts", flush=True)
    todo = [q for q in qs if refresh or not os.path.exists(os.path.join(CACHE, slug(q), "candidates.json"))]
    files = lead_images(todo)
    info = {p.get("title"): p for p in commons_info(sorted(set(files.values())))}
    print(f"{len(files)} of {len(todo)} have a Wikipedia lead image", flush=True)
    for i, q in enumerate(qs, 1):
        try:
            print(f"[{i}/{len(qs)}] {q}: {fetch(q, info.get(files.get(q)), refresh)}", flush=True)
        except Exception as e:  # keep going; a rerun picks it up
            print(f"[{i}/{len(qs)}] {q}: FAILED {e}", flush=True)


if __name__ == "__main__":
    main()
