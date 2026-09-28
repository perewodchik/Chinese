/**
 * Live conversation — the hook for later (prompt §4.6, concept §8). DISABLED
 * AND UNUSED in this build: nothing constructs it, and it makes no network
 * calls. It is here so the day Claude joins the game, nothing else has to
 * change shape.
 *
 * How it will work:
 *
 * - It implements `DialogueSource` like `ScriptedDialogue`, and keeps one
 *   inside. The script stays the authority: every turn first runs through
 *   the script, so the intent, the next node, the actions (items, money,
 *   quests, stamps, spirits) and every 📌 key line are the script's. Claude
 *   only rewrites the *words* of an ordinary line and may answer free
 *   questions ("你家在哪儿？") with a line of its own that changes nothing.
 * - The request goes to the Mac home server, the way /pinyin/talk does
 *   (`server/src/http/routes/talk.ts`: `claude -p` on the learner's own
 *   subscription, a relay fallback): POST /api/world/talk with the NPC's
 *   card (who they are, what they know and want, the actions they may take),
 *   the scene's situation words, the node the script chose, the learner's
 *   line and the word budget (HSK 1–2, the chapter's allowances) — never the
 *   whole save.
 * - It answers within `timeoutMs` or not at all: a slow or failed request
 *   quietly falls back to the script's own line, so the game never waits.
 * - It is switched on by `settings.live` (Settings → "Live conversation",
 *   off by default; the flag exists in the save now but no UI shows it).
 * - Its lines are checked by the same budget (`core/budget.ts`) before they
 *   are shown; a line that fails is replaced by the script's.
 */

import type { Scene, WorldSave } from '../types';
import type { DialogueSource, DialogueState, Turn, Utterance } from './source';

/** Off in this build; flipping it does nothing until `rewrite` is written. */
export const LIVE_DIALOGUE_ENABLED = false;

export interface LiveOptions {
  /** ms to wait for the server before the script's own line is used */
  timeoutMs: number;
}

export class LiveDialogue implements DialogueSource {
  constructor(
    private script: DialogueSource,
    readonly options: LiveOptions = { timeoutMs: 2500 },
  ) {}

  start(scene: Scene, save: WorldSave): Turn {
    return this.script.start(scene, save);
  }

  /** The script decides; a live source may only reword `say` of a normal line — not yet. */
  reply(state: DialogueState, utterance: Utterance): Turn {
    return this.rewrite(this.script.reply(state, utterance));
  }

  proceed(state: DialogueState): Turn {
    return this.rewrite(this.script.proceed(state));
  }

  /** Where Claude's wording will go. Key lines and actions are never touched. */
  private rewrite(turn: Turn): Turn {
    if (!LIVE_DIALOGUE_ENABLED || !turn.say || turn.say.key) return turn;
    return turn;
  }
}
