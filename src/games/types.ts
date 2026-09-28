import type { ComponentType } from 'react';
import type { Library, SyllabusWord } from '../data/types';
import type { CollectionWord } from '../domain/collection';
import type { ItemId } from '../domain/ids';
import type { Rng } from './kit/rng';

/**
 * The contract every game keeps — the whole of what the Play section knows
 * about one.
 *
 * A game is a folder under src/games with a manifest and a component, and one
 * line in registry.ts. It is handed everything it may use (the library, the
 * pictures, which words have a native recording, what the learner knows, a
 * seeded random source) and reports each prompt as it is answered. The host
 * draws the frame, the progress, the results and the seal, and keeps the
 * record; a game never touches the store, the router or another game.
 */

export type Band = 1 | 2;

export type GameTopic =
  | 'place-words'
  | 'measure-words'
  | 'time'
  | 'money'
  | 'vocabulary'
  | 'listening'
  | 'characters'
  | 'compounds'
  | 'word-order'
  | 'family'
  | 'colours'
  | 'opposites'
  | 'ordering';

export type GameNeed = 'images' | 'native-audio' | 'drag';

export interface GameManifest {
  /** URL-safe and permanent: the record is kept under it */
  id: string;
  name: string;
  /** one character for the card */
  mark: string;
  /** one sentence, second person */
  blurb: string;
  bands: Band[];
  teaches: GameTopic[];
  needs?: GameNeed[];
  /** prompts in one round; the host may be asked for fewer */
  rounds: number;
  /** whether this learner, at this band, has enough for a game */
  available(ctx: GameContext): { ok: true } | { ok: false; reason: string };
  /** each game is its own chunk, loaded when it is opened */
  load(): Promise<{ default: ComponentType<GameProps> }>;
  /** a 点单 shop: shown in its own section of the Play page, as a shopfront */
  shop?: ShopFront;
}

export interface ShopFront {
  latin: string;
  /** what the shop is, in a few words: "Coffee · pick up" */
  kind: string;
  /** a key into the menu photos (public/images/menu/<key>.jpg) */
  photo: string;
  /** the brand's colour, behind its name */
  colour: string;
}

export interface GameContext {
  lib: Library;
  band: Band;
  /** HSK words up to the band */
  words: SyllabusWord[];
  /** the photo a word shows, by concept (今天 and 明天 share one), or null */
  pictureOf(w: string): string | null;
  /** texts the voice pack has a native recording of */
  native: Set<string>;
  /** items learned or in rotation — games lean towards these, never only these */
  known: Set<ItemId>;
  rng: Rng;
}

/** One prompt, answered. */
export interface RoundResult {
  /** what was asked, as the results list shows it: "三＿书" */
  prompt: string;
  /** the answer that was right: "本" */
  answer: string;
  /** the words and characters it was about */
  items: ItemId[];
  correct: boolean;
  firstTry: boolean;
}

export interface GameProps {
  ctx: GameContext;
  rounds: number;
  report(r: RoundResult): void;
  /** the game is over — the host shows the results */
  finish(): void;
  /** the host's word drawer, for games that let a word be kept (the 点单 guide) */
  words?: WordHost;
  /** leave the game for the Play page — for a game that fills the screen and hides the host's ✕ */
  leave?(): void;
}

/**
 * The drawer every other page opens for a word, handed to a game so it need
 * not reach for the router or the store: open it to mark the word known or
 * put it on a list, and read where the learner stands with a word.
 */
export interface WordHost {
  open(id: ItemId): void;
  status(w: string): 'known' | 'learning' | 'new';
  /** keep a list of words as a collection (one per `key`, updated after); returns its id */
  keepList(key: string, name: string, note: string, words: CollectionWord[]): string;
  /** leave the game for that collection, to print it */
  openList(id: string): void;
}
