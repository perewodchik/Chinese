# Hanzi Workshop

Build Chinese handwriting worksheets as PDFs, be asked about them until they
stick, and read it all back in passages written out of exactly those
characters.

- **3000 characters** — the whole official HSK 3.0 syllabus, bands 1 to 9,
  ordered band by band so that a character never turns up before the parts it
  is made of.
- **214 radicals, and every way each one is written.** 心 is 忄 on the left of
  快, flat and wide under 想, and ⺗ under 恭 — three shapes, one radical, and a
  practice row for each. Their own section, their own sheets: radicals are a
  beginner's tool and nothing about them touches the characters.
- **Collections, not templates.** One card per subject — "HSK 1", "Food", "The
  ones I keep missing" — however big you want it, printing as much or as little
  of itself as you ask for.
- **Real PDFs**, A4, vector, in a 楷体 regular-script hand. Two, three or four
  characters a page, in five colourways and four designs.
- **Reading passages** written by Claude out of the characters you have marked
  learned, plus a handful chosen to teach you — planned here, written in your
  own Claude chat, pasted back, and printed with practice sheets for everything
  new. No API key.
- **Reviewing that knows the difference** between recognising a character,
  saying it, reading it inside a word, and writing it from nothing — four
  schedules, because they are forgotten separately.
- **A test on paper.** The same characters with the answers taken away: the
  reading, the meaning, an empty square, and the key under a fold. Mark it and
  the schedule learns what your hand can actually do.
- **Nothing gets queued twice by accident.** Every character shows whether a
  collection has already claimed it, and how well you are holding on to it.
- **One account, every device.** Sign in on the PC and on the iPad and it is the
  same work: saved to the server as you go, kept on the device while the Wi-Fi
  is down, and merged rather than overwritten when both were busy at once.
- **Your tones, drawn.** Say a word into the iPad and see the pitch of your
  voice laid over the shape the tone should have, syllable by syllable, with
  the sandhi a native speaker would apply — 你好 is checked as ní hǎo. Nothing
  leaves the device, and nothing is paid for.
- **An address for everything.** Every collection, passage, drill and filter has
  a URL — reload it, bookmark it, send yourself back to it.

## Running it

Double-click **`start.cmd`**, or:

```bash
npm install
npm run dev
```

Then open <http://localhost:5173> and make an account — the first visit asks for
a name and a password. `npm run dev` is one process: the server and the app
together on one port, reloading as you edit.

> Node.js is not installed system-wide on this machine, so a copy lives in
> `.cache/node-v22.20.0-win-x64/` and `start.cmd` puts it on the PATH for you.
> If you install Node properly later (`winget install OpenJS.NodeJS.LTS`, needs
> an admin prompt), plain `npm run dev` will work from any terminal and the
> `.cache` copy can be deleted. Node 22.13 or newer is needed: the database is
> Node's own SQLite.

## On the iPad, over the Wi-Fi

Double-click **`serve.cmd`** instead. It builds the app, starts the server for
the whole network, and prints the address to type in:

```
  ─────────────────────────────────────────────────────
   On your iPad or phone, open:

      http://192.168.1.42:4173

   (Wi-Fi)
  ─────────────────────────────────────────────────────
```

`start.cmd` prints the same thing on port 5173 and is fine for the tablet too,
but the development server hands over several hundred separate files and the
wait is per request rather than per byte — over Wi-Fi that is the difference
between a page that appears and one that trickles in. `serve.cmd` spends a few
seconds building and then loads like a website: one script, compressed, cached
until the next build.

Both devices have to be on the same network, and the PC has to stay awake with
the window open. If the address does not load, Windows is probably not letting
Node accept connections — it asks the first time and remembers the answer. To
undo a "Cancel", in an **administrator** terminal:

```
netsh advfirewall firewall add rule name="Hanzi Workshop" dir=in action=allow protocol=TCP localport=4173,5173
```

**Two things worth knowing.**

*Your work follows you.* Sign in with the same account on each device and it is
the same collections, the same schedules and the same texts. Work a browser
kept before accounts existed is brought into your account the first time you
sign in there: a new account simply takes it, and an account that already has
work asks first.

*The clipboard is not the same over the network.* A plain `http://` address is
not what browsers call a secure context, so the modern clipboard API is simply
absent and the app falls back to the older way of copying. It works — the
Copy button on a prompt still copies — but if it ever does not, the prompt is
on screen in full to select by hand, and **Save as file** next to it writes it
to a file. Saving worksheets straight into a folder is a Chrome and Edge
feature and has never worked on iOS; there the PDF downloads as normal.

The Texts tab still needs no API key. It builds a prompt, you paste it into
Claude yourself, and you paste the answer back.

## Putting it on the internet

Running it at home is still the plain way: one process, one file, nothing to
pay for. This is for reaching it from somewhere that is not your Wi-Fi.

A Vercel deployment cannot keep the SQLite file — a function has no disk that
survives the request — so accounts and saved work move to Postgres. Nothing
above the storage layer changes: the same Hono app, the same services, the
same session cookies. `api/[...path].ts` is the whole difference, and
`vercel.json` says how the built page and the API are routed.

1. In Vercel, **Add New › Project** and pick this repository. The build command
   and output folder come from `vercel.json`; you do not have to fill them in.
