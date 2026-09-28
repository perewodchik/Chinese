/**
 * The words of the game: what a save holds and what the content files say.
 *
 * Pure types. The zod schemas that check content files against these live in
 * `content.ts`; the rules that change a save live in `save.ts`.
 */

/** A tile on a map, `[x, y]`, 0-based from the top left. */
export type Tile = readonly [number, number];

export type Facing = 'up' | 'down' | 'left' | 'right';
export const FACINGS: readonly Facing[] = ['up', 'down', 'left', 'right'];

export type PartOfDay = 'morning' | 'day' | 'evening' | 'night';

// ---------------------------------------------------------------------------
// Conditions and actions — the verbs content uses
// ---------------------------------------------------------------------------

/**
 * Something that is true or not of a save at a moment. Content writes these
 * as plain JSON objects; `flags.ts` evaluates them.
 */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flag: string }
  | { item: string; count?: number }
  | { money: number }
  /** game hours [from, to): `[6, 10]` is 6:00–9:59; `[21, 6]` wraps midnight */
  | { hours: readonly [number, number] }
  /** the chapter is at least this */
  | { chapter: number }
  /** the quest is at this step (by id), or finished */
  | { quest: string; step?: string; done?: boolean }
  | { scene: string }
  | { spirit: string }
  | { idiom: string }
  | { station: string }
  | { met: string };

export type Action =
  | { do: 'flag'; flag: string; value?: boolean }
  | { do: 'give'; item: string; count?: number }
  | { do: 'take'; item: string; count?: number }
  /** yuan; negative spends */
  | { do: 'money'; amount: number }
  /** top the 交通卡 up (or, negative, pay a fare from it) */
  | { do: 'card'; amount: number }
  | { do: 'quest'; quest: string; step: string }
  | { do: 'quest_done'; quest: string }
  | { do: 'stamp'; stamp: string }
  | { do: 'spirit'; spirit: string }
  | { do: 'idiom'; idiom: string }
  | { do: 'station'; station: string }
  | { do: 'district'; district: string }
  | { do: 'chapter'; chapter: number }
  | { do: 'teleport'; map: string; tile: Tile; facing?: Facing }
  /** open a 点单 game from `src/games` and come back to the same spot */
  | { do: 'game'; game: string }
  | { do: 'sleep' }
  /** pin the current key line to 📜 as a riddle to work out */
  | { do: 'pin'; riddle: string }
  | { do: 'solve'; riddle: string }
  | { do: 'remember'; npc: string; note: string };

export type ActionKind = Action['do'];

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export interface District {
  id: string;
  /** hanzi, e.g. 鼓楼 · 南锣鼓巷 */
  name: string;
  en: string;
  chapter: number;
  maps: string[];
  /** subway stations and bus stops in this district, ids from travel.ts */
  stations: string[];
  /** proper and place names that do not count against the word budget */
  names: string[];
  ambience?: string;
}

export type MapObject =
  | { kind: 'door'; id: string; tile: Tile; to: { map: string; tile: Tile; facing?: Facing }; when?: Condition; locked?: string }
  | { kind: 'edge'; id: string; side: Facing; from: number; to: number; target: { map: string; offset: number } }
  | { kind: 'sign'; id: string; tile: Tile; text: string; en?: string }
  | { kind: 'npc'; id: string; npc: string; tile: Tile; facing?: Facing; when?: Condition }
  | { kind: 'light'; id: string; tile: Tile; color?: string; radius?: number }
  | { kind: 'zone'; id: string; tile: Tile; size?: readonly [number, number]; scene: string; when?: Condition }
  | { kind: 'spirit'; id: string; tile: Tile; spirit: string; when?: Condition }
  | { kind: 'bike'; id: string; tile: Tile };

export type MapObjectKind = MapObject['kind'];

export interface RoutineStop {
  /** game hours [from, to) the NPC is here */
  hours: readonly [number, number];
  map: string;
  tile: Tile;
  facing?: Facing;
}

export interface NpcCard {
  id: string;
  /** hanzi, e.g. 王阿姨 */
  name: string;
  /** English, for the companion and for Claude later */
  role: string;
  look: { sprite: string; palette?: string };
  voice?: string;
  /** a calm character in a sentence or two, English */
  character: string;
  /** facts they know, English */
  knows: string[];
  /** what they want, English */
  wants: string[];
  /** the actions a live conversation may take on their behalf later */
  actions: ActionKind[];
  routine: RoutineStop[];
  /** words they can explain, each in HSK 1 Chinese */
  explains: Record<string, string>;
  /** their own ways of saying "what?" when they do not understand */
  misses?: string[];
}

export interface Expect {
  intent: string;
  /** every group needs one hit; order and extra words do not matter */
  match: string[][];
  /** the next node; none ends the conversation */
  go?: string;
  actions?: Action[];
  end?: boolean;
}

