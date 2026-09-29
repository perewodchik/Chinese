# 走走 — dialogue window rework (built 2026-09-29)

What the user flagged, from two screenshots (the recycler 收破烂儿的师傅, the 早点铺 counter):

1. 兔儿爷's "What did they say?" translated only the **last** line; an NPC often says two or three in a turn.
2. The dialogue box looked like the app's cards (`--card`, 1px line, big radius, emoji buttons), not like the cozy pixel game around it.
3. Duplicated controls: 兔儿爷's **Again?** = the box's 🔁, and his **Help me answer** = the input bar's 💡.
4. The 支付宝 phone overflowed the box: 付款 cut off, the talk above squashed to one clipped row.
5. Voice input sent itself after 1.5 s, and the hold-to-talk interface was unpleasant.

User's decisions: keep hold-to-talk (next to tap-to-talk); 「慢一点」 is free; NPC lines appear whole (no typing out).

The rule for who does what:

- **The dialogue box is your mouth.** Everything in it is something you say or do in the world, and the NPC reacts.
- **兔儿爷 is your head.** Asking him costs nothing and nobody in the world hears it: meaning, hints, what now.

## Built

**D1 — 兔儿爷 translates the whole turn.** `turnOf(history)` = every NPC line since your last reply; `translateAnswer(turn, why, speakerName)` gives one English line per line, another speaker's with their name; `glossTurn` makes the word chips from the whole turn. (`companionLines.ts`, tests in `companion.test.ts`.)

**D2 — one job per control.**
- 兔儿爷's options: What did they say? · Help me answer (with a hint left) · What now? — no Again. A pixel **?** bobs over his head when you have missed at a line and he has a hint.
- The input bar has no 💡: hints are asked of him; his chips still show above the field.
- The row above the field, when nothing else is in it, holds **things you can always say**, sent as your line and answered by them: 「再说一遍」 「慢一点」 「听不懂」 「…是什么意思？」 (→ the words of their turn, the ones you do not know first → 「旧是什么意思？」). (`ASKS`, `askMeaning` in `typing.ts`.)
- 再说一遍 / 慢一点 repeat **their latest line** (an order's running total, the price on the table), not the node's script line (`againOf` in `useTalk.ts`, tested).
- The header 🔁 is gone; each NPC line has its own pixel speaker (and **R** replays the latest).

**D3 — a game text box.** The pixel frame of 兔儿爷's bubble (`--px-frame` on `.world-shell`), a framed portrait, name + hearts, square pixel buttons with `PixelIcon`s (拼, ×, mic, keys, face, send), older lines smaller and dimmer, your lines as small pixel tags, a blinking pixel ▼ on Go on. Lines appear whole.

**D4 — the phone is a phone.** `PhonePay` is no longer inside the box: `.wd-stage[data-phone]` puts it beside the box (iPad), or under a short box (phone portrait); smaller keys on a short screen; 付款 full width; the head never wraps; `¥0.00` placeholder. While paying the box keeps its row of things to say (再说一遍 to hear the amount again).

**D5 — voice waits for you.** Tap to talk and tap to stop, or hold and let go (`HOLD_MS`). What was heard is never sent by itself: it waits in hanzi and pinyin, and the row above says *Again · Change · Throw away*; ➤ or Enter sends, Esc throws it away. Three hopping pixel bars while listening.

## Quality of life, also built

- **What they want** (`talkWant.ts`, tested): in the nameplate, in place of the role — `You have ¥191 · ordered 包子×2`, the recycler's `He buys old things — you have 旧手机、旧书` / his offer, `on the table: ¥15` at a stall, what to do at the phone, a pick or write line, a key line.
- **✓ / ?** on each of your lines: whether they understood it.
- **↑** in an empty field brings back what you said last.
- **R** hears their latest line again.

## Checked

- Unit tests (world: 316+), `tsc -b`.
- The Browser pane at 800×600 and 375×812: an order, 再说一遍, …是什么意思, paying on the phone, the rabbit's whole-turn translation, voice with a stand-in recogniser (tap/tap, nothing sent until Enter).
- `node scripts/world/talk-probe.mjs webkit` (Playwright WebKit, 375 / 768 / 1024, light and dark): no sideways scroll, nothing past the edge, head/phone head not overflowing, 付款 inside the phone; screenshots in `review/d`.

## Suggestions not built yet

- **Show the menu at a counter**: a small 菜单 card (the stock with prices, in hanzi + pinyin) that slides out of the nameplate — reading the menu is real-life practice and tells you what you can order.
- **Their voice by itself — a setting**: "voices play by themselves" on/off in the game settings, for quiet places (the per-line speaker then does it).
- **Your line read back**: a speaker on your own sent line that says it in the hero's voice, to hear how it should sound.
- **Voice: which words were heard well** — mark the words of a heard line that matched the expected answer, so a misheard word is easy to spot before sending.
- **The racks and the barber** (another session's W5 rack talks) in `talkWant`: what is on the rail and your money.
- **Long talks**: a thin divider between turns in the history, so the eye finds where the last turn began.
