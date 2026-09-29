import { useEffect, useRef, useState } from 'react';
import { clothingOf, oneZh } from '../core/clothes';
import { ALWAYS_WORN, LOOK_NAMES, SAVED_OUTFITS, SLOTS, type Outfit, type Slot } from '../core/looks';
import type { SaveAction } from '../core/save';
import type { WorldSave } from '../core/types';
import type { ClothesContent } from '../core/wardrobe';
import { dressOf, Figure, Head, TurningFigure } from './HeroFigure';
import { ZhText } from './ZhText';
import './wardrobe.css';

const SLOT_NAMES: Record<Slot, [string, string]> = {
  hat: ['帽子', 'hat'],
  top: ['上衣', 'top'],
  bottom: ['裤子/裙子', 'trousers, skirt'],
  shoes: ['鞋', 'shoes'],
  accessory: ['配饰', 'scarf, glasses, bag'],
};

/** Sold to the recycler from the wardrobe: half of what it cost (Y3's rule for everything). */
export const sellPrice = (price: number) => Math.max(0.5, Math.round(price) / 2);

/**
 * Your 衣柜 at home (prompt §12, W4): the turning preview beside six rows —
 * a strip per slot of what you own, each a little figure of you wearing it.
 * Tap to wear; tap a worn hat or accessory to take it off (a top, a bottom
 * and shoes stay on). 套装 1–3 put a saved set on, 存 saves what you wear
 * into one. ⓘ on a tile opens its card: the word, how it is counted, where
 * it came from, and Sell (the recycler takes it at half price).
 */