export interface Hint {
  /** step 1: the key word */
  word: string;
  /** step 2: a frame, `___` where the word goes */
  frame: string;
  /** step 3: a whole sentence that works */
  full: string;
}

export interface DialogueNode {
  id: string;
  /** who says it: the scene's NPC by default, or another NPC id, or 'hero' */
  speaker?: string;
  say: string;
  /** manual pinyin for lines with polyphones */
  pinyin?: string;
  /** an easier way to say it, for 听不懂 / 慢一点 */
  simpler?: string;
  /** a 📌 key line: may hold harder words or one 成语 */
  key?: boolean;
  expect?: Expect[];
  /** when there is nothing to expect: tap to go on here (none = the end) */
  next?: string;
  hint?: Hint;
  translate: string;
  why?: string;
  onEnter?: Action[];
  onExit?: Action[];
}

export interface SituationWord {
  w: string;
  /** what it means, in HSK 1 Chinese */
  explain: string;
  en: string;
}

export interface Scene {
  id: string;
  map: string;
  /** the NPC spoken to; none for a sign, a zone or the companion */
  npc?: string;
  /** how it starts: talking to the NPC, stepping into a zone, looking at something */
  trigger: 'talk' | 'zone' | 'look' | 'auto';
  when?: Condition;
  /** plays once; after that the NPC's next scene (or small talk) is used */
  once?: boolean;
  start: string;
  nodes: DialogueNode[];
  words?: SituationWord[];
  stamp?: string;
  /** lower plays first when several scenes could start */
  priority?: number;
}

export interface QuestStep {
  id: string;
  /** the companion's "What now?", English */
  now: string;
  /** the step is finished when this holds (checked after every action) */
  done?: Condition;
}

export interface Quest {
  id: string;
  title: string;
  chapter: number;
  steps: QuestStep[];
  /** actions when the last step is done */
  reward?: Action[];
}

export interface Spirit {
  id: string;
  hanzi: string;
  pinyin: string;
  en: string;
  source: '山海经' | 'folk';
  /** public-domain woodcut, path under public/world/ */
  image?: string;
  credit?: string;
  legend: { zh: string; en: string };
  befriend: { kind: 'riddle' | 'request' | 'name'; text: string; en: string };
  district: string;
}

export interface Idiom {
  id: string;
  pinyin: string;
  parts: { c: string; gloss: string }[];
  meaning: string;
  story: { zh: string; en: string };
  tier: 'basic' | 'story';
}

export interface Stamp {
  id: string;
  name: string;
  en: string;
  place: string;
  /** art frame id in the stamps atlas */
  design: string;
  /** a landmark's own seal rather than a situation stamp */
  landmark?: boolean;
}

export interface Item {
  id: string;
  name: string;
  en: string;
  icon?: string;
}

/** Everything one district's folder holds, after validation. */
export interface DistrictContent {
  district: District;
  npcs: NpcCard[];
  scenes: Scene[];
  quests: Quest[];
  spirits: Spirit[];
  idioms: Idiom[];
  stamps: Stamp[];
  items: Item[];
}

// ---------------------------------------------------------------------------
// The save
// ---------------------------------------------------------------------------

export type InputMode = 'voice' | 'keyboard';
export type TextSize = 's' | 'm' | 'l';

export interface WorldSettings {
  input: InputMode;
  /** show pinyin under NPC lines by default */
  pinyin: boolean;
  joystick: boolean;
  textSize: TextSize;
  /** the future Live conversation; off and unused in this build */
  live: boolean;
  /** 0–1 */
  volume: number;
}

export interface Place {
  map: string;
  tile: Tile;
  facing: Facing;
}

export interface QuestState {
  step: string;
  /** index of `step` in the quest, so two saves can say which is further */
  index: number;
  done: boolean;
}

export interface Riddle {
  scene: string;
  node: string;
  pinnedAt: number;
  solved: boolean;
}

export interface NpcMemory {
  /** game minute of the first meeting */
  met: number;
  /** short notes of what was said, oldest first */
  notes: string[];
}

export interface WorldSave {
  version: number;
  /** wall-clock ms of the last change */
  updatedAt: number;
  /** the device that made the last change */
  deviceId: string;

  place: Place;
  district: string;
  /** game minutes since day 1 00:00 */
  clock: number;
  chapter: number;

  flags: string[];
  scenes: string[];
  quests: Record<string, QuestState>;
  riddles: Record<string, Riddle>;

  bag: {
    items: Record<string, number>;
    /** yuan */
    money: number;
    /** the 交通卡's balance; null until the card is bought */
    card: number | null;
  };

  /** id → game minute found */
  spirits: Record<string, number>;
  idioms: Record<string, { at: number; npc?: string; scene?: string }>;
  stamps: Record<string, number>;
  stations: string[];
  districts: string[];
  npcs: Record<string, NpcMemory>;
  /** route key → rides taken, to skip the announcement after three */
  rides: Record<string, number>;

  settings: WorldSettings;
}