2. Give it a Postgres. Vercel stopped selling its own in 2024 and now lists
   other people's, so there is no "create a Postgres" button of its own:
   **Marketplace › Neon › Install**, against this project. It writes the
   connection string into the project's environment for you.

   Any Postgres will do, though — the server reads `POSTGRES_URL`, or
   `DATABASE_URL` if that is what your provider calls it, and nothing else.
   So making a database straight at neon.tech (or Supabase, or anywhere) and
   pasting its connection string into **Settings › Environment Variables**
   works exactly as well, and is one less thing joined together.

   Either way there is no migration step: the schema is created on the first
   request.
3. Deploy, open the site, and **register your account**.
4. **Then close registration**: Settings › Environment Variables,
   `HANZI_REGISTRATION` = `closed`, and redeploy. Until you do, anyone who
   finds the address can make an account on it. At home on the Wi-Fi that did
   not matter; on a public address it does.

`/api/health` says whether the function is running; `/api/health?db=1`
connects, migrates and runs a query, and says how long that took or exactly why
it could not. The two are separate on purpose: a visit with no cookie is
answered without touching Postgres, so without the second one the first thing
to find the database unreachable is somebody trying to sign in.

Your work does not follow you there. The two servers keep separate databases,
and there is no export any more, so treat the deployed one as a fresh start —
or keep using the PC at home, which is still where the printing happens.

`PGSSLNOVERIFY=1` is the way out if you land on a Postgres whose certificate
does not verify. Neon's and Supabase's both do, so you should not need it.

## On an iPad

The writing drill is the reason to open this on a tablet, so the input path is
written for a stylus first.

- **Rest your hand on the screen.** The moment an Apple Pencil touches the
  glass the app stops listening to fingers for the rest of the sitting, so a
  palm on the display is a palm and not a stroke. A chip appears saying so;
  tap it if you want to go back to writing with a finger.
- **Every sample is kept.** A Pencil on a 120 Hz screen reports several
  positions between two frames, and taking only the last of them is what turns
  a fast curve into a straight line — a straight line being, as far as the
  matcher is concerned, a different stroke.
- **Pressure varies the line**, which is only cosmetic — the matching uses the
  path, not the weight — but it makes the square feel like paper rather than a
  whiteboard.
- **A second finger is ignored**, not averaged in, so a pinch or a stray touch
  cannot bend a stroke that is already being drawn.
- The square grows to fill the width the page can give it, and two-finger zoom
  is switched off over it and nowhere else.

Add it to the Home Screen and it opens without Safari's chrome, full height,
clear of the rounded corners and the home indicator. Everything else — the
library, collections, the reader — reflows to one column on a phone, and the
controls that used to appear on hover are simply always there, because on
glass there is no hover to wait for. Swiping back from the edge closes the
character drawer, because the drawer is part of the address.

## How you use it

1. **Review** — the front door. It says what is due and you pick how long you
   have got: recognise, say, tones, look-alikes, in a word, or write it. A
   printed test sheet waiting to be marked shows up here too.
2. **Library** — filter to an HSK band (or all 3000) and browse in teaching
   order. Filter by
   Everything, Learned, Not learned, *In no collection*, or *Ready — parts
   known*: the characters every piece of which you can already write, sorted
   by how many words each one would finish off. Click to select, shift-click
   for a range, the `i` button for everything known about one character —
   including its sound family, the other characters built on the same phonetic
   and whether they kept its reading. A gold dot means some collection has
   already claimed it.
3. A tray appears at the bottom: **add the selection to a collection**, new or
   existing. Anything already there is skipped, and the toast says so.
4. **Collections** — or start from a ready-made set: an HSK band or one of
   fifteen topics. **Add** asks the only question that matters —
   *how many of these do you want?* — and offers to skip whatever is already in
   another collection. You get one collection, the size you asked for, and can
   top it up later.
5. In a collection, **Design** decides what the PDF looks like and **Items** is
   what is in it: the same cards as the library, dragged into whatever order
   you like, ticked off as you learn them. Search at the top of **Items** to
   put a specific character in — by shape, reading or meaning — and click it
   again to take it out.
6. **Put on paper** — everything, only what you have not learned yet, what the
   schedule says is due, the ones you keep missing, or a range like "#41 to
   #60". The page count follows along.
7. **Download** the worksheet, or **Test sheet** for the same characters with
   nothing to copy from. Either lands in your worksheets folder (Settings →
   choose one) or downloads normally, named after the collection and the
   slice. A test sheet then waits in Review to be marked.
8. **Texts** — plan a session of several passages at once, each with its own
   topic, length, level, form and however many new characters you want it to
   teach you. Copy the prompt into Claude, paste the reply back, and the set
   lands on the shelf. Read it with the pinyin and the translation off — then
   one line's number opens just that line, and any character opens its entry —
   or print it as a booklet with practice sheets for every character it taught.
   Coming back to a passage a week later is counted; re-reading is most of what
   turns decoding into reading.

## Addresses

Every page has a URL of its own, so reloading keeps you where you were, the
back button goes where you expect, and a bookmark on the iPad opens the page
it was made on.

