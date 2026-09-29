import type { Shop } from '../core/shop';
import { useEffect, useState } from 'react';
import type { DistrictContent, Idiom, Item, NpcCard, Quest, Scene, Spirit, Stamp } from '../core/types';
import { EMPTY_CLOTHES, type ClothesContent } from '../core/wardrobe';
import { RACK_WORDS, rackScenes } from '../core/rack';

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
  /** sellers and their stock (Y1) */
  shops: Shop[];
  /** manual or generated pinyin per line text, from the content build */
  pinyin: Record<string, string>;
  /** the clothes and the racks that sell them (§12) */
  clothes: ClothesContent;
}

export const EMPTY_CONTENT: WorldContent = {
  districts: [], npcs: [], scenes: [], quests: [], spirits: [], idioms: [], stamps: [], items: [], shops: [], pinyin: {}, clothes: EMPTY_CLOTHES,
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
    shops: parts.flatMap((p) => p.shops ?? []),
    pinyin: Object.assign({}, ...parts.map((p) => p.pinyin ?? {})),
    clothes: EMPTY_CLOTHES,
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
    // the clothes (§12): a file of their own; a build without it has none
    const clothes = await fetch('/world/content/clothes.json').then((x) => (x.ok ? (x.json() as Promise<ClothesContent>) : EMPTY_CLOTHES)).catch(() => EMPTY_CLOTHES);
    const merged = mergeContent(parts);
    // the clothes racks and the barber's menu talk like shops (§12 W5)
    const c = { ...merged, scenes: [...rackScenes(clothes), ...merged.scenes], clothes };
    // the barber's and the rack's words, read right (长发 is chángfà, 穿着走 chuānzhe zǒu)
    own = new Map([...wordsOf(c), ...Object.entries(RACK_WORDS)]);
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
