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

## Menu photos (`--set menu`)

The ordering games (`src/games/order-*`) show real photos of what is on the
menu. They go through the same three scripts with `--set menu`:

| File | What |
|---|---|
| `menu.json` | photo key → query. The keys are the ones the brands' `menu.ts` use (`iced-latte`, `croissant`); several items share one. |
| `menu-picks.json` | which candidate to ship for each key; `-1` = none fits. |

```bash
python3 scripts/images/fetch.py --set menu     # one download every 3 s; resumable
python3 scripts/images/review.py --set menu    # .cache/images/menu/review.html
python3 scripts/images/build.py --set menu     # public/images/menu/, src/data/menuPictures.json
```

Pick the dish or drink **as served** (a bowl of lamian, a steamer of 虾饺, an
iced latte in a cup). Where Commons has nothing for a brand's own drink, take
the closest real thing (an iced latte for 生椰拿铁), never an illustration, and
never a photo from the brand's own app or site. Until a key has a photo, the
game shows the word photo named in the brand's `photos` (a cup of coffee for
the lattes), or an empty box of the same size.
