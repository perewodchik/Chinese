import { LANTERN_FIGURES, type Seal } from '../core/celebrate';
import { SPIRIT_FRAMES } from '../engine/spiritFrames';
import { FitSprite } from './PropSprite';
import './cutscene.css';

/**
 * The seal after a step or a quest (§13 K2): a red stamp at the top centre
 * with the step's line, in a fixed box over the world — it never moves
 * anything and never takes a tap.
 */
export function SealToast({ seal }: { seal: Seal }) {
  const big = seal.kind === 'quest';
  return (
    <div className="cs-toast" data-big={big ? '' : undefined} role="status" key={seal.kind === 'step' ? `${seal.quest}/${seal.step}` : seal.quest}>
      <span className="cs-toast-seal han" aria-hidden>
        {big ? '成' : '✓'}
      </span>
      <span className="cs-toast-text">
        {big ? (
          <>
            <b className="small">{seal.title}</b>
            {seal.reward.length > 0 && <span className="tiny cs-toast-reward han">{seal.reward.join(' · ')}</span>}
          </>
        ) : (
          <span className="small">{seal.past}</span>
        )}
      </span>
    </div>
  );
}

/**
 * The 走马灯 (§13 K2): ten places on the wheel, the figures home lit, the one
 * coming home now glowing in. Fixed size; shown for a few seconds over the
 * world in a spirit-return cutscene.
 */
export function LanternCard({ lit, now, names }: { lit: readonly string[]; now: readonly string[]; names: (id: string) => string }) {
  return (
    <div className="cs-lantern" role="status" aria-label={`The lantern: ${lit.length} of ${LANTERN_FIGURES.length} figures lit`}>
      <span className="cs-lantern-title han">走马灯</span>
      <ol className="cs-lantern-wheel">
        {LANTERN_FIGURES.map((f) => {
          const on = lit.includes(f) || now.includes(f);
          return (
            <li key={f} data-on={on ? '' : undefined} data-now={now.includes(f) ? '' : undefined} title={on ? names(f) : '?'}>
              {on && f !== 'family' ? <FitSprite frame={SPIRIT_FRAMES[f] ?? 'lantern/lit-0'} box={32} /> : <span className="cs-lantern-blank han">{on ? '家' : ''}</span>}
            </li>
          );
        })}
      </ol>
      <span className="tiny">
        {lit.length + now.filter((x) => !lit.includes(x)).length} / {LANTERN_FIGURES.length}
      </span>
    </div>
  );
}
