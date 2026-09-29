/**
 * The one way a conversation is had (prompt §4.6).
 *
 * `ScriptedDialogue` implements it now. A `LiveDialogue` (Claude through the
 * Mac server, later) will implement the same thing and may say free lines,
 * but key lines, actions and quest progress still come from the script:
 * whatever a live source says, it reports the script's `intent`, and the
 * turn's `actions` are the script's.
 */

import type { SaveAction } from '../save';
import type { Scene, WorldSave } from '../types';

/** One line on screen. */
export interface Line {
  /** an NPC id, 'hero' or 'companion' */
  speaker: string;
  zh: string;
  /** manual pinyin when the script gives one; otherwise the build adds it */
  pinyin?: string;
  en: string;
  /** a 📌 key line */
  key?: boolean;
  /** hear it first: the words stay hidden until shown */
  listen?: boolean;
  /** the node it comes from ('' for a line not in the script, like 不客气) */
  node: string;
  /** said slowly (慢一点) */
  slow?: boolean;
  /** the line as written, when it has the player's name in it (X2): its clip is of the nameless line */
  tpl?: string;
}

export interface Utterance {
  text: string;
  /** voice input is hanzi guessed from sound, so a sound-only match is kept with a note */
  via: 'voice' | 'keyboard';
  /** a sticker sent instead of words (X6): understood as the word it stands for */
  sticker?: string;
}

export interface DialogueState {
  scene: string;
  node: string;
  /** misunderstood lines in a row at this node */
  misses: number;
  /** how far the companion's hint has gone at this node, 0–3 */
  hint: number;
  ended: boolean;
  /** the player's name, for lines that say it (X2) */
  name?: string;
}

/** What happened to the player's line. */
export type TurnKind =
  | 'start'
  | 'match'
  | 'continue'
  | 'repeat'
  | 'slower'
  | 'simpler'
  | 'explain'
  | 'polite'
  | 'not_chinese'
  | 'miss';

/** What the companion should offer, unasked, after this turn. */
export type CompanionCue =
  | { kind: 'hint'; step: 1 | 2 | 3; text: string }
  | { kind: 'not_chinese'; text: string }
  | { kind: 'explain'; word: string; py?: string; en?: string }
  | { kind: 'heard'; text: string };

export interface Turn {
  kind: TurnKind;
  /** the NPC's line, or null when the talk simply ends */
  say: Line | null;
  intent?: string;
  /** to apply to the save, in order */
  actions: SaveAction[];
  end?: boolean;
  /** an English note for the companion (misheard words) */
  note?: string;
  companion?: CompanionCue;
  state: DialogueState;
}

export interface DialogueSource {
  /** the first NPC turn of a scene */
  start(scene: Scene, save: WorldSave): Turn;
  /** the player said something; may become async in a live source */
  reply(state: DialogueState, utterance: Utterance): Turn;
  /** tap to go on, at a node that expects nothing */
  proceed(state: DialogueState): Turn;
}
