# Hanzi Workshop

A Chinese-learning web app for one learner (HSK 1–2, learns from English,
20–30 minutes a day, mostly on an iPad and iPhone in Safari). React + Vite
client, a Node server with SQLite locally and Postgres when deployed, deployed
to Vercel from `main`. `README.md` is the human manual; its "Layout" section
explains the folders and the rules between them.

## Read only what your task needs

Each feature keeps its own notes. Don't open another feature's docs; the big
game docs especially are not background reading.

| Feature | Code | Notes |
|---|---|---|
| 走走, the Beijing walking game (`/play/world`) | `src/world/`, `src/features/world/`, `content/world/`, `scripts/world/` | `src/world/CLAUDE.md` says what to read for which task |
| Play mini-games and 点单 ordering | `src/games/`, `src/features/play/` | `src/games/README.md`; ordering: `docs/ordering-game/` |
| Learn, Review, Stats, Videos, Today, the reader, words, pinyin | `src/features/<name>/`, `src/domain/` | the code; open items in `docs/backlog.md` |
| Images and voices pipelines | `scripts/images/`, `scripts/voices/` | `scripts/images/README.md` |

## Environment (this Mac)

- `export PATH=/opt/homebrew/bin:$PATH` before any npm/npx/node command (the
  default nvm node 20 is too old; `npm test`'s globs need Node ≥ 22).
- Check with `npm test` and `npm run vercel-build` (runs `tsc -b`).
  `npx tsc --noEmit -p .` checks nothing — the root tsconfig only has references.
- **Dev servers use the PRODUCTION database** (`.env` has `POSTGRES_URL`)
  unless `HANZI_DB=.data/<name>.db` is set. In `.claude/launch.json` only the
  configs with `HANZI_DB` are safe for testing. `HANZI_DEV_USER=admin` signs
  you in without a password.
- The Browser pane is Chromium; the learner uses Safari. Check layout in
  WebKit too: `scripts/webkit-probe.swift`, or the Playwright probes
  (`node scripts/world/*-probe.mjs webkit …`).

## Git: other sessions share this checkout

Several sessions edit and commit in this working tree on `main` at once.
- Stage explicit paths only — never `git add -A`, `.` or `-u`; never force-push
  or rewrite someone else's commit.
- Commit from a private index with a compare-and-swap on `main`, so a commit
  that landed meanwhile is never reverted:
  ```bash
  export GIT_INDEX_FILE=$(mktemp); P=$(git rev-parse HEAD); git read-tree $P
  git add <your paths>          # or update-index --force-remove for a deletion
  T=$(git write-tree); C=$(git commit-tree $T -p $P -m "…")
  git update-ref refs/heads/main $C $P; unset GIT_INDEX_FILE; git reset -q -- <your paths>
  ```
  If `update-ref` refuses, `main` moved: start again from the new HEAD.
- Built files (`public/world/…`, `stamps.gen.ts`) are regenerated, never
  hand-merged.

## The learner's standing UI rules

- No layout shift: controls render from the start, changing labels have a
  fixed width, images and canvases sit in boxes sized before they load.
- Compact one-line toolbars; per-item actions sit on the item; a tap on a card
  opens its drawer (no ⓘ buttons).
- Help is free: no penalties, no "help used" marks.
- A tap on a Chinese word opens the word drawer (`src/navigation/itemDrawer.ts`).
- UI in English; meanings in English.
- Native recordings for anything that teaches pronunciation.
- Check every screen at 375, 768 and 1024 px, light and dark.
- Load the `hanzi-design` skill before styling any screen.
