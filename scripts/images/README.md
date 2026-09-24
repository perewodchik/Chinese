# Word pictures

Real photos for HSK 1–2 words, and the literal parts of compounds, shown in
the word drawer and after the answer in the word drill:

    火 fire  +  车 car  =  火车 train

## Files

| File | What |
|---|---|
| `words.json` | word → `[picture query or null, "part+part"]`. The parts are what each character means *in that word* (东西 = `east+west`). A part in `(brackets)` is grammar (`(plural)`) and never gets a picture. |
| `parts.json` | part gloss → picture query, for the parts that are things (`fire` → `fire`, `electricity` → `lightning`). A gloss not listed is shown as text. |
| `picks.json` | which candidate to ship for each concept (by slug). `-1` = none fits. Missing = the first candidate. |
| `fetch.py` | finds up to 4 candidates per concept: the English Wikipedia lead image (fifty titles per request), then Wikimedia Commons search. Cached in `.cache/images/<slug>/`. Resumable. |
| `review.py` | writes `.cache/images/review.html`, every concept's candidates side by side. With the dev server running, open `http://localhost:5173/@fs/<absolute project path>/.cache/images/review.html`. |
| `build.py` | re-fetches each chosen photo at 500px, resizes it with `sips` to 440px (quality 62), and writes `public/images/words/*.jpg`, `public/images/words/CREDITS.md` and `src/data/pictures.json` (bundled, so a picture's box is laid out before it loads). |

## Workflow

```bash
python3 scripts/images/fetch.py          # slow on purpose: Wikimedia rate-limits thumbnail renders
python3 scripts/images/review.py --from 0 --count 60
# write choices into picks.json; for a concept with no good candidate,
# change its query in words.json / parts.json and fetch again
python3 scripts/images/build.py
```

Only free sources that need no key are used. Every picture keeps its author
and licence; `CREDITS.md` lists them and the drawer shows the credit.
