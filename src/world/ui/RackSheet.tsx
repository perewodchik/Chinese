import { HAIR_TONES } from '../art/hero';
import { colourOf } from '../art/palette';
import { clothingOf } from '../core/clothes';
import { HAIR_COLOURS, HAIR_STYLES, LOOK_NAMES, type Outfit } from '../core/looks';
import { focusPrice, rackOf, type RackState } from '../core/rack';
import { priceEn } from '../core/shop';
import type { WorldSave } from '../core/types';
import type { ClothesContent, Clothing } from '../core/wardrobe';
import { dressOf, Figure, Head, TurningFigure } from './HeroFigure';
import './wardrobe.css';

const css = (letter: string) => {
  const c = colourOf(letter);
  return c ? `rgb(${c[0]} ${c[1]} ${c[2]})` : 'transparent';
};

/**
 * The rack sheet (prompt §12, W5): what hangs in the shop, over the talk.
 * Each card is you wearing it, its name and price, and its colours as dots;
 * the thing looked at stands in the 试衣间 on the left (turning, once you
 * have asked to try it). Every button *says* its phrase for you — 「这件旗袍
 * 多少钱？」, 「有红的吗？」, 「我可以试试吗？」, 「我要这件」 — so the words are
 * the same as typing or speaking them, and help is free. At the barber's the
 * cards are hair styles and the dots hair colours.
 */