| Address | Page |
| --- | --- |
| `/review` | what is due, and the drills |
| `/review/write?n=30` | one sitting of one drill (`recognise`, `sound`, `tone`, `confuse`, `word`, `write`) |
| `/review/sheets/<id>` | marking a printed test sheet |
| `/library` | browsing; `?q=hao&show=learned&sort=freq` keeps the filters |
| `/collections` | every collection, and the ready-made sets |
| `/collections/<id>`, `/collections/<id>/items` | one collection: how it prints, and what is in it |
| `/radicals` | all 214, ordered by how much of the syllabus each unlocks |
| `/radicals/sets`, `/radicals/sets/<id>` | radical sets, and one of them |
| `/texts` | the shelf |
| `/texts/session/plan`, `…/prompt`, `…/paste` | a writing session, step by step |
| `/texts/<id>` | one passage |
| `/pinyin` | pronunciation: the four tones, and the map of twenty tone pairs |
| `/pinyin/practice/<set>` | saying things out loud — `tone-2`, `pair-3-3` |
| `/pinyin/sounds/<lesson>?step=hear` | one sound lesson — how it is made, hearing it, saying it |
| `/pinyin/shadow?level=1&topic=food` | shadowing sentences with a natural voice |
| `/pinyin/talk` | a spoken conversation with Claude |
| `/pinyin/voice` | measuring your voice range, and checking your consonants |
| `/settings` | account, folder, appearance |
| `…?item=c好` on any page | the character drawer; back closes it |

Signed out, any of these asks you to sign in first and then takes you to the
page you asked for.

## Accounts, and where your work is kept

Everything you do — collections, what you have learned, review schedules,
printed test sheets, texts, the writing session in progress, settings — is kept
in your account on the computer that runs the app, in one SQLite file:

```
.data/hanzi-workshop.db
```

Changes are saved as you make them; a burst of typing becomes one save. The dot
in the top bar says where things stand: green is on the server, amber is on its
way, red is not saved yet — offline, say — with the reason in its tooltip.

- **Offline is fine.** If the PC goes to sleep in the middle of a writing drill
  on the iPad, the answers stay on the iPad and are sent when the server is
  back — even if you close the tab in the meantime.
- **Two devices at once is fine too.** Every save names the version it was
  built on. If the other device saved first, the server hands its version back
  and this device replays its own changes on top — so marking a sheet on the
  iPad while renaming a collection on the PC keeps both.
- **Sessions last thirty days** from the last time a device used the app.
  Changing your password (Settings → Account) signs every other device out.
- **Forgot the password?** On the computer running the server,
  `npm run admin -- reset-password <name>` prints a new one.

| Command | What it does |
| --- | --- |
| `npm run admin -- users` | lists the accounts |
| `npm run admin -- add-user <name>` | makes an account, even with sign-ups switched off |
| `npm run admin -- reset-password <name>` | a new password, and every session of that account signed out |
| `npm run admin -- backup [file]` | a consistent copy of the database, safe while the server runs — by default into `.data/backups/` |
| `npm run admin -- address [port]` | the address a tablet should open |

**Backing up** is copying that one file — or, while the server is running,
`npm run admin -- backup`. Deleting everything in an account is at the bottom
of Settings.

The server reads a few settings from the environment:

| Variable | Default | |
| --- | --- | --- |
| `PORT` | 4173 (`npm start`), 5173 (`npm run dev`) | |
| `HOST` | `0.0.0.0` | every interface, so a tablet can reach it |
| `HANZI_DB` | `.data/hanzi-workshop.db` | |
| `HANZI_REGISTRATION` | `open` | `closed` hides "Make an account" |
| `HANZI_TRUST_PROXY` | off | `1` only behind a reverse proxy you run |
| `HANZI_STATIC_DIR` | `dist` | the built app `npm start` serves |
| `AZURE_SPEECH_KEY` | unset | optional: a cloud voice behind the voice pack (see Pronunciation) |
| `AZURE_SPEECH_REGION` | unset | the key's region, e.g. `eastus` |

How it holds together: passwords are hashed with scrypt; a session is a random
token in an HttpOnly, SameSite cookie that the server stores only as a digest,
so it can be ended from the server; requests that change anything are refused
unless they come from the app's own pages; and sign-in attempts are rate
limited. On the home Wi-Fi the traffic is plain http, which is fine there and
not on a public network — put it behind HTTPS before it faces the internet.

## Reviewing

Marking a character learned used to be a promise you made to yourself, and the
app believed it forever. Now it is one record per character *per skill*, and
each one carries how long the memory is expected to hold:

| | what it asks | how it is graded |
| --- | --- | --- |
| **Recognise** | the character — what does it mean? | you say how it went |
| **Say it** | the character — how is it read? | you say how it went, and hear it |
| **Tones** | the syllable without its mark — which of five? | right or wrong, and how fast |
| **Look-alikes** | the reading and the meaning — which of these four? | right or wrong |
| **In a word** | the character inside a word you can already reach | you say how it went |
| **Write it** | the meaning and the sound, and an empty square | stroke by stroke, against the real medians |

Two findings do all the work and neither is controversial: you remember what
you were made to *retrieve*, not what you were shown again, and you remember it
longer when the retrieval was spaced out to the edge of forgetting. So a
success buys more time the closer you were to losing it, writing is scheduled
tighter than recognition because it decays faster, and a character you are
asked to write is one recognition has already established.

**Write it** works because the stroke data carries a median — the line down the
middle of each brush mark — for all three thousand characters. A drawn stroke
is matched against it: right stroke accepted, right line drawn backwards named
as such, a stroke out of order told which one it was. No recognition library,
nothing downloaded, and a tolerance set by measuring every stroke of four
hundred characters against every other stroke of the same character.

Nothing on screen can see the one thing that matters most, which is your hand
on paper. **Test sheet** prints the answers away — the reading, the meaning,
empty squares, and the key below a fold line — and remembers that it did. The
sheet waits in Review until you mark it, one click a line, and then a dozen
honest results about your handwriting arrive at once.

