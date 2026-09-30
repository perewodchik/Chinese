import { useEffect, useRef, useState } from 'react';
import { BIKE_PARTS, rideMs, type RidePlace } from '../core/bike';
import type { WorldSave } from '../core/types';
import type { ClothesContent } from '../core/wardrobe';
import { Rider } from './BikeSheet';
import { FitSprite, PropSprite } from './PropSprite';
import { ZhText } from './ZhText';
import './bike.css';

export interface RidePlan {
  to: RidePlace;
  km: number;
  minutes: number;
  sights: Array<{ pic: string; zh: string; en: string }>;
}

/**
 * 骑车去 (§13 L2): the ride between two districts as a short picture — you
 * pedal across a letterboxed strip while what you pass slides by (where you
 * set off, 长安街 or the lakes if you cross them, where you ride to), each
 * with its name in Chinese. 6–15 s by distance; Skip ends it at once. The
 * box never changes size; only transforms move.
 */
export function BikeRide({ plan, save, clothes, onDone }: { plan: RidePlan; save: WorldSave; clothes: ClothesContent; onDone: () => void }) {
  const ms = rideMs(plan.km);
  const each = ms / plan.sights.length;
  const [i, setI] = useState(0);
  const [step, setStep] = useState(0);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => Math.min(plan.sights.length - 1, n + 1)), each);
    const pedal = window.setInterval(() => setStep((n) => (n + 1) % 4), 160);
    const end = window.setTimeout(finish, ms);
    return () => {
      window.clearInterval(t);
      window.clearInterval(pedal);
      window.clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sight = plan.sights[i]!;
  const bike = save.bike;
  return (
    <div className="wbr" role="dialog" aria-label={`Riding to ${plan.to.en}`}>
      <div className="wbr-bar">
        <span className="han">骑车去{plan.to.zh}</span>
        <span className="tiny muted">
          {plan.km} km · about {plan.minutes} min
        </span>
        <span className="spacer" />
        <button type="button" className="btn sm" onClick={finish}>
          Skip
        </button>
      </div>
      <div className="wbr-road" style={{ ['--wbr-each' as string]: `${each}ms` }}>
        <span key={i} className="wbr-sight">
          <FitSprite frame={sight.pic} box={176} />
        </span>
        <span className="wbr-rider" data-step={step}>
          {bike && <Rider save={save} clothes={clothes} model={bike.model} colour={bike.colour} parts={bike.parts} scale={3} />}
        </span>
      </div>
      <div className="wbr-caption">
        <ZhText zh={sight.zh} pinyin={save.settings.pinyin} className="wbr-zh" />
        <span className="small muted">{sight.en}</span>
      </div>
    </div>
  );
}

/**
 * Your bike when it is not here (§13 L2): where it stands, and the phone —
 * the 修车摊 master brings it home for 10 元 (said in Chinese, in a call).
 */
export function BikeAway({ where, coming, onCall, onClose }: { where: string; coming: boolean; onCall: () => void; onClose: () => void }) {
  return (
    <div className="wbr-away" role="dialog" aria-label="Your bike">
      <p className="small">
        {coming ? (
          <>Your bike is on its way home — at your gate in 帽儿胡同 tomorrow morning.</>
        ) : (
          <>
            Your bike is at <span className="han">{where}</span>. Walk back for it, or phone the 修车摊 master to bring it home (10 元).
          </>
        )}
      </p>
      <div className="wbr-away-row">
        {!coming && (
          <button type="button" className="btn sm primary" onClick={onCall}>
            📞 Call 修车的老师傅
          </button>
        )}
        <button type="button" className="btn sm" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}

/** The 骑车去 row (on the 🗺 metro map, while you ride): the districts within a ride, nearest first. */
export function RideChips({ options, onRide }: { options: Array<{ to: RidePlace; km: number; minutes: number }>; onRide: (district: string) => void }) {
  if (!options.length) return null;
  return (
    <div className="wbr-chips" role="group" aria-label="Ride to">
      <span className="tiny muted">🚲 骑车去</span>
      {options.map((o) => (
        <button key={o.to.district} type="button" className="wbr-chip" onClick={() => onRide(o.to.district)} title={`${o.to.en} · ${o.km} km`}>
          <span className="han">{o.to.zh}</span>
          <span className="tiny muted">{o.minutes} min</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Your bike's buttons (§13 L2), at the right edge above the talk: 🚲 — get
 * on, get off, or where it is — and 🔔 while you ride. Not in the top bar:
 * at 375 px there is no room left there for the place's name.
 */
export function BikeDock({ frame, state, onBike, onBell, onLock }: { frame: string; state: 'riding' | 'here' | 'away'; onBike: () => void; onBell: () => void; onLock?: () => void }) {
  return (
    <div className="wbd" role="group" aria-label="Your bike">
      {onLock && (
        <button type="button" className="wbd-btn" onClick={onLock} aria-label="Lock your bike — 锁车">
          <span aria-hidden>🔒</span>
        </button>
      )}
      {state === 'riding' && (
        <button type="button" className="wbd-btn" onClick={onBell} aria-label="Ring the bell">
          <span aria-hidden>🔔</span>
        </button>
      )}
      <button
        type="button"
        className="wbd-btn"
        data-state={state}
        onClick={onBike}
        aria-label={state === 'riding' ? 'Get off your bike' : state === 'here' ? 'Get on your bike' : 'Where is your bike?'}
      >
        <PropSprite frame={frame} scale={2} />
      </button>
    </div>
  );
}

/** What your bike has on it, for the bag's phone summary line. */
export const partsEn = (parts: readonly string[]) => BIKE_PARTS.filter((p) => parts.includes(p.id)).map((p) => p.en);

/**
 * A street line heard (the bell's 「慢点儿！」, N1's city voices): shown for 4 s
 * at the screen's edge in Chinese; a tap on a word opens the word drawer, a
 * tap on the English mark shows what it means.
 */
export function StreetCaption({ line, pinyin }: { line: { zh: string; en: string; who?: string; key: number } | null; pinyin: boolean }) {
  const [shown, setShown] = useState<typeof line>(null);
  const [en, setEn] = useState(false);
  useEffect(() => {
    if (!line) return;
    setShown(line);
    setEn(false);
    const t = window.setTimeout(() => setShown(null), 4000);
    return () => window.clearTimeout(t);
  }, [line]);
  if (!shown) return null;
  return (
    <div className="wsc" role="status" aria-live="polite">
      {shown.who && <span className="tiny muted wsc-who">{shown.who}</span>}
      <ZhText zh={shown.zh} pinyin={pinyin} className="wsc-zh" />
      <button type="button" className="wsc-en tiny" onClick={() => setEn((v) => !v)} aria-pressed={en}>
        {en ? shown.en : 'EN'}
      </button>
    </div>
  );
}