export function WardrobeSheet({
  save,
  clothes,
  pinyin,
  dispatch,
  onClose,
}: {
  save: WorldSave;
  clothes: ClothesContent;
  pinyin: boolean;
  dispatch: (a: SaveAction[], sold?: boolean) => void;
  onClose: () => void;
}) {
  const [card, setCard] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  // a long press opens a tile's card (no ⓘ buttons: the learner's rule); the click after it is swallowed
  const press = useRef<{ t: number; id: string; long: boolean } | null>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (card) setCard(null);
      else onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [card, onClose]);
  useEffect(() => setSure(false), [card]);
  const dress = dressOf(save.look, save.outfit, clothes);
  const owned = (slot: Slot) => save.wardrobe.filter((id) => clothingOf(clothes, id)?.item.slot === slot);
  const wearing = new Set(Object.values(save.outfit));
  const tap = (slot: Slot, id: string) => {
    if (save.outfit[slot] === id) {
      if (!ALWAYS_WORN.includes(slot)) dispatch([{ do: 'take_off', slot }]);
      return;
    }
    const c = clothingOf(clothes, id);
    dispatch([{ do: 'wear', slot, id, ...(c ? { zh: c.item.zh, en: `the ${c.item.en}` } : {}) }]);
  };
  const sets = save.outfits.slice(0, SAVED_OUTFITS);
  const cardItem = card ? clothingOf(clothes, card) : null;
  const rackName = (shop: string) => (shop === 'start' ? 'you came to Beijing in it' : `from ${clothes.racks.find((r) => r.id === shop)?.name ?? shop}`);
  return (
    <div className="wp-scrim wc-scrim" onClick={onClose}>
      <section className="wp wc" role="dialog" aria-label="衣柜 — your wardrobe" onClick={(e) => e.stopPropagation()}>
        <header className="wp-tabs wc-head-bar">
          <b className="han wc-title">衣柜</b>
          <span className="tiny muted wc-sub">Tap to wear · hold for its card</span>
          <span className="spacer" />
          {sets.map((set, i) => (
            <span key={i} className="wc-set">
              <button type="button" className="wc-set-on" disabled={!set} onClick={() => dispatch([{ do: 'put_on', index: i }])} title={set ? `Put on set ${i + 1}` : `Set ${i + 1} is empty`}>
                <span className="han">套装{i + 1}</span>
              </button>
              <button type="button" className="wc-set-save" onClick={() => dispatch([{ do: 'save_outfit', index: i }])} aria-label={`Save what you wear as set ${i + 1}`} title={`Save what you wear as set ${i + 1}`}>
                存
              </button>
            </span>
          ))}
          <button type="button" className="wd-tool" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="wc-body">
          <div className="wc-stage">
            <TurningFigure dress={dress} />
          </div>
          <div className="wc-rows">
            {SLOTS.map((slot) => {
              const list = owned(slot);
              return (
                <div className="wc-row" key={slot}>
                  <div className="wc-label">
                    <span className="han">{SLOT_NAMES[slot][0]}</span>
                    <span className="tiny muted">{SLOT_NAMES[slot][1]}</span>
                  </div>
                  <div className="wc-opts">
                    {!list.length && <span className="tiny muted wc-none">Nothing yet — the shops in 前门, 王府井 and 三里屯 sell them.</span>}
                    {list.map((id) => {
                      const c = clothingOf(clothes, id)!;
                      const on = save.outfit[slot] === id;
                      return (
                        <span key={id} className="wc-tile" data-on={on ? '' : undefined}>
                          <button
                            type="button"
                            className="wc-opt"
                            aria-pressed={on}
                            aria-label={`${on ? 'Wearing' : 'Wear'} ${c.colour.en} ${c.item.en} — hold for its card`}
                            onPointerDown={() => {
                              const p = { t: window.setTimeout(() => {
                                p.long = true;
                                setCard(id);
                              }, 450), id, long: false };
                              press.current = p;
                            }}
                            onPointerUp={() => press.current && window.clearTimeout(press.current.t)}
                            onPointerLeave={() => press.current && window.clearTimeout(press.current.t)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setCard(id);
                            }}
                            onClick={() => {
                              const p = press.current;
                              press.current = null;
                              if (p?.long && p.id === id) return;
                              tap(slot, id);
                            }}
                          >
                            {slot === 'hat' ? (
                              <Head dress={{ look: save.look, worn: dressOf(save.look, { ...save.outfit, hat: id }, clothes).worn }} scale={3} />
                            ) : (
                              <Figure dress={dressOf(save.look, { ...save.outfit, [slot]: id } as Outfit, clothes)} scale={2} />
                            )}
                            <span className="han wc-opt-zh">{c.item.colours.length > 1 ? c.colour.zh.replace(/的$/, '') : ''}{c.item.zh}</span>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="wc-row">
              <div className="wc-label">
                <span className="han">发型</span>
                <span className="tiny muted">hair</span>
              </div>
              <div className="wc-opts">
                <span className="wc-opt" aria-disabled>
                  <Head dress={dress} scale={3} />
                  <span className="han wc-opt-zh">{LOOK_NAMES.hair[save.look.hair.style][0]}</span>
                </span>
                <span className="tiny muted wc-none">Change it at the mirror, or at the 理发店.</span>
              </div>
            </div>
          </div>
        </div>
        {cardItem && card && (
          <div className="wc-card" role="dialog" aria-label={cardItem.item.en}>
            <div className="wc-card-pic">
              <Figure dress={dressOf(save.look, { ...save.outfit, [cardItem.item.slot]: card } as Outfit, clothes)} scale={4} />
            </div>
            <div className="wc-card-text">
              <ZhText zh={oneZh(clothes, card)} pinyin={pinyin} className="wd-zh wc-card-zh" />
              <p className="small">
                {cardItem.colour.en} {cardItem.item.en} · counted with <span className="han">{cardItem.item.measure}</span> — <span className="han">一{cardItem.item.measure}{cardItem.item.zh}</span>
              </p>
              <p className="tiny muted">
                {cardItem.item.price} 元 · {rackName(cardItem.item.shop)}
              </p>
              {cardItem.item.story && <p className="tiny muted">{cardItem.item.story}</p>}
              <div className="wc-card-acts">
                {wearing.has(card) ? (
                  <span className="tiny muted">You are wearing it.</span>
                ) : sure ? (
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={() => {
                      dispatch([{ do: 'sell_clothes', id: card }, { do: 'earn', amount: sellPrice(cardItem.item.price) }], true);
                      setCard(null);
                    }}
                  >
                    Sell for {sellPrice(cardItem.item.price)} 元
                  </button>
                ) : (
                  <button type="button" className="btn sm" onClick={() => setSure(true)}>
                    Sell…
                  </button>
                )}
                <button type="button" className="btn sm ghost" onClick={() => setCard(null)}>
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

