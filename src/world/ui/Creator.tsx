import { useEffect, useState, type ReactNode } from 'react';
import { HAIR_TONES, SKIN_TONES, type WornOutfit } from '../art/hero';
import { PALETTE_SPEC } from '../art/palette';
import {
  ADDRESSES, BROWS, BUILDS, EYES, HAIR_COLOURS, HAIR_STYLES, LOOK_NAMES, MOUTHS, randomLook, SKINS, type HeroLook,
} from '../core/looks';
import { Figure, Head, TurningFigure } from './HeroFigure';
import './wardrobe.css';

/** The palette colour of a letter, for a swatch (the game's own pixel colours, the same in both themes). */
const swatch = (letter: string) => PALETTE_SPEC[letter]?.[1] ?? 'transparent';

export type CreatorMode = 'new' | 'first' | 'mirror';

const TITLES: Record<CreatorMode, [string, string]> = {
  new: ['创建角色', 'Who are you in Beijing?'],
  first: ['创建角色', 'You can look any way you like now — or keep this look.'],
  mirror: ['镜子', 'Body, face and hair. Your clothes stay on.'],
};

/**
 * The character creator 创建角色 (prompt §12, W3), and the mirror 镜子 at
 * home (W4): one screen, the preview turning in the middle, a row per
 * choice below it (Chinese label, English under it, as the ⚙ panel does).
 * 🎲 picks a whole look; Done keeps it. No name here — 王阿姨 asks it.
 */
export function Creator({ mode, look: start, worn, onDone, onClose }: { mode: CreatorMode; look: HeroLook; worn: WornOutfit; onDone: (look: HeroLook) => void; onClose?: () => void }) {
  const [look, setLook] = useState<HeroLook>(start);
  const set = (patch: Partial<HeroLook>) => setLook((l) => ({ ...l, ...patch }));
  const face = (patch: Partial<HeroLook['face']>) => setLook((l) => ({ ...l, face: { ...l.face, ...patch } }));
  const hair = (patch: Partial<HeroLook['hair']>) => setLook((l) => ({ ...l, hair: { ...l.hair, ...patch } }));
  const dress = { look, worn };
  const bare = { look, worn: {} as WornOutfit };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const [title, sub] = TITLES[mode];
  return (
    <div className="wp-scrim wc-scrim" onClick={onClose}>
      <section className="wp wc" role="dialog" aria-label={`${title} — ${sub}`} onClick={(e) => e.stopPropagation()}>
        <header className="wp-tabs wc-head-bar">
          <b className="han wc-title">{title}</b>
          <span className="tiny muted wc-sub">{sub}</span>
          <span className="spacer" />
          <button type="button" className="wd-tool" onClick={() => setLook(randomLook(Math.random, look))} aria-label="Surprise me" title="Surprise me">
            🎲
          </button>
          {mode === 'first' && (
            <button type="button" className="btn sm" onClick={() => onDone(start)}>
              Keep this look
            </button>
          )}
          <button type="button" className="btn primary sm" onClick={() => onDone(look)}>
            Done
          </button>
          {onClose && (
            <button type="button" className="wd-tool" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </header>
        <div className="wc-body">
          <div className="wc-stage">
            <TurningFigure dress={dress} />
          </div>
          <div className="wc-rows">
            <Row zh="身体" en="build">
              {BUILDS.map((b) => (
                <Opt key={b} on={look.build === b} onPick={() => set({ build: b })} label={LOOK_NAMES.build[b]}>
                  <Figure dress={{ look: { ...look, build: b }, worn }} scale={2} />
                </Opt>
              ))}
            </Row>
            <Row zh="肤色" en="skin">
              {Array.from({ length: SKINS }, (_, i) => (
                <button key={i} type="button" className="wc-swatch" aria-pressed={look.skin === i} aria-label={`Skin tone ${i + 1}`} onClick={() => set({ skin: i })} style={{ background: swatch(SKIN_TONES[i]![0]) }} />
              ))}
            </Row>
            <Row zh="眼睛" en="eyes">
              {EYES.map((x) => (
                <Opt key={x} on={look.face.eyes === x} onPick={() => face({ eyes: x })} label={LOOK_NAMES.eyes[x]}>
                  <Head dress={{ ...bare, look: { ...look, face: { ...look.face, eyes: x } } }} />
                </Opt>
              ))}
            </Row>
            <Row zh="眉毛" en="brows">
              {BROWS.map((x) => (
                <Opt key={x} on={look.face.brows === x} onPick={() => face({ brows: x })} label={LOOK_NAMES.brows[x]}>
                  <Head dress={{ ...bare, look: { ...look, face: { ...look.face, brows: x } } }} />
                </Opt>
              ))}
            </Row>
            <Row zh="嘴" en="mouth">
              {MOUTHS.map((x) => (
                <Opt key={x} on={look.face.mouth === x} onPick={() => face({ mouth: x })} label={LOOK_NAMES.mouth[x]}>
                  <Head dress={{ ...bare, look: { ...look, face: { ...look.face, mouth: x } } }} />
                </Opt>
              ))}
            </Row>
            <Row zh="发型" en="hair" wrap>
              {HAIR_STYLES.map((x) => (
                <Opt key={x} on={look.hair.style === x} onPick={() => hair({ style: x })} label={LOOK_NAMES.hair[x]}>
                  <Head dress={{ ...bare, look: { ...look, hair: { ...look.hair, style: x } } }} />
                </Opt>
              ))}
            </Row>
            <Row zh="发色" en="hair colour">
              {HAIR_COLOURS.map((x) => (
                <button
                  key={x}
                  type="button"
                  className="wc-swatch"
                  aria-pressed={look.hair.colour === x}
                  aria-label={LOOK_NAMES.colour[x][1]}
                  title={`${LOOK_NAMES.colour[x][0]} · ${LOOK_NAMES.colour[x][1]}`}
                  onClick={() => hair({ colour: x })}
                  style={{ background: swatch(HAIR_TONES[x]![0]) }}
                />
              ))}
            </Row>
            <Row zh="大家叫我" en="people call me">
              {ADDRESSES.map((x) => (
                <button key={x} type="button" className="wc-chip" aria-pressed={look.address === x} onClick={() => set({ address: x })}>
                  <span className="han">{x === 'name' ? '名字' : x}</span>
                  <span className="tiny muted">{LOOK_NAMES.address[x][1]}</span>
                </button>
              ))}
            </Row>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ zh, en, wrap, children }: { zh: string; en: string; wrap?: boolean; children: ReactNode }) {
  return (
    <div className="wc-row">
      <div className="wc-label">
        <span className="han">{zh}</span>
        <span className="tiny muted">{en}</span>
      </div>
      <div className="wc-opts" data-wrap={wrap ? '' : undefined}>
        {children}
      </div>
    </div>
  );
}

function Opt({ on, onPick, label, children }: { on: boolean; onPick: () => void; label: readonly [string, string]; children: ReactNode }) {
  return (
    <button type="button" className="wc-opt" aria-pressed={on} onClick={onPick} title={`${label[0]} · ${label[1]}`} aria-label={label[1]}>
      {children}
      <span className="han wc-opt-zh">{label[0]}</span>
    </button>
  );
}
