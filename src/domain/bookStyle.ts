/**
 * A book's own look, for the reader who turns it on (Aa › Book style): the
 * page dressed as that book, and each paragraph set against the place it
 * happens in. Only books the app knows how to dress have one; any other text
 * reads as always.
 *
 * 西游记 is the first: the 回 of the chapter as a seal, its title between
 * rules as an old edition prints it, and behind each paragraph, faint, the
 * place the story has got to — the Mountain of Flowers and Fruit, the cave
 * behind the waterfall, the Dragon King's sea, the Palace of Heaven, a
 * demon's den, a temple, the road west.
 */

export type BookStyle = 'xiyouji';

export type Scene = 'mountain' | 'cave' | 'sea' | 'heaven' | 'demon' | 'temple' | 'palace' | 'road';

/** The book a shelf or a text is, by its name: 西游记 in Chinese or English, or its hero. */
export function bookStyleOf(...names: Array<string | null | undefined>): BookStyle | null {
  const all = names.filter(Boolean).join(' ');
  return /西游|西遊|孙悟空|孫悟空|美猴王|journey to the west|monkey king/i.test(all) ? 'xiyouji' : null;
}

/** Places with a name: the label over the paragraph, and the scene it is. Longest first, so 花果山 wins over 山. */
const PLACES: Array<{ zh: string; en: string; scene: Scene }> = [
  { zh: '花果山', en: 'the Mountain of Flowers and Fruit', scene: 'mountain' },
  { zh: '水帘洞', en: 'the Water Curtain Cave', scene: 'cave' },
  { zh: '五行山', en: 'the Five Elements Mountain', scene: 'mountain' },
  { zh: '火焰山', en: 'the Flaming Mountain', scene: 'demon' },
  { zh: '东海', en: 'the Eastern Sea', scene: 'sea' },
  { zh: '龙宫', en: 'the Dragon King’s palace', scene: 'sea' },
  { zh: '天宫', en: 'the Palace of Heaven', scene: 'heaven' },
  { zh: '蟠桃园', en: 'the Peach Garden of Heaven', scene: 'heaven' },
  { zh: '灵霄宝殿', en: 'the Hall of Miraculous Mist', scene: 'heaven' },
  { zh: '西天', en: 'the road to the West', scene: 'road' },
  { zh: '雷音寺', en: 'the Thunderclap Monastery', scene: 'temple' },
  { zh: '长安', en: 'Chang’an', scene: 'palace' },
];

/** Words that say where a paragraph is, by scene. A paragraph goes with the scene it says most. */
const CUES: Array<[Scene, RegExp]> = [
  ['heaven', /天上|天宫|玉皇|大帝|神仙|仙女|天兵|天将|云|飞上天|蟠桃|太白金星|老君/g],
  ['sea', /海|龙王|龙宫|水里|波浪|鱼|金箍棒/g],
  ['cave', /洞|瀑布|水帘/g],
  ['demon', /妖|怪|魔|精|火|大王/g],
  ['temple', /寺|庙|佛|如来|观音|菩萨|和尚|经/g],
  ['palace', /皇帝|国王|宫|城|长安|唐王/g],
  ['road', /路|西天|取经|走了|马|师父|唐僧|八戒|沙僧|徒弟/g],
  ['mountain', /山|石头|石猴|树|林|猴子|花|果/g],
];

export interface ParagraphScene {
  scene: Scene;
  /** the named place, when the paragraph names one */
  place: { zh: string; en: string } | null;
}

function sceneOfText(zh: string): Scene | null {
  const place = PLACES.find((p) => zh.includes(p.zh));
  if (place) return place.scene;
  let best: Scene | null = null;
  let most = 0;
  for (const [scene, cue] of CUES) {
    const n = zh.match(cue)?.length ?? 0;
    if (n > most) {
      best = scene;
      most = n;
    }
  }
  return best;
}

/**
 * Each paragraph's scene. One that says nothing about where it is stays
 * where the one before it was — a conversation in the cave is still in the
 * cave — and the first ones, before any place is said, take the chapter's.
 * A place is named over a paragraph only where it first comes, not again
 * over every paragraph that stays there.
 */
export function paragraphScenes(paragraphs: string[]): ParagraphScene[] {
  const own = paragraphs.map(sceneOfText);
  const chapter = sceneOfText(paragraphs.join('')) ?? 'road';
  let last: Scene = own.find((s): s is Scene => s !== null) ?? chapter;
  let named = '';
  return paragraphs.map((zh, i) => {
    last = own[i] ?? last;
    const p = PLACES.find((x) => zh.includes(x.zh)) ?? null;
    const place = p && p.zh !== named ? { zh: p.zh, en: p.en } : null;
    if (p) named = p.zh;
    return { scene: last, place };
  });
}
