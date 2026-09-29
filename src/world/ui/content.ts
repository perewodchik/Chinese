import { useEffect, useState } from 'react';
import type { DistrictContent, Idiom, Item, NpcCard, Quest, Scene, Spirit, Stamp } from '../core/types';

/** Everything the built content says, all districts together (it is small: text only). */
export interface WorldContent {
  districts: DistrictContent[];
  npcs: NpcCard[];
  scenes: Scene[];
  quests: Quest[];
  spirits: Spirit[];
  idioms: Idiom[];
  stamps: Stamp[];
  items: Item[];
  /** manual or generated pinyin per line text, from the content build */
  pinyin: Record<string, string>;
}

export const EMPTY_CONTENT: WorldContent = {
  districts: [], npcs: [], scenes: [], quests: [], spirits: [], idioms: [], stamps: [], items: [], pinyin: {},
};

export function mergeContent(parts: Array<DistrictContent & { pinyin?: Record<string, string> }>): WorldContent {
  return {
    districts: parts,
    npcs: parts.flatMap((p) => p.npcs),
    scenes: parts.flatMap((p) => p.scenes),
    quests: parts.flatMap((p) => p.quests),
    spirits: parts.flatMap((p) => p.spirits),
    idioms: parts.flatMap((p) => p.idioms),
    stamps: parts.flatMap((p) => p.stamps),
    items: parts.flatMap((p) => p.items),
    pinyin: Object.assign({}, ...parts.map((p) => p.pinyin ?? {})),
  };
}

let loading: Promise<WorldContent> | null = null;
let own: ReadonlyMap<string, string> = new Map();

/** The game's own words with their readings — its 成语 — for cutting lines into words (empty until loaded). */
export const gameWords = () => own;

export const wordsOf = (c: Pick<WorldContent, 'idioms'>): ReadonlyMap<string, string> =>
  new Map(c.idioms.filter((i) => i.pinyin).map((i) => [i.id, i.pinyin.replace(/ /g, '')]));

/** `/world/content/index.json` lists the built districts; each is one JSON file. */
export function loadContent(): Promise<WorldContent> {
  if (loading) return loading;
  loading = (async () => {
    const r = await fetch('/world/content/index.json');
    if (!r.ok) return EMPTY_CONTENT;
    const ids = (await r.json()) as string[];
    const parts = await Promise.all(ids.map(async (id) => (await fetch(`/world/content/${id}.json`)).json()));
    const c = mergeContent(parts);
    own = wordsOf(c);
    return c;
  })().catch(() => EMPTY_CONTENT);
  return loading;
}

export function useWorldContent(): WorldContent | null {
  const [c, setC] = useState<WorldContent | null>(null);
  useEffect(() => {
    let live = true;
    void loadContent().then((x) => live && setC(x));
    return () => {
      live = false;
    };
  }, []);
  return c;
}
