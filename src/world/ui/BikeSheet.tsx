import { colourOf } from '../art/palette';
import { BIKE_COLOURS, BIKE_PARTS, BIKES, bikeModel, type BikeColourId, type BikeShopState } from '../core/bike';
import { priceEn } from '../core/shop';
import type { WorldSave } from '../core/types';
import type { ClothesContent } from '../core/wardrobe';
import { dressOf, Figure, type Facing4 } from './HeroFigure';
import { PropSprite } from './PropSprite';
import './wardrobe.css';

const css = (letter: string) => {
  const c = colourOf(letter);
  return c ? `rgb(${c[0]} ${c[1]} ${c[2]})` : 'transparent';
};

/** You, standing with a bike (`dir` right: side-on), in a box sized before anything loads. */
export function Rider({ save, clothes, model, colour, parts = [], scale = 2, dir = 'right' }: {
  save: WorldSave;
  clothes: ClothesContent;
  model: string;
  colour: string;
  parts?: readonly string[];
  scale?: number;
  dir?: Facing4;
}) {
  const view = dir === 'right' ? 'side' : dir === 'left' ? 'side-r' : dir;
  return (
    <span className="wb-rider" style={{ width: 16 * scale, height: 32 * scale }}>
      <Figure dress={dressOf(save.look, save.outfit, clothes)} dir={dir} scale={scale} />
      <span className="wb-bike">
        <PropSprite frame={`bike/${model}-${colour}-${view}`} scale={scale} />
      </span>
      {parts.includes('basket') && (view === 'side' || view === 'side-r' || view === 'down') && (
        <span className="wb-bike">
          <PropSprite frame={`bike/basket-${view}`} scale={scale} />
        </span>
      )}
      {parts.includes('rack') && view !== 'down' && (
        <span className="wb-bike">
          <PropSprite frame={`bike/rack-${view}`} scale={scale} />
        </span>
      )}
    </span>
  );
}

/**
 * The bike shop's sheet (§13 L1), in the rack sheet's frame (W5): the bikes
 * on the stand as cards — you with each, its price, its colours as dots —
 * and, once you own one, the parts. The bike looked at stands on the left;
 * after 「我可以试试吗？」 you ride it up and down there (the test ride). Every
 * button *says* its phrase for you, so the words are the same as typing them.
 */
export function BikeSheet({ state, save, clothes, onSay }: { state: BikeShopState; save: WorldSave; clothes: ClothesContent; onSay: (text: string) => void }) {
  const owned = state.owned;
  const focus = state.focus && bikeModel(state.focus.model);
  const bikes = BIKES.filter((b) => b.shop === 'zixingche');
  const mine = save.bike;
  return (
    <section className="wk" aria-label="自行车行 — the bike shop">
      <div className="wk-stage wb-stage" data-riding={state.focus?.tried && !owned ? '' : undefined}>
        {owned && mine ? (
          <>
            <Rider save={save} clothes={clothes} model={mine.model} colour={mine.colour} parts={[...mine.parts, ...(owned.parts.filter((p) => !mine.parts.includes(p)))]} scale={3} />
            <span className="tiny muted">Your bike</span>
          </>
        ) : focus ? (
          <>
            <span className="wb-ride">
              <Rider save={save} clothes={clothes} model={focus.id} colour={state.focus!.colour} scale={3} />
            </span>
            <span className="tiny muted">{state.focus?.tried ? 'Test ride' : 'Looking'}</span>
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
          <b className="han wk-name">自行车行</b>
          <span className="tiny muted wk-sub">{owned ? 'Parts for your bike' : 'Tap to ask · 辆 for bikes'}</span>
        </div>
        <div className="wk-cards">
          {owned
            ? BIKE_PARTS.map((p) => {
                const has = owned.parts.includes(p.id);
                return (
                  <div key={p.id} className="wk-card" data-on={state.part === p.id ? '' : undefined}>
                    <button type="button" className="wk-pic" disabled={has} onClick={() => onSay(`${p.zh}多少钱？`)} aria-label={`Ask about the ${p.en}`}>
                      <PropSprite frame={`bike/${p.id}-icon`} scale={3} fallback="bicycle/side" />
                      <span className="han wk-zh">{p.zh}</span>
                      <span className="tiny wk-price">{has ? 'on it' : priceEn(p.price)}</span>
                    </button>
                  </div>
                );
              })
            : bikes.map((b) => {
                const looked = state.focus?.model === b.id;
                const colour: BikeColourId = looked ? state.focus!.colour : b.colours[0]!;
                return (
                  <div key={b.id} className="wk-card wb-card" data-on={looked ? '' : undefined}>
                    <button type="button" className="wk-pic" onClick={() => onSay(`这辆${b.zh}多少钱？`)} aria-label={`Ask about the ${b.en}`}>
                      <PropSprite frame={`bike/${b.id}-${colour}-side`} scale={3} />
                      <span className="han wk-zh">{b.zh}</span>
                      <span className="tiny wk-price">{priceEn(b.price)}</span>
                    </button>
                    {b.colours.length > 1 && (
                      <div className="wk-dots">
                        {b.colours.map((k) => (
                          <button
                            key={k}
                            type="button"
                            className="wk-dot"
                            aria-pressed={looked && colour === k}
                            style={{ background: css(BIKE_COLOURS[k].paint[0]) }}
                            aria-label={`${BIKE_COLOURS[k].en} — ask 「有${BIKE_COLOURS[k].zh}吗？」`}
                            onClick={() => onSay(looked ? `有${BIKE_COLOURS[k].zh}吗？` : `这辆${b.zh}有${BIKE_COLOURS[k].zh}吗？`)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
        <div className="wk-says" role="group" aria-label="Things to say">
          {owned ? (
            <>
              <Said zh={state.part ? `我要这个${BIKE_PARTS.find((p) => p.id === state.part)!.zh}。` : '我要一个车筐。'} en="buy it" disabled={!state.part && owned.parts.includes('basket')} onSay={onSay} />
              <Said zh="再见！" en="leave" onSay={onSay} />
            </>
          ) : (
            <>
              <Said zh="这辆多少钱？" en="how much" disabled={!focus} onSay={onSay} />
              <Said zh="我可以试试吗？" en="test ride" disabled={!focus} onSay={onSay} />
              <Said zh="我要这辆。" en="buy it" disabled={!focus} onSay={onSay} />
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