## What is on a sheet

A character block is a heading, then two columns, then the squares.

```
┌────┐  hǎo   good, excellent, fine                        100  HSK 1
│ 好 │  ────────────────────────────────────────────────────────
└────┘  6 strokes  ·  #82 most common

 STROKE ORDER                 │  COMMON WORDS
 [ ][ ][ ][ ][ ][ ]           │    hǎo chī
                              │    好吃   tasty; delicious
 BUILT FROM   side by side    │    hǎo kàn
 女  nǚ  woman                │    好看   good-looking
 子  zǐ  son                  │
                              │  IN A SENTENCE
 WHERE IT COMES FROM          │    wǒ hǎo pàng ó
 ▏A woman 女 with a son 子     │    我好胖哦。
                              │    I'm so fat.
                              │
                              │  DON'T CONFUSE WITH
                              │    如 rú   她 tā   妈 mā
├──────────────────────────────┴───────────────────────────────┤
│  米字格 squares: a few solid to trace, a few faint, the rest  │
└──────────────────────────────────────────────────────────────┘
```

The sections are read in one fixed order — learn to write it, see what it is
made of and where it came from, then meet it in words, in a sentence, and
against the things it gets mistaken for — and the page flows that sequence into
two equal columns, moving only the break point. So it always reads down the
left and then down the right, but a character with no components and no
look-alikes fills both columns instead of leaving half the paper empty. A third
of characters have no look-alikes and one in eight has no example sentence; with
the columns fixed, that showed as dead space. Flowing them wins a whole extra
row of practice squares for about one character in five.

Readings sit above the hanzi the way a textbook sets them. Example sentences
carry pinyin too, generated at build time by matching the longest word
CC-CEDICT knows at each position.

A few rules hold the page together:

- **Nothing is said twice.** The radical already stands among the parts under
  *built from* for 86% of characters, and is the character itself for another
  5%, so the heading does not repeat it. It is named up top only for the 9%
  where the page would otherwise not show it at all — and then it is spelled
  out ("radical 乚 second") rather than left as a bare glyph.
- **One accent, one job.** The accent colour means pronunciation — pinyin, and
  the newest stroke in the stroke strip. Nothing else. Rules, labels and panels
  are neutral, so a glance separates *how it sounds* from everything else
  without reading a word.
- **Six type sizes**, each with a role: the reading, the definition, running
  text, glosses, labels, page furniture. A seventh size would be an exception,
  not a hierarchy.
- **Labels are small caps, tracked, in the lightest grey** that still holds on
  paper. They index the page; they are not part of it.
- **The writing area is the destination.** The grid carries a slightly firmer
  frame so it reads as somewhere to go rather than more furniture.

## How much fits

**How many to a page** is the one control that decides the rest. Each choice is
a designed sheet, not a squeeze:

| Per page | What is on it |
| --- | --- |
| **2** | Everything: stroke order, what it is built from, where it comes from, three words, a sentence, look-alikes. |
| **3** | Drops the example sentence and the origin note. Two words. |
| **4** | Stroke order, the components on one line, two words. Nothing else. |

A radical sheet is arranged the same way and asks the same question, but what
the answer decides is different: a radical block is a heading and then **one row
of squares for every way the radical is written**, each row opened by a line
naming that form — 忄, on the left, three strokes, its stroke order, and 快 忙 怕.
So two, three, four or six to a page is really "how many forms get a row of
their own"; at six they share one row, split between them.

Sections are left out **by the profile**, before anything is drawn, and the
editor names the ones that go — rather than the old behaviour of discovering at
the bottom of a block that there was no room.