export function RackSheet({
  rackId,
  state,
  save,
  clothes,
  onSay,
}: {
  rackId: string;
  state: RackState;
  save: WorldSave;
  clothes: ClothesContent;
  onSay: (text: string) => void;
}) {
  const rack = rackOf(clothes, rackId);
  if (!rack) return null;
  if (rack.hair) return <HairSheet state={state} save={save} clothes={clothes} name={rack.name} cut={rack.hair.cut} dye={rack.hair.dye} onSay={onSay} />;

  const things = clothes.clothes.filter((c) => c.shop === rack.id && c.colours.some((k) => state.onSale.includes(`${c.id}:${k.id}`)));
  const focus = state.focus ? clothingOf(clothes, `${state.focus.item}:${state.focus.colour}`) : null;
  const on = (c: Clothing, colour: string): Outfit => ({ ...save.outfit, [c.slot]: `${c.id}:${colour}` });
  const first = (c: Clothing) => c.colours.find((k) => state.onSale.includes(`${c.id}:${k.id}`))!.id;
  const bought = state.bought;
  const m = focus?.item.measure ?? '件';

  return (
    <section className="wk" aria-label={`${rack.name} — the rack`}>
      <div className="wk-stage" data-tried={state.focus?.tried ? '' : undefined}>
        {focus ? (
          <>
            {state.focus?.tried ? (
              <TurningFigure dress={dressOf(save.look, on(focus.item, focus.colour.id), clothes)} scale={3} />
            ) : (
              <Figure dress={dressOf(save.look, on(focus.item, focus.colour.id), clothes)} scale={3} />
            )}
            <span className="tiny muted">{state.focus?.tried ? <span className="han">试衣间</span> : 'Looking'}</span>
          </>
        ) : (
          <>
            <Figure dress={dressOf(save.look, save.outfit, clothes)} scale={3} />
            <span className="tiny muted">You now</span>
          </>
        )}
      </div>
      <div className="wk-main">
        <div className="wk-head">
          <b className="han wk-name">{rack.name}</b>
          <span className="tiny muted wk-sub">{rack.bargain ? 'Tap to ask · bargain here' : 'Tap to ask the price'}</span>
        </div>
        <div className="wk-cards">
          {things.map((c) => {
            const colour = state.focus?.item === c.id ? state.focus.colour : first(c);
            const looked = state.focus?.item === c.id;
            return (
              <div key={c.id} className="wk-card" data-on={looked ? '' : undefined}>
                <button type="button" className="wk-pic" onClick={() => onSay(`这${c.measure}${c.zh}多少钱？`)} aria-label={`Ask about the ${c.en}`}>
                  {c.slot === 'hat' ? <Head dress={dressOf(save.look, on(c, colour), clothes)} scale={3} /> : <Figure dress={dressOf(save.look, on(c, colour), clothes)} scale={2} />}
                  <span className="han wk-zh">{c.zh}</span>
                  <span className="tiny wk-price">{looked ? priceEn(focusPrice(c, state)) : priceEn(c.price)}</span>
                </button>
                {c.colours.length > 1 && (
                  <div className="wk-dots">
                    {c.colours
                      .filter((k) => state.onSale.includes(`${c.id}:${k.id}`))
                      .map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          className="wk-dot"
                          aria-pressed={looked && colour === k.id}
                          style={{ background: css(k.palette[0]!) }}
                          aria-label={`${k.en} — ask 「有${k.zh}吗？」`}
                          onClick={() => onSay(looked ? `有${k.zh}吗？` : `这${c.measure}${c.zh}有${k.zh}吗？`)}
                        />
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="wk-says" role="group" aria-label="Things to say">
          {bought ? (
            <>
              <Said zh="我穿着走。" en="wear it out" onSay={onSay} />
              <Said zh="不用，放袋子里。" en="in a bag" onSay={onSay} />
            </>
          ) : (
            <>
              <Said zh={`这${m}多少钱？`} en="how much" disabled={!focus} onSay={onSay} />
              <Said zh="我可以试试吗？" en="try it on" disabled={!focus} onSay={onSay} />
              {rack.bargain && <Said zh="太贵了！" en="too dear" disabled={!focus} onSay={onSay} />}
              <Said zh={`我要这${m}。`} en="buy it" disabled={!focus} onSay={onSay} />
              <Said zh="再见！" en="leave" onSay={onSay} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Said({ zh, en, disabled, onSay }: { zh: string; en: string; disabled?: boolean; onSay: (t: string) => void }) {
  return (
    <button type="button" className="wk-say" disabled={disabled} onClick={() => onSay(zh)}>
      <span className="han">{zh.replace(/[。！]$/, '')}</span>
      <span className="tiny muted">{en}</span>
    </button>
  );
}

/** The barber's: the styles as heads with your face, the colours as dots; 剪短一点, 好. */
function HairSheet({ state, save, clothes, name, cut, dye, onSay }: { state: RackState; save: WorldSave; clothes: ClothesContent; name: string; cut: number; dye: number; onSay: (t: string) => void }) {
  const want = { style: state.hair?.style ?? save.look.hair.style, colour: state.hair?.colour ?? save.look.hair.colour };
  // no hat at the barber's
  const { hat: _hat, ...bare } = save.outfit;
  const dress = (style = want.style, colour = want.colour) => dressOf({ ...save.look, hair: { style, colour } }, bare, clothes);
  const asked = !!(state.hair?.style || state.hair?.colour);
  return (
    <section className="wk" aria-label={`${name} — haircuts`}>
      <div className="wk-stage" data-tried="">
        <TurningFigure dress={dress()} scale={3} />
        <span className="tiny muted">{asked ? 'Asked for' : 'You now'}</span>
      </div>
      <div className="wk-main">
        <div className="wk-head">
          <b className="han wk-name">{name}</b>
          <span className="tiny muted wk-sub">
            a cut {cut} 元 · a colour {dye} 元
          </span>
        </div>
        <div className="wk-cards">
          {HAIR_STYLES.map((s) => (
            <div key={s} className="wk-card" data-on={want.style === s ? '' : undefined}>
              <button type="button" className="wk-pic" onClick={() => onSay(`我要${LOOK_NAMES.hair[s][0]}。`)} aria-label={LOOK_NAMES.hair[s][1]}>
                <Head dress={dress(s)} scale={3} />
                <span className="han wk-zh">{LOOK_NAMES.hair[s][0]}</span>
              </button>
            </div>
          ))}
        </div>
        <div className="wk-says" role="group" aria-label="Things to say">
          <Said zh="剪短一点。" en="a bit shorter" onSay={onSay} />
          <Said zh="好，谢谢。" en="yes, do it" disabled={!asked} onSay={onSay} />
          <Said zh="再见！" en="leave" onSay={onSay} />
          <div className="wk-dots wk-hair-dots">
            {HAIR_COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                className="wk-dot"
                aria-pressed={want.colour === c}
                style={{ background: css(HAIR_TONES[c]![0]) }}
                aria-label={`${LOOK_NAMES.colour[c][1]} — say 「染成${LOOK_NAMES.colour[c][0]}」`}
                onClick={() => onSay(`染成${LOOK_NAMES.colour[c][0]}。`)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
