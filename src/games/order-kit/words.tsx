import { useMemo, useState } from 'react';
import type { CollectionWord } from '../../domain/collection';
import { itemForToken } from '../../domain/words';
import { segment } from '../../domain/segment';
import { glossFor } from './gloss';
import type { Brand } from './types';
import { GlossBody, useHelp } from './help';
import { picturesFor } from '../../data/pictures';
import { menuPicture, MenuPhoto } from './ui';

/**
 * Keeping the words met in a shop.
 *
 * A label on the phone is cut into the words it is made of (生椰拿铁 →
 * 生 | 椰 | 拿铁), and each is a chip that opens the drawer every other page
 * opens for a word — "I know it", or "Learn it in…" a list. The chip wears
 * where the learner already stands with it, so the known ones can be passed
 * over at a glance.
 */
export function WordPicks({ zh }: { zh: string }) {
  const h = useHelp();
  const words = useMemo(() => {
    // The shop's glossary knows its own words (拿铁, 燕麦奶) as well as any
    // dictionary does. A long label is cut by it but not kept whole, since the
    // point is the words inside it; a short one (拿铁) is a word in itself.
    const extra = new Set(Object.keys(h.gl).filter((k) => k !== zh || [...zh].length <= 2));
    const seen = new Set<string>();
    return segment(zh, h.lib, extra)
      .filter((t) => t.word && !seen.has(t.text) && seen.add(t.text))
      .map((t) => t.text);
  }, [zh, h.lib, h.gl]);
  if (!h.words || !words.length) return null;
  const host = h.words;
  return (
    <div className="ok-picks">
      <span className="tiny muted">Keep a word</span>
      <div className="ok-picks-row">
        {words.map((w) => {
          const status = host.status(w);
          return (
            <button
              key={w}
              type="button"
              className="ok-pick hanzi"
              data-state={status === 'new' ? undefined : status}
              title={status === 'known' ? 'Known — open to change' : 'Mark it known, or learn it in a list'}
              onClick={(e) => {
                e.stopPropagation();
                host.open(itemForToken(h.lib, w));
              }}
            >
              {w}
              {status === 'known' && <i aria-label="known">✓</i>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The shop's menu words, grouped as the brand groups them: a compact row
 * each (photo, word, English), opening in place to the full gloss and the
 * words to keep. It sits inside the guide, or under the intro — never over
 * the phone.
 */
export function MenuWordList({ brand }: { brand: Brand }) {
  const h = useHelp();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="ok-mw">
      <KeepMenuWords brand={brand} />
      {brand.words.map((g) => {
        const photos = new Map(g.words.map((w) => [w, photoOf(brand, w)]));
        // a group with no photo at all (the options) goes without the column
        const pictured = [...photos.values()].some(Boolean);
        return (
          <section key={g.en}>
            <h3 className="ok-mw-h">{g.en}</h3>
            <ul>
              {g.words.map((w) => {
                const pic = photos.get(w);
                const on = open === w;
                return (
                  <li key={w} data-open={on || undefined}>
                    <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : w)}>
                      {pictured &&
                        (pic?.menu ? (
                          <MenuPhoto brand={brand} photo={pic.menu} className="mw" />
                        ) : pic?.src ? (
                          <span className="ok-photo mw">
                            <img src={pic.src} alt="" draggable={false} data-ready />
                          </span>
                        ) : (
                          <span className="ok-mw-nophoto" aria-hidden />
                        ))}
                      <span className="hanzi ok-mw-zh">{w}</span>
                      {!on && <span className="tiny muted ok-mw-en">{glossFor(w, h.gl).en}</span>}
                    </button>
                    {on && (
                      <div className="ok-mw-body">
                        <GlossBody zh={w} />
                        <WordPicks zh={w} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * The menu words as a collection, to print: one per shop, brought up to date
 * when saved again. Each word takes its pinyin and meaning from the shop's
 * glossary, and the note as what to watch for, so a word off the HSK lists
 * prints as fully as one on them.
 */
function KeepMenuWords({ brand }: { brand: Brand }) {
  const h = useHelp();
  const [saved, setSaved] = useState<{ id: string; n: number } | null>(null);
  if (!h.words) return null;
  const host = h.words;
  const keep = () => {
    const seen = new Set<string>();
    const words: CollectionWord[] = brand.words
      .flatMap((g) => g.words)
      .filter((w) => !seen.has(w) && !!seen.add(w))
      .map((w) => {
        const g = glossFor(w, h.gl);
        return { w, py: g.py, d: g.en, hsk: h.lib.byWord.get(w)?.hsk ?? null, explain: g.note ?? '', examples: [] };
      });
    const id = host.keepList(
      brand.id,
      `${brand.name} menu words`,
      `Every word on ${brand.name}’s menu, options and checkout, from the 点单 game (${brand.latin}).`,
      words,
    );
    setSaved({ id, n: words.length });
  };
  return (
    <div className="ok-mw-keep">
      {saved ? (
        <>
          <span className="small">
            {saved.n} words in <b className="hanzi">{brand.name}</b> menu words
          </span>
          <button type="button" className="btn sm" onClick={() => host.openList(saved.id)}>
            Open to print ›
          </button>
        </>
      ) : (
        <>
          <span className="small muted">Keep them on paper</span>
          <button type="button" className="btn sm" onClick={keep}>
            Save as a collection
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Menu words that are no dish of their own but can still be seen — a tea, a
 * topping, a kind of broth — by the menu photo that shows them.
 */
const SEEN_AS: Record<string, string> = {
  燕麦奶: 'oat-milk',
  轻食: 'sandwich',
  普洱: 'pu-erh',
  铁观音: 'tieguanyin',
  菊花: 'chrysanthemum-tea',
  菊普: 'chrysanthemum-tea',
  香片: 'tea',
  点心: 'dim-sum',
  一笼: 'steamer',
  烧味: 'siu-mei',
  锅底: 'hotpot',
  麻辣: 'mala-broth',
  番茄: 'tomato-hotpot',
  清汤: 'clear-broth',
  菌汤: 'mushroom-hotpot',
  酸菜: 'suancai',
  荤菜: 'sliced-beef-raw',
  素菜: 'hotpot-veg',
  丸滑: 'meatballs',
  珍珠: 'tapioca-pearls',
  椰果: 'nata-de-coco',
  布丁: 'pudding',
  仙草: 'grass-jelly',
  红豆: 'red-bean',
  芋圆: 'taro-balls',
  西米: 'sago',
  辣子: 'chili-oil',
  要辣子: 'chili-oil',
  香菜: 'coriander',
  凉菜: 'cold-dishes',
  热菜: 'stir-fry',
  主食: 'rice',
  汤羹: 'soup',
  水饺: 'dumplings',
  煎饺: 'potstickers',
  蒸饺: 'steamed-dumplings',
  馅: 'dumplings',
};

/**
 * A menu word's photo: the dish when it is on the menu — by its name, or as
 * the end of one (可颂 in 原味可颂, the thing the name is about) — else the
 * menu photo that shows it, else the app's own photo of the word (咖啡), else
 * none.
 */
function photoOf(brand: Brand, w: string): { menu?: string; src?: string } | null {
  const item =
    brand.items.find((i) => i.zh === w || i.call === w) ??
    brand.items.find((i) => i.zh.endsWith(w) || i.call?.endsWith(w));
  if (item) return { menu: item.photo };
  const seen = SEEN_AS[w];
  if (seen && menuPicture(brand, seen)) return { menu: seen };
  const pic = picturesFor(w)?.picture;
  return pic ? { src: pic.src } : null;
}