There is deliberately no panel of content switches. Eight of them produced
sheets nobody could describe ("HSK 1, but with the sentence off and look-alikes
on"), and at any given size most were disabled anyway. One control decides what
a sheet says, and it is the one you were already choosing. Where a particular
character is so dense that even its profile cannot fit everything, the editor
says which section gave way.

Square size, the number of rows to write, and how many squares are pre-filled
(solid to trace, then faint) are yours.

## How it looks

Five colourways and four designs, and they compose.

A **colourway** is one accent and a grey ramp tinted towards it, which is what
makes them read as different papers rather than the same sheet with the red
swapped: hairlines, practice grid and body copy all lean the same way, by about
a hundredth. *Cinnabar* 朱砂 is the house style; *Indigo* 靛青 and *Pine* 松绿
are cooler; *Plum* 紫檀 is a mulberry accent on faintly violet paper; *Graphite*
墨 has no colour at all and is what a mono laser actually prints — its component
tints become four values rather than four hues, so they still tell four parts
apart in black and white.

A **design** changes the furniture, never the geometry:

- **Classic** — an accent tab, hairline dividers between characters, dashed
  guides in the squares.
- **Workbook** — a tinted band behind each heading and rules running out from
  each label, like a 练习本. Solid guides.
- **Quiet** — the one that takes things away: no box around the character, no
  frames in the stroke strip, no border on the writing area, no rules, no
  panels, no accent. Dotted guides. Pairs with Graphite for a sheet that costs
  almost nothing to print.
- **Card** — each character in its own frame, drawn in the gutter between
  blocks. Easiest to cut up and shuffle.

The constraint that keeps this safe on paper: a design may only spend space
that was already empty. Where the heading sits, how tall each section is, where
the grid starts — all of that comes from the layout tables, identically for all
four, so switching design can never push a section off a page or shift a
square. That is why the framed style draws its box in the gap between blocks
rather than insetting the block.

## Radicals

The pieces characters are built from, at **/radicals** — a section of its own,
because they are a different kind of thing. You learn the common ones early, as
shapes, and then stop studying them; characters you study for years and the app
schedules for review. While the two shared a screen, every character page had to
filter radicals out of itself and every radical sheet inherited choices — "due
for review", "the ones I miss" — that could never mean anything for a radical.

The thing worth having is the forms. A radical is not one shape:

| | | |
| --- | --- | --- |
| 心 heart | 忄 on the left of 快 · 心 under 想 · ⺗ under 恭 | three shapes |
| 水 water | 氵 河 · 水 泉 · 氺 求 | three |
| 肉 flesh | ⺼ 脑 · ⺼ under 育 · 肉 alone | drawn exactly like 月 |
| 土 earth | 土 地, where the last stroke rises · 土 坐 | the same glyph, written differently |

Each form is cut out of a real character at build time — the strokes of 忄 are
lifted from 快 — so the practice squares ask for it at the size and in the place
it truly has, rather than centred and enlarged until it teaches the wrong
proportions. Every form carries its own stroke order, its own colloquial name
(竖心旁, 心字底) and its own examples, read and glossed.

The rest of a radical's entry is what a beginner actually needs: what it means
*as a part of other characters* (阝 on the left is a hill, on the right a city;
王 on the left is jade, not king), what characters built on it tend to be about,
and what it gets mistaken for (three dots is water, two is ice).

Sets work like collections: a named run of radicals, printed all at once, only
the ones you have not ticked off, or a range. Ready-made ones cover the first
20, the top 50 and 100, all 214, the radicals that change shape, and the ones a
dot apart printed side by side.

## Pronunciation

At **/pinyin**, for saying things rather than reading them. A tone you can pick
out of five in the Tones drill is not yet a tone you can say, and nothing on a
screen could tell you which one came out — until now.

**What it checks, and how.** The microphone's samples are read straight off the
audio graph (echo cancellation, noise suppression and automatic gain switched
off — they are built for calls and all three bend pitch), and the pitch is
tracked with YIN, frame by frame, on the device. The recording is cut into as
many syllables as the word has, and each syllable's pitch is put on *your own*
five-point Chao scale — 1 the bottom of your voice, 5 the top — and compared
with the four tone shapes by shape and by height. What comes back is a line on
a staff, your voice over the dashed shape it should have had, and per syllable
*right*, *nearly* or *not yet*, with one sentence saying what to change in terms
an English speaker already knows how to do ("a firm *No!*").

- **Sandhi first.** The data prints citation tones; people do not say them. The
  expected tones go through the rules for 3+3, 一 and 不 before anything is
  judged, and a third tone with something after it is expected low rather than
  dipping. Say 水果 with two textbook thirds and it tells you the rule, not just
  the shape.
- **Your range, measured once.** Say mā má mǎ mà on **/pinyin/voice** and the
  bottom of your third and the top of your first become the scale. Without it,
  height is guessed from each recording and the page says so.
- **Pairs are the curriculum.** Twenty of them — four tones, then any of the
  four or a neutral — each filled with the most elementary words that have it,
  from the words the app already ships. Words whose tones 一 or 不 change are
  kept out, since 一起 is written 1+3 and said 4+3.
- **Consonants, roughly.** Pitch cannot see q against ch. The browser's own
  speech recognition can, crudely: it writes down what it heard, and the two
  are compared sound by sound — initial and final, tone left to the pitch — so
  hearing 事 for 是 is no mistake and hearing 吃 for 七 is "q heard as ch".
  Safari sends that audio to Apple and needs Siri & Dictation on; it is marked
  experimental, and without it the page falls back to recording yourself and
  playing the two back to back.

**Seven sound lessons** cover what gives an English speaker away: j q x, zh ch
sh r, z c s, the puff that separates b from p, ü, -n against -ng, and the
finals pinyin spells short (ui is uei, iu is iou). Each is three steps — what
the mouth does, with the nearest English sound and the usual mistake; ten
rounds of telling minimal pairs apart by ear (七 or 吃?), because a sound you
cannot hear is a sound you cannot aim at; then words to say. Every pair shares
a tone and differs in the one sound, and every reading is checked against the
dictionary by the tests, so a typo fails the build rather than teaching the
wrong sound.

**How often it agrees with a native speaker.** `npx tsx scripts/voices/evaluate.ts`
runs the checker over 1,622 recordings of a native speaker saying every
syllable in every tone, and it agrees with the speaker 99.0% of the time
(first 99.5%, second 100%, third 98.5%, fourth 97.8%). Two fixes got it there,
both found only by trying real voices: a real second tone starts with a small
dip, so second and third are told apart by *where* the dip is and how deep it
goes rather than by overall shape; and a fourth tone in a high voice falls too
fast for a 40 ms window, so frames the long window cannot place are filled
from a 20 ms one. Fourteen of those recordings are test fixtures.

**The chart is optional.** Settings → Pronunciation → *Show the pitch chart*.
On, you get the staff, your line over the speaker's, and a sentence on what to
change. Off, there is no chart and no commentary: each syllable is simply
marked as understood or not, and in a shadowed sentence the characters
recognition misheard are marked under the text. Some days the answer to "was
I understood?" is the whole of what you want.

**Shadowing**, at **/pinyin/shadow**: three hundred short everyday sentences,
HSK 1 to 3, each with a translation and sorted into the app's topics, to say
along with a natural voice. The two melodies — the voice's and yours — are
drawn one over the other; the sounds are checked by speech recognition, which
is at its best on a whole sentence. "Voice, then me" plays the two back to
back. The sentences are Tatoeba's (CC BY 2.0 FR). Tatoeba's own Mandarin
*recordings* are not used: all but 84 of them carry no licence to reuse
outside the site.

### The voice pack

What the section says aloud comes from `public/voices/`, built on the Mac with
`npm run voices` — no account and no key anywhere, so there is nothing for a
provider to refuse or block, and it plays the same over the Wi-Fi, on Vercel
and offline.

- **Single syllables are a real person**: the public-domain recordings of
  every syllable in every tone ([mp3-chinese-pinyin-sound](https://github.com/davinfifield/mp3-chinese-pinyin-sound),
  Unlicense). That covers the four tones one at a time and every minimal pair
  in the sound lessons.
- **Words and sentences are Qwen3-TTS** (0.6B CustomVoice, Apache-2.0, run
  through MLX), in three of its Mandarin voices, plus **Chen**, a young man's
  voice *designed from a description* with Qwen3-TTS VoiceDesign and cloned
  from one reference so it stays one person — a kind of voice, not a copy of
  anybody's. Chen reads the way a patient teacher reads for a beginner —
  1.7 characters a second against the other voices' 4.6, with the pauses left
  in — and reads the sentences, which is where a voice you like earns its
  keep. Cloning copies pace and manner as much as timbre, so that is decided
  by the reference passage the voice is designed on, not by a knob.
- **Every tone-critical machine clip is checked** by the same pitch analysis
  the learner gets, on that voice's own range, and left out if it fails: a
  reference that says the wrong tone is worse than the system voice. A clip
  whose syllables are at worst *nearly* — the check's own word for a shape it
  could not split — is kept. Each word is said once: making the machine repeat
  refused words did raise the count with a voice, but the tones that matter
  most are single syllables, and those are a person's. 206 of the 240 tone-pair
  words have a machine voice; the rest fall back to the system one. Kokoro was
  tried first and dropped when barely a third of its clips passed.
- **Clips are cut to where the voice is.** A generated voice often starts with
  a small intake of breath, and trimming silence keeps it, a breath being
  louder than silence. So the first voiced frame is found and the consonant in
  front of it followed back only while the sound runs on — a breath, separated
  by a gap, stays outside.
- With a pack clip, the dashed line on the staff is that voice's own pitch
  rather than the textbook shape. You can pick a voice on the front page, or
  leave it on *Any*, which rotates them — hearing a sound in several voices is
  what teaches the ear which part is the sound.

`scripts/voices/` holds the pipeline: `sentences.py` picks the sentences,
`generate.py` voices them, `check.ts` gates them, `encode.py` makes the MP3s,
`build.ts` runs it all. Setting up the Python side once is in `generate.py`.

A cloud voice can still stand behind the pack for anything it lacks: with
`AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` set, `/api/speech` reads with
Azure's neural voices (signed in, rate limited, cached a year by the browser).
Nothing needs it.

The microphone needs a secure page. The online version is https and works; on
the home Wi-Fi at `http://192.168…` the browser offers no microphone at all,
and the page says so. Your voice range and scores are kept on the device for
now, not in the account.

### Conversation

At **/pinyin/talk**, talking with Claude out loud. Claude opens with a question
on something everyday, at HSK 1, 2 or 3; you answer by speaking; the browser's
speech recognition writes down what it heard, in characters, as you talk; and
Claude answers that, read aloud. Every line shows its pinyin, and the English on
request.

**What comes with the answer is yours to choose**, and all of it is asked for in
the same turn, so none of it is a second wait:

- **A topic** before you start — the app's own topics as chips, or anything at
  all in your own words. Claude stays on it until you change the subject.
- **How long a turn is**: one sentence, one or two, or three or four.
- **New words**: the words in Claude's turn that are probably new at your
  level, each one sayable on its own with a tap.
- **Hints**, for when the next thing to say will not come: two or three things
  you could say back, behind a button until you ask for them, each one you can
  hear or drop into the box to say yourself.
- **Explain**: a line of English about one thing in Claude's turn — a word, a
  pattern, the word order.

An option that is off is left out of the request altogether, because every
extra field is more for Claude to write before the voice can start.

**No API key, and nothing paid beyond your Claude subscription.** Claude is
reached one of two ways:

- **At home, by itself.** The server runs Claude Code headless (`claude -p`)
  for each turn, and Claude Code signed in to a Pro or Max plan answers from
  that plan. It runs as a plain chat partner — no tools, no project
  instructions, nothing saved — and it is given a short list of environment
  variables and nothing else, so an `ANTHROPIC_API_KEY` lying around can never
  quietly bill a turn. A Claude Code signed in with an API key is refused
  outright. It needs signing in once, in a terminal on the computer running the
  app:

  ```bash
  claude auth login
  ```

  and choosing your Claude account, not the Console. On a Mac without `claude`
  on the PATH, the copy the Claude desktop app bundles is found by itself, and
  signed in the same way:

  ```bash
  "$(ls -d "$HOME/Library/Application Support/Claude/claude-code/"*/claude.app/Contents/MacOS/claude | sort -V | tail -1)" auth login
  ```

  `HANZI_CLAUDE_BIN` points at a `claude` somewhere unusual,
  `HANZI_CLAUDE_MODEL` picks the model (`sonnet` by default; `haiku` is
  quicker), and `HANZI_CLAUDE=off` turns it off.
- **Anywhere else, through your own Claude chat.** On Vercel there is no Claude
  Code to run, so the page hands you each turn to copy into a Claude chat and a
  box to paste the answer back into. The first copy carries the instructions;
  after that only what you said.

**Claude's answers in the pack's voices.** The server keeps
`scripts/voices/speak.py` running beside it with Qwen3-TTS loaded, and reads
each sentence of an answer as it comes — Chen, Vivian, Serena or Dylan — the
next sentence being made while the first plays. On an M2 that is about eight
seconds for the very first sentence (the model loading, which starts as soon as
the page opens) and then roughly as long to make as to hear. It needs Apple
silicon and the Python setup from `generate.py`; `HANZI_LOCAL_VOICES=off` turns
it off. Elsewhere — Vercel included — the system voice reads instead. These
live voices are used for the conversation only: in the rest of the section a
word without a pack clip falls back to the system voice on purpose, because its
machine clip failed the tone check.

## Reading passages

A session runs in three steps, on its own page.

**Plan.** One card per passage. Each one carries a topic, a length, a form —
story, dialogue, diary, letter, news — whether it ends in questions, an
optional grammar point to build it around, and two numbers: the **level**, which
is simply how far past what you can already read this one should go, and how
many characters it may **teach** you. Which characters those are is not decided
here. A word picked to fit a story earns its place; a word picked off a
frequency table needs a story built around it, so the budget goes in the brief
and the choosing happens where the writing happens.

**Prompt.** The plan becomes a prompt: your inventory in full, the rules as
rules, one brief per passage, and the shape the answer has to come back in.
Copy it, paste it into Claude, and come back. The session is saved to your
account, so closing the tab or finishing tomorrow — on another device — costs
nothing.

**Paste back.** Paste the reply — the whole thing, code fence and commentary
and all. It is read tolerantly: fenced or not, one message or two, with a
trailing comma, a stray comment, a wrapped line inside a string, or cut off
halfway. Each passage is matched to the brief it answers, and then measured
against your inventory: what percentage of it you could already read, and
exactly which characters were new — not the ones the writer *said* it taught,
but every character in the passage that was not already yours. That list is
what goes onto the practice sheets, so it has to be the true one. Anything that
looks wrong can be left out; the rest is saved, and the new characters are
queued as a collection to practise by hand.

A session is meant to be read straight through, so a passage knows which one it
is: arrows in the bar, the next title at the foot of the page, and moving on
marks the one behind you as read.

The printed version is a reading sheet, not a grid: what is new stated at the
top before you meet it, the passage set large with its pinyin and translation
and the new characters underlined where they fall, the vocabulary, the grammar
the passage was written to show, the questions with a line to answer on, and
ruled lines for copying out whatever you want to keep. Behind it, unless you
turn them off, come practice sheets for every character it taught — the same
block a worksheet uses. Print the session and you get one file: a contents page,
every passage in order, and one run of practice sheets at the back covering
everything the session taught.

## Rebuilding the data

The JSON in `public/data/` and the fonts in `public/fonts/` are generated. To
rebuild them:

```bash
npm run data
```

That runs `scripts/build_data.py` (the characters), then
`scripts/build_radicals.py` (the radicals), then `scripts/build_fonts.py`
(needs `fonttools` and `brotli`: `pip install fonttools brotli`). Raw sources
are cached in `.cache/` and re-downloaded if missing.

The radical build writes `.cache/radicals-report.txt`: every radical, every
form, and the examples chosen for each — the file to read when checking whether
the data is right, rather than clicking through 214 cards.

`scripts/preview.ts` renders one sample of every profile, colourway and design
straight to `.cache/preview/*.pdf` without opening the browser:

```bash
npx tsx scripts/preview.ts
```

## Where everything comes from

| Data | Source | Licence |
| --- | --- | --- |
| HSK 3.0 character and word lists (all nine bands) | [elkmovie/hsk30](https://github.com/elkmovie/hsk30), OCR'd from the 2021 standard by Pleco | MIT |
| Stroke outlines and decompositions | [Make Me a Hanzi](https://www.skishore.me/makemeahanzi/) / [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data), derived from Arphic's Kai typefaces | Arphic Public License |
| Definitions and pinyin | [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cedict) | CC BY-SA 4.0 |
| Character frequency, Kangxi radical numbers | [hanziDB](https://github.com/ruddfawcett/hanziDB.csv), after Jun Da | MIT |
| Word frequency | [jieba](https://github.com/fxsjy/jieba)'s dictionary | MIT |
| Example sentences | [Tatoeba](https://tatoeba.org/) | CC BY 2.0 FR |
| Syllable recordings (pronunciation) | [mp3-chinese-pinyin-sound](https://github.com/davinfifield/mp3-chinese-pinyin-sound) | Unlicense (public domain) |
| Word and sentence voices | [Qwen3-TTS](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice), generated locally | Apache-2.0 |
| Chinese text face | [LXGW WenKai 霞鹜文楷](https://github.com/lxgw/LxgwWenKai) | SIL OFL 1.1 |
| Latin text face | [Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans) | SIL OFL 1.1 |

Everything about the radicals that no dataset carries is hand-written in
`scripts/radicals_table.py`: what each one means as a part of other characters,
the colloquial names (三点水, 提手旁 …), the look-alike warnings, and every way
each one is written with the character its outline is cut from. The build checks
each entry against the sources and fills in the counts and the examples, so a
wrong host or a made-up example fails the build rather than reaching paper. The
character "don't confuse these" notes and the fifteen topic sets are still in
`scripts/build_data.py`; topic sets are filtered against the syllabus at build
time, so a typo drops a character rather than producing a collection that will
not render.

Two things worth knowing if you touch the rendering code. pdf-lib's
`embedFont(..., { subset: true })` silently wrecks these fonts — the text layer
survives but almost every CJK glyph vanishes — so the faces are cut to size by
`build_fonts.py` instead, in two tiers: sheets that stay inside HSK 1–3 embed a
face half the size. And hanzi-writer's outlines use a y-up coordinate system,
so they are mirrored before drawing or every character prints upside down.

## Work from before accounts

Until accounts existed, everything lived in the browser's `localStorage`, one
copy per address. The first time you sign in in a browser that still has such
a copy, it is brought into your account — automatically for an account with
nothing in it yet, and after asking for one that already has work, in which
case the two are merged: everything from both sides, and where both have the
same thing, the more recent edit or review. The browser's copy is removed only
once the server has confirmed it has the account's.

Older formats still open on the way in. Work from when the app had templates
is stitched back into single collections; work from before there were review
schedules turns every tick into a record marked *believed, not verified*,
falling due over the following three weeks, oldest tick first — so the first
few sessions after that are an audit of what you had claimed, which is the
honest place to start. Worksheet PDFs are written straight to a folder you
nominate, using the File System Access API (Chrome and Edge); elsewhere they
download normally.

## Tests

```bash
npm test
npm run typecheck
```

The server's use cases and its HTTP API run against an in-memory SQLite:
accounts, sessions that expire and renew, a password change signing other
devices out, saves refused on a stale revision, cross-site requests refused,
password guessing slowed down. On the app's side, the reducer is checked for
changes that stay correct when replayed, and the sync engine for the cases that
matter on a tablet: another device saving first, the server going away and
coming back, a closed tab's unsaved work picked up by the next page, and a tab
that must not save twice what another tab has taken over.

The Postgres storage has tests of its own, because it is the one part that runs
only when deployed and would otherwise first be tried in production. They run
against real Postgres — PGlite, which is Postgres compiled to WebAssembly — so
the dialect, the unique constraint, the cascade and the compare-and-swap that
decides which of two devices wins a save are all exercised for real.

## Layout

```
public/data/          generated JSON: characters, radicals with their forms,
                      topics, stroke outlines
public/fonts/         subsetted WenKai + Noto Sans, for the page and the PDFs
scripts/              data and font builds, the server bundle, a headless PDF preview
shared/               what the app and the server agree on: every request and
                      response, and the rules for a name and a password

server/src/
  domain/             what the server keeps — accounts, sessions, one workspace
                      each — and the failures it can name
  application/        the use cases, and the ports they need from outside
  infrastructure/     scrypt, tokens, the clock: one answer to each port, and
                      the two stores — sqlite/ at home, postgres/ on Vercel
  http/               routes, guards (session, same origin, rate limits), static files
  composition.ts      which implementation stands behind each port
  main.ts, dev.ts     the production server; the development server with Vite inside
  cli.ts              the admin commands
server/test/          use cases and the HTTP API against in-memory SQLite,
                      and the Postgres storage against Postgres itself
api/                  the same server as one Vercel function

src/
  domain/             the model, with no React and no DOM in it —
                      ids, collections, sheet options and what each size can hold;
                      radicals/, which shares none of that: forms, sets, sizes;
                      memory and drill, the scheduler and what to ask next;
                      stroke, which decides whether you drew the right one;
                      vocab and series, words and sound families;
                      plus the teacher: what to learn next, the prompt, the parser
  data/               loading the generated JSON
  store/              the workspace: every change as an action, the reducer,
                      the commands screens call, and reading old formats back
    sync/             saving to the server — revisions, replaying on conflict,
                      the queue kept in the browser while offline
  api/                the HTTP client for the server
  platform/           what the browser offers: files and folders, the clipboard,
                      speech, ids
  navigation/         every address, the query as page state, scroll positions
  pdf/
    theme/            colourways and designs
    layout/           page geometry, the four size profiles, the practice grid
    blocks/           one character, one reading passage, one recall prompt
                      with the answers taken away
    radicals/         the radical sheet: its sizes, its block, its renderer
    draw.ts           the page as a top-left coordinate system, theme-aware
    render.ts         document assembly
  features/           auth, review, library, collections, radicals, reader,
                      settings — one each, and shared/ for what several of them
                      use
  ui/                 the pieces they share: a card, a glyph, a modal, a toast,
                      drag-to-reorder, a square to write in, a voice
  app/                the app assembled: providers, routes, the page frame, and
                      the gates in front of it — signed in, workspace open, data here
printable/            the reference PDFs this design was drawn from
```

The rules the folders enforce. `domain` knows nothing about React, the DOM or
the network. `pdf` knows nothing about the store. `store` knows nothing about
HTTP: the sync engine is handed the server as an interface, and `api/` is what
implements it. A feature folder is the only place that knows both the model and
React, and `app/` is the only place that knows every feature. The server has
the same shape — domain, then the use cases, then SQLite and HTTP on the
outside, wired together in one file — and `shared/` is the one thing both sides
import. So "what a collection is" is still one file you can read in a minute,
and changing how a sheet looks, or where it is saved, cannot change what a
collection means.
