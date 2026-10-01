import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { randomLook, DEFAULT_LOOK, type Outfit } from '../core/looks';
import type { RouteLeg } from '../core/journal';
import { doorMap, doorsOpen, platformLines, platformTrains, stopsAhead, type Side } from '../core/platform';
import { arrivalCall, board, callEn, callNext, END_OF_LINE, fareOut, getOff, HOLD_ON, isTerminus, runOn, startRide, stopCalls, type RideState, type Train } from '../core/ride';
import { line as lineOf, station } from '../core/travel';
import type { WorldSave } from '../core/types';
import type { ClothesContent } from '../core/wardrobe';
import type { HeroDress } from '../engine/look';
import { dressOf } from './HeroFigure';
import { heroPicture } from './heroPicture';
import { playLine } from './lineVoice';
import { ZhText } from './ZhText';
import './metro.css';

/** a sound of the train (the page's mixer makes it) */
export type TrainSound = 'doors' | 'closing' | 'arrive' | 'leave' | 'run';

type Where = 'mid' | Side;
/** a train on one side of the platform: coming in, doors open, doors shutting, gone */
type TrainAt = 'none' | 'arriving' | 'open' | 'closing' | 'leaving';

/**
 * In the train: running between stops, pulling into one, or stopped with the doors open (it waits
 * for you), and stepping off.
 */
type Inside = 'running' | 'braking' | 'stopped' | 'off';

/** How long things take (ms); `fast` after three rides */
const T = {
  walk: 520,
  arrive: 2000,
  doors: 600,
  leave: 1700,
  run: 3600,
  brake: 2200,
  board: 520,
  corridor: 1500,
};

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The subway as a place (MT, the learner 2026-10-01: "like a true metro"). On the platform you
 * stand between two tracks, one direction on each side, each with its sign; walk to a side and its
 * train is already pulling in — no waiting. The doors open and stay open while you stand there;
 * walk in, or step back and it leaves. Inside, the line map over the doors shows where you are;
 * at each station the platform and its big name slide into the windows, the doors open, and the
 * train waits until you get off or stay on. At an interchange the 换乘 signs walk you to the other
 * line's platform. Getting off at the wrong stop costs nothing; the fare is paid at the gates.
 *
 * The rules (where trains go, fares, calls) are `core/ride.ts` and `core/platform.ts`; this file
 * only draws and times them. The world is paused while it is open.
 */
export function MetroRide({
  from,
  save,
  clothes,
  pinyin,
  fast,
  canExit,
  card,
  onExit,
  onClose,
  guide = [],
  sound,
}: {
  from: string;
  save: WorldSave;
  clothes: ClothesContent;
  pinyin: boolean;
  fast: boolean;
  canExit: (station: string) => boolean;
  card: number;
  onExit: (ride: RideState) => void;
  onClose: () => void;
  guide?: readonly Extract<RouteLeg, { kind: 'ride' }>[];
  sound?: (s: TrainSound, secs?: number) => void;
}) {
  const k = fast ? 0.6 : 1;
  const ms = (n: number) => (reduced() ? Math.min(n, 250) : n * k);
  const [ride, setRide] = useState<RideState>(() => startRide(from));
  const lines = platformLines(ride.at);
  // the platform you come down to: the guided line if there is one here, else the station's first
  const firstLine = () => guide.find((l) => l.from === ride.at)?.line ?? lines[0] ?? 'l1';
  const [lineId, setLineId] = useState<string>(firstLine);
  const [where, setWhere] = useState<Where>('mid');
  const [trains, setTrains] = useState<Record<Side, TrainAt>>({ top: 'none', bottom: 'none' });
  /** each arrival is a new train: its key restarts the slide */
  const [trainKey, setTrainKey] = useState<Record<Side, number>>({ top: 0, bottom: 0 });
  const [inside, setInside] = useState<Inside | null>(null);
  const [corridor, setCorridor] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [walking, setWalking] = useState(false);
  /** walking in through the train's doors */
  const [boarding, setBoarding] = useState(false);
  const [call, setCall] = useState<{ zh: string; en: string } | null>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, t: number) => {
    timers.current.push(window.setTimeout(fn, t));
  };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // a walk cycle while walking
  useEffect(() => {
    if (!walking) return setStep(0);
    const cycle = [1, 0, -1, 0];
    let i = 0;
    const id = window.setInterval(() => setStep(cycle[i++ % 4]!), 130);
    return () => window.clearInterval(id);
  }, [walking]);

  const me = useMemo(() => (clothes.clothes.length ? dressOf(save.look, save.outfit, clothes) : null), [save.look, save.outfit, clothes]);
  // the people on a platform belong to its station; the people in your carriage stay with you
  const crowd = useMemo(() => people(clothes, seedOf(ride.at + lineId)), [clothes, ride.at, lineId]);
  const riders = useMemo(() => people(clothes, seedOf(ride.from + (ride.train?.line ?? ''))), [clothes, ride.from, ride.train?.line]);

  const sides = platformTrains(ride.at, lineId);

  // ---- on the platform ----------------------------------------------------
  /** a train comes in on a side (now, or after the one leaving there has gone) */
  const arrive = (side: Side) => {
    if (!sides[side]) return;
    setTrainKey((t) => ({ ...t, [side]: t[side] + 1 }));
    setTrains((t) => ({ ...t, [side]: 'arriving' }));
    sound?.('arrive', ms(T.arrive) / 1000);
    later(() => {
      setTrains((t) => (t[side] === 'arriving' ? { ...t, [side]: 'open' } : t));
      sound?.('doors');
    }, ms(T.arrive));
  };
  /** the doors shut and the train goes */
  const depart = (side: Side) => {
    setTrains((t) => ({ ...t, [side]: 'closing' }));
    sound?.('closing');
    later(() => {
      setTrains((t) => ({ ...t, [side]: 'leaving' }));
      sound?.('leave', ms(T.leave) / 1000);
      later(() => setTrains((t) => (t[side] === 'leaving' ? { ...t, [side]: 'none' } : t)), ms(T.leave));
    }, ms(T.doors));
  };
  const walkTo = (to: Where) => {
    if (walking || inside || corridor) return;
    // already on this side: the next train comes in now
    if (to === where) {
      if (to !== 'mid' && sides[to] && trains[to] === 'none') arrive(to);
      return;
    }
    const was = where;
    setWalking(true);
    setWhere(to);
    later(() => setWalking(false), ms(T.walk));
    if (was !== 'mid' && (trains[was] === 'open' || trains[was] === 'arriving')) depart(was);
    if (to !== 'mid' && sides[to]) {
      const now = trains[to];
      if (now === 'none') arrive(to);
      else if (now === 'leaving' || now === 'closing') later(() => arrive(to), ms(T.leave + T.doors));
    }
    if (to !== 'mid' && sides[to]) setCall({ zh: '列车进站，请注意安全。', en: 'A train is coming in. Please mind the gap.' });
    else if (to !== 'mid') setCall({ zh: '本侧不载客。', en: 'No trains from this side: this is the end of the line.' });
    else setCall(null);
  };
  const getOn = () => {
    if (where === 'mid' || trains[where] !== 'open' || walking) return;
    const t = sides[where]!;
    setWalking(true);
    setBoarding(true);
    later(() => {
      setWalking(false);
      setBoarding(false);
      setRide((r) => board(r, t));
      setInside('running');
      setTrains({ top: 'none', bottom: 'none' });
      sound?.('closing');
    }, ms(T.board));
  };
  const change = (to: string) => {
    if (inside || corridor || to === lineId) return;
    for (const s of ['top', 'bottom'] as const) if (trains[s] === 'open' || trains[s] === 'arriving') depart(s);
    setCorridor(to);
    setWhere('mid');
    setCall({ zh: `换乘${lineOf(to).zh}`, en: `This way to ${lineOf(to).en}.` });
    later(() => {
      setLineId(to);
      setTrains({ top: 'none', bottom: 'none' });
      setCorridor(null);
      setCall(null);
    }, ms(T.corridor));
  };

  // ---- in the train ------------------------------------------------------
  useEffect(() => {
    if (!inside || !ride.train) return;
    const t = ride.train;
    if (inside === 'running') {
      const next = callNext(t.line, ride.at, t.dir);
      if (!next) return;
      const first = ride.stops === 0;
      setCall({ zh: first ? `${HOLD_ON.zh}${next}` : next, en: callEn(t.line, ride.at, t.dir) ?? '' });
      void (async () => {
        if (first) await playLine({ speaker: 'announcer', zh: HOLD_ON.zh, en: HOLD_ON.en, node: '' });
        await playLine({ speaker: 'announcer', zh: next, en: '', node: '' });
      })();
      sound?.('leave', 1.6);
      later(() => sound?.('run', ms(T.run - 1600) / 1000), 1600);
      const id = window.setTimeout(() => {
        setRide((r) => runOn(r));
        setInside('braking');
      }, ms(T.run));
      return () => window.clearTimeout(id);
    }
    if (inside === 'braking') {
      sound?.('arrive', ms(T.brake) / 1000);
      const id = window.setTimeout(() => {
        setInside('stopped');
        sound?.('doors');
        const here = arrivalCall(ride.at);
        const end = isTerminus(t.line, ride.at, t.dir);
        const more = end ? [END_OF_LINE] : stopCalls(t.line, ride.at);
        setCall({ zh: [here, ...more.map((m) => m.zh)].join(''), en: more.map((m) => m.en).join(' ') });
        void (async () => {
          await playLine({ speaker: 'announcer', zh: here, en: '', node: '' });
          for (const m of more) await playLine({ speaker: 'announcer', zh: m.zh, en: m.en, node: '' });
        })();
      }, ms(T.brake));
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inside, ride.at, ride.train]);

  const stayOn = () => {
    if (inside !== 'stopped' || !ride.train || isTerminus(ride.train.line, ride.at, ride.train.dir)) return;
    sound?.('closing');
    setInside('running');
  };
  const getOffHere = () => {
    if (inside !== 'stopped' || !ride.train) return;
    const t = ride.train;
    setInside('off');
    later(() => {
      setInside(null);
      setLineId(t.line);
      const side: Side = t.dir === -1 ? 'top' : 'bottom';
      setWhere(side);
      // the train you got off stands with its doors open behind you, then goes
      setTrainKey((x) => ({ ...x, [side]: x[side] + 1 }));
      setTrains({ top: 'none', bottom: 'none', [side]: 'open' } as Record<Side, TrainAt>);
      setRide((r) => getOff(r));
      setCall(null);
      later(() => depart(side), ms(900));
    }, ms(T.board));
  };

  // keys: ↑ ↓ to a side, Enter to get on / off, Space to stay on
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') walkTo(where === 'bottom' ? 'mid' : 'top');
      else if (e.key === 'ArrowDown') walkTo(where === 'top' ? 'mid' : 'bottom');
      else if (e.key === 'Enter') inside ? getOffHere() : getOn();
      else if (e.key === ' ' && inside) stayOn();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  // ---- what to show ------------------------------------------------------
  const onTrain = !!inside && !!ride.train;
  const legHere = guide.find((l) => l.from === ride.at);
  const guidedSide = (['top', 'bottom'] as const).find((s) => legHere && sides[s] && sides[s]!.line === legHere.line && sides[s]!.towards === legHere.direction);
  const guidedChange = legHere && legHere.line !== lineId && lines.includes(legHere.line) ? legHere.line : null;
  const onGuided = onTrain && guide.some((l) => l.line === ride.train!.line && l.stops.includes(ride.at));
  const offHere = onTrain && guide.some((l) => l.line === ride.train!.line && l.to === ride.at);
  const wayOut = !onTrain && guide.length > 0 && (guide.at(-1)!.to === ride.at || (!!legHere && legHere.mode !== 'subway'));
  const exitable = canExit(ride.at);
  const fare = fareOut(ride, 'subway');
  const terminus = onTrain && isTerminus(ride.train!.line, ride.at, ride.train!.dir);
  const l = lineOf(onTrain ? ride.train!.line : lineId);

  return (
    <div className="mr" role="dialog" aria-label={`Subway · ${station(ride.at).zh}`} style={{ ['--mr-line' as string]: l.color }}>
      <header className="mr-head">
        <span className="mr-chip han" style={{ background: l.color }}>
          {l.zh}
        </span>
        {onTrain ? (
          <DoorMap lineId={ride.train!.line} at={ride.at} dir={ride.train!.dir} stopped={inside !== 'running'} />
        ) : (
          <span className="mr-station">
            <b className="han">{station(ride.at).zh}</b>
            <span className="tiny">{station(ride.at).en}</span>
          </span>
        )}
        {!onTrain && ride.stops === 0 && ride.at === from && (
          <button type="button" className="mr-x" onClick={onClose} aria-label="Back to the station">
            ×
          </button>
        )}
      </header>

      <div className="mr-stage">
        {corridor ? (
          <Corridor me={me} step={step} to={corridor} />
        ) : onTrain ? (
          <Carriage me={me} crowd={riders} outside={crowd} state={inside!} at={ride.at} lineId={ride.train!.line} side={doorsOpen(ride.train!.line, ride.at)} running={ms(T.brake)} />
        ) : (
          <Platform
            at={ride.at}
            lineId={lineId}
            sides={sides}
            trains={trains}
            trainKey={trainKey}
            where={where}
            me={me}
            crowd={crowd}
            step={step}
            walking={walking}
            boarding={boarding}
            guided={guidedSide}
            times={{ arrive: ms(T.arrive), leave: ms(T.leave), walk: ms(T.walk), doors: ms(T.doors) }}
            onSide={walkTo}
            onTrain={getOn}
          />
        )}
      </div>

      <footer className="mr-foot">
        <p className="mr-call" aria-live="polite">
          {call ? (
            <>
              <ZhText zh={call.zh} pinyin={pinyin} />
              {call.en && <span className="tiny mr-en">{call.en}</span>}
            </>
          ) : (
            <span className="small mr-en">{onTrain ? '' : 'Walk to a side of the platform: the sign over it says where its trains go.'}</span>
          )}
        </p>
        <div className="mr-acts">
          {onTrain ? (
            <>
              <button type="button" className="btn primary" data-guide={offHere && inside === 'stopped' ? '' : undefined} disabled={inside !== 'stopped'} onClick={getOffHere}>
                <span className="han">下车</span> · Get off
              </button>
              {!terminus && (
                <button type="button" className="btn" disabled={inside !== 'stopped'} onClick={stayOn}>
                  <span className="han">继续乘坐</span> · Stay on
                </button>
              )}
              <span className="small mr-hint">
                {inside === 'stopped'
                  ? offHere
                    ? 'This is your stop.'
                    : onGuided
                      ? 'Not yet — stay on.'
                      : terminus
                        ? 'End of the line.'
                        : 'The train waits for you.'
                  : inside === 'braking'
                    ? 'Coming into the station…'
                    : 'On the way…'}
              </span>
            </>
          ) : where !== 'mid' && trains[where] === 'open' ? (
            <>
              <button type="button" className="btn primary" data-guide={guidedSide === where ? '' : undefined} disabled={walking} onClick={getOn}>
                <span className="han">上车</span> · Get on
              </button>
              <button type="button" className="btn" onClick={() => walkTo('mid')}>
                Step back
              </button>
              <span className="small mr-hint han">{sides[where]?.towards}</span>
            </>
          ) : (
            <>
              {(['top', 'bottom'] as const).map((s) =>
                sides[s] ? (
                  <button key={s} type="button" className="btn mr-side" data-guide={guidedSide === s && where !== s ? '' : undefined} aria-pressed={where === s} disabled={walking || !!corridor} onClick={() => walkTo(s)}>
                    {s === 'top' ? '↑' : '↓'} <span className="han">{sides[s]!.towards}</span>
                  </button>
                ) : null,
              )}
              {lines
                .filter((x) => x !== lineId)
                .map((x) => (
                  <button key={x} type="button" className="btn mr-change" data-guide={guidedChange === x ? '' : undefined} disabled={!!corridor} onClick={() => change(x)} style={{ ['--mr-to' as string]: lineOf(x).color }}>
                    <span className="han">换乘{lineOf(x).zh}</span>
                  </button>
                ))}
              {exitable && (ride.stops > 0 || ride.at !== from) && (
                <button type="button" className="btn primary" data-guide={wayOut ? '' : undefined} disabled={fare > card || !!corridor} onClick={() => onExit(ride)}>
                  <span className="han">出站</span> · Out ({fare} 元)
                </button>
              )}
              {!exitable && <span className="small mr-hint">兔儿爷: “We can’t go out here yet — take a train back, or change lines.”</span>}
              {exitable && fare > card && <span className="small mr-hint">Your card is short — top it up at a station you can leave by.</span>}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// the line map over the doors, and in the bar at the top (MT4, MT5)

function DoorMap({ lineId, at, dir, stopped }: { lineId: string; at: string; dir: 1 | -1; stopped: boolean }) {
  const m = doorMap(lineId, at, dir, 1, 4);
  return (
    <ol className="mr-map" aria-label={stopped ? `At ${station(at).en}` : `Next: ${station(m.stops[m.here + 1] ?? at).en}`}>
      {m.stops.map((s, i) => {
        // stopped (or pulling in): the train is at `at`; running: it has left `at` for the next one
        const state = i < m.here || (!stopped && i === m.here) ? 'past' : i === m.here ? 'here' : i === m.here + 1 ? 'next' : 'ahead';
        return (
          <li key={s} data-state={state}>
            <i />
            <span className="han">{station(s).zh}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// the scenes, drawn in SVG units (one unit = one pixel of the game's art)

const W = 240;
const H = 200;
/** where the train's doors are along a car, and the screen doors with them */
/**
 * The drawing is 240 units across in the middle (what a phone shows), with 120 more each side
 * for wider screens: the platform, the train and the carriage go on past the middle.
 */
const X0 = -120;
const VW = 480;
const DOORS = [-96, -56, -16, 24, 64, 104, 144, 184, 224, 264, 304, 344];
/** the carriage's windows either side of its door (the far ones only show on a wide screen) */
const WINDOWS = [-236, -190, -88, -42, 4, 50, 152, 198, 244, 290];
/** the carriage's doorways (each 48 wide) */
const DOORWAYS = [-144, 96, 336];
const FIG = (d: HeroDress | null, dir: 'down' | 'up' | 'left' | 'right', step: number) => (d ? heroPicture(d, dir, step) : '');

function Scene({ children, label, onTap }: { children: ReactNode; label: string; onTap?: (y: number) => void }) {
  return (
    <svg
      className="mr-svg"
      viewBox={`${X0} 0 ${VW} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label}
      onClick={(e) => {
        if (!onTap) return;
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        // slice: the drawing is scaled to cover the box; the box's middle is the drawing's
        const s = Math.max(r.width / W, r.height / H);
        onTap(H / 2 + (e.clientY - r.top - r.height / 2) / s);
      }}
    >
      {children}
    </svg>
  );
}

/** A station's name board on the wall: the line's colour band, the name, its pinyin. */
function NameBoard({ x, y, at, w = 64 }: { x: number; y: number; at: string; w?: number }) {
  const s = station(at);
  return (
    <g transform={`translate(${x - w / 2} ${y})`} className="mr-board">
      <rect width={w} height={17} rx={1} className="mr-board-bg" />
      <rect y={14} width={w} height={3} style={{ fill: 'var(--mr-line)' }} />
      <text x={w / 2} y={9} textAnchor="middle" className="mr-board-zh">
        {s.zh}
      </text>
      <text x={w / 2} y={12.6} textAnchor="middle" className="mr-board-py">
        {s.en}
      </text>
    </g>
  );
}

/** A train seen from above: three cars, the line's stripe on the platform side, its doors. */
function TrainTop({ side, state, open }: { side: Side; state: TrainAt; open: boolean }) {
  const y = side === 'top' ? 28 : 146;
  const doorY = side === 'top' ? 24 : 0;
  return (
    <g className="mr-train" data-side={side} data-state={state}>
      <g transform={`translate(0 ${y})`}>
        {[-120, -40, 40, 120, 200, 280].map((x, i) => (
          <g key={x} transform={`translate(${x + 2} 0)`}>
            <rect width={76} height={26} rx={i === (side === 'top' ? 0 : 5) ? 8 : 2} className="mr-car" />
            <rect x={6} y={8} width={64} height={10} rx={1} className="mr-roof" />
            {[14, 34, 54].map((ax) => (
              <rect key={ax} x={ax} y={10} width={8} height={6} className="mr-ac" />
            ))}
            <rect y={side === 'top' ? 21 : 2} width={76} height={3} style={{ fill: 'var(--mr-line)' }} />
          </g>
        ))}
        {DOORS.map((dx) => (
          <g key={dx} transform={`translate(${dx - 7} ${doorY})`} className="mr-door" data-open={open ? '' : undefined}>
            <rect width={14} height={2} className="mr-door-gap" />
            <rect width={7} height={2} className="mr-leaf mr-leaf-l" />
            <rect x={7} width={7} height={2} className="mr-leaf mr-leaf-r" />
          </g>
        ))}
        {/* the front: headlights, and their glow on the rails as it comes in */}
        <g transform={side === 'top' ? 'translate(-118 0)' : 'translate(358 0)'}>
          <ellipse cx={side === 'top' ? -18 : 18} cy={13} rx={20} ry={9} className="mr-glow" />
          <rect x={side === 'top' ? 1 : -3} y={6} width={2} height={3} className="mr-lamp" />
          <rect x={side === 'top' ? 1 : -3} y={17} width={2} height={3} className="mr-lamp" />
        </g>
      </g>
    </g>
  );
}

function Platform({
  at,
  sides,
  trains,
  trainKey,
  where,
  me,
  crowd,
  step,
  walking,
  boarding,
  guided,
  times,
  onSide,
  onTrain,
}: {
  at: string;
  lineId: string;
  sides: Record<Side, Train | null>;
  trains: Record<Side, TrainAt>;
  trainKey: Record<Side, number>;
  where: Where;
  me: HeroDress | null;
  crowd: HeroDress[];
  step: number;
  walking: boolean;
  boarding: boolean;
  guided?: Side;
  times: { arrive: number; leave: number; walk: number; doors: number };
  onSide: (w: Where) => void;
  onTrain: () => void;
}) {
  // where you stand: feet just inside the screen doors on a side, or in the middle
  const heroY = where === 'top' ? (boarding ? 18 : 34) : where === 'bottom' ? (boarding ? 126 : 110) : 72;
  const facing = where === 'top' ? 'up' : 'down';
  const sign = (side: Side) => {
    const t = sides[side];
    const next = t ? stopsAhead(t.line, at, t.dir, 3).map((s) => station(s).zh).join(' · ') : '';
    const y = side === 'top' ? 63 : 126;
    return (
      <g className="mr-sign" data-guide={guided === side ? '' : undefined} transform={`translate(${W / 2 - 58} ${y})`}>
        <rect width={116} height={11} rx={1} className="mr-sign-bg" />
        <text x={4} y={5.2} className="mr-sign-zh">
          {t ? `${side === 'top' ? '↑' : '↓'} ${t.towards}` : '本侧不载客'}
        </text>
        <text x={4} y={9.2} className="mr-sign-next">
          {t ? `${next} …` : 'No trains from this side'}
        </text>
        {/* the screen: the next train is always coming in */}
        <rect x={84} y={1.5} width={29} height={8} rx={0.8} className="mr-pids" />
        <text x={98.5} y={7} textAnchor="middle" className="mr-pids-t">
          {t ? (trains[side] === 'open' ? '请上车' : trains[side] === 'arriving' ? '列车进站' : '即将进站') : '—'}
        </text>
      </g>
    );
  };
  return (
    <Scene
      label={`The platform at ${station(at).en}`}
      onTap={(y) => {
        if (where !== 'mid' && trains[where] === 'open' && (where === 'top' ? y < 58 : y > 142)) return onTrain();
        onSide(y < 82 ? 'top' : y > 118 ? 'bottom' : 'mid');
      }}
    >
      <defs>
        <pattern id="mr-tiles" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" className="mr-floor" />
          <path d="M0 0.25H12M0.25 0V12" className="mr-floor-line" />
        </pattern>
        <pattern id="mr-wall" width="8" height="6" patternUnits="userSpaceOnUse">
          <rect width="8" height="6" className="mr-wall" />
          <path d="M0 0.25H8M0.25 0V6" className="mr-wall-line" />
        </pattern>
        <pattern id="mr-rails" width="6" height="26" patternUnits="userSpaceOnUse">
          <rect width="6" height="26" className="mr-bed" />
          <rect x={1} y={2} width={3} height={22} className="mr-sleeper" />
        </pattern>
      </defs>
      {/* the walls with the station's name, the tracks, the screen doors, the platform */}
      <rect x={X0} width={VW} height={26} fill="url(#mr-wall)" />
      <rect x={X0} y={22} width={VW} height={2} style={{ fill: 'var(--mr-line)' }} />
      {[-80, 40, 120, 200, 320].map((x) => (
        <NameBoard key={x} x={x} y={3} at={at} />
      ))}
      <rect x={X0} y={26} width={VW} height={30} fill="url(#mr-rails)" />
      <rect x={X0} y={32} width={VW} height={1.5} className="mr-rail" />
      <rect x={X0} y={49} width={VW} height={1.5} className="mr-rail" />
      <rect x={X0} y={144} width={VW} height={30} fill="url(#mr-rails)" />
      <rect x={X0} y={150} width={VW} height={1.5} className="mr-rail" />
      <rect x={X0} y={167} width={VW} height={1.5} className="mr-rail" />
      <rect x={X0} y={174} width={VW} height={26} fill="url(#mr-wall)" />
      <rect x={X0} y={176} width={VW} height={2} style={{ fill: 'var(--mr-line)' }} />
      {[-80, 40, 120, 200, 320].map((x) => (
        <NameBoard key={x} x={x} y={180} at={at} />
      ))}
      {(['top', 'bottom'] as const).map((s) => (
        <g key={`${s}-${trainKey[s]}`} style={{ ['--mr-arrive' as string]: `${times.arrive}ms`, ['--mr-leave' as string]: `${times.leave}ms`, ['--mr-doors' as string]: `${times.doors}ms` }}>
          {trains[s] !== 'none' && <TrainTop side={s} state={trains[s]} open={trains[s] === 'open'} />}
        </g>
      ))}
      <rect x={X0} y={56} width={VW} height={88} fill="url(#mr-tiles)" />
      <rect x={X0} y={58.5} width={VW} height={2.5} className="mr-tactile" />
      <rect x={X0} y={139} width={VW} height={2.5} className="mr-tactile" />
      {(['top', 'bottom'] as const).map((s) => (
        <g key={s} transform={`translate(0 ${s === 'top' ? 54 : 142})`} style={{ ['--mr-doors' as string]: `${times.doors}ms` }}>
          <rect x={X0} width={VW} height={4} className="mr-glass" />
          {DOORS.map((dx) => (
            <g key={dx} transform={`translate(${dx - 7} 0)`} className="mr-sdoor" data-open={trains[s] === 'open' ? '' : undefined}>
              <rect x={-1} width={1} height={4} className="mr-post" />
              <rect x={14} width={1} height={4} className="mr-post" />
              <rect width={7} height={4} className="mr-leaf mr-leaf-l mr-sleaf" />
              <rect x={7} width={7} height={4} className="mr-leaf mr-leaf-r mr-sleaf" />
            </g>
          ))}
        </g>
      ))}
      {/* pillars and benches down the middle */}
      {[-90, 30, 210, 330].map((x) => (
        <g key={x} transform={`translate(${x - 6} 86)`}>
          <rect width={12} height={20} className="mr-pillar" />
          <rect x={2} y={3} width={8} height={11} className="mr-poster" />
        </g>
      ))}
      {[-30, 78, 162, 270].map((x) => (
        <rect key={x} x={x - 10} y={98} width={20} height={5} rx={1} className="mr-bench" />
      ))}
      {/* people waiting down the middle, and the ones getting off the train; the signs hang over them */}
      {crowd.slice(0, 3).map((d, i) => (
        <image key={i} href={FIG(d, i === 1 ? 'down' : 'up', 0)} x={[56, 172, 140][i]} y={[80, 84, 90][i]} width={16} height={32} className="mr-fig" />
      ))}
      {(['top', 'bottom'] as const).map((s) =>
        trains[s] === 'open'
          ? crowd.slice(3, 5).map((d, i) => (
              <image key={`${s}${i}`} href={FIG(d, s === 'top' ? 'down' : 'up', 0)} x={DOORS[4 + i * 3]! - 8} y={s === 'top' ? 34 : 112} width={16} height={32} className="mr-fig mr-alight" data-side={s} />
            ))
          : null,
      )}
      {sign('top')}
      {sign('bottom')}
      <image
        href={FIG(me, facing, walking ? step : 0)}
        x={DOORS[5]! - 8}
        y={0}
        width={16}
        height={32}
        className="mr-me"
        data-boarding={boarding ? '' : undefined}
        style={{ transform: `translateY(${heroY}px)`, transitionDuration: `${times.walk}ms` }}
      />
    </Scene>
  );
}

/** Inside the train, seen from the aisle: windows and doors on the far side, seats, poles, people. */
function Carriage({ me, crowd, outside, state, at, side, running }: { me: HeroDress | null; crowd: HeroDress[]; outside: HeroDress[]; state: Inside; at: string; lineId: string; side: 'left' | 'right'; running: number }) {
  const atStation = state !== 'running';
  const open = state === 'stopped' || state === 'off';
  return (
    <Scene label={atStation ? `The train at ${station(at).en}` : 'In the train'}>
      <defs>
        <clipPath id="mr-windows">
          {WINDOWS.map((x) => (
            <rect key={x} x={x} y={40} width={38} height={52} rx={3} />
          ))}
          {DOORWAYS.map((x) => (
            <rect key={x} x={x} y={36} width={48} height={114} />
          ))}
        </clipPath>
      </defs>
      {/* outside: the tunnel's lights streaming past, or the station sliding in and stopping */}
      <g clipPath="url(#mr-windows)">
        <rect x={X0} y={30} width={VW} height={120} className="mr-tunnel" />
        <g className="mr-streaks" data-state={state}>
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={X0 + i * 60} y={58} width={22} height={2} className="mr-streak" />
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={`b${i}`} x={X0 + i * 60 + 30} y={96} width={10} height={1.5} className="mr-streak mr-streak-dim" />
          ))}
        </g>
        <g key={at} className="mr-outside" data-state={state} style={{ ['--mr-brake' as string]: `${running}ms` }}>
          <rect x={X0} y={30} width={VW} height={120} className="mr-swall" />
          {[-74, 46, 194, 314].map((x) => (
            <rect key={x} x={x - 4} y={30} width={8} height={120} className="mr-spillar" />
          ))}
          {[-120, 0, 120, 240, 360].map((x) => (
            <NameBoard key={x} x={x} y={50} at={at} w={56} />
          ))}
          <rect x={X0} y={86} width={VW} height={2} style={{ fill: 'var(--mr-line)' }} />
          <rect x={X0} y={112} width={VW} height={40} className="mr-sfloor" />
          {outside.slice(0, 2).map((d, i) => (
            <image key={i} href={FIG(d, 'down', 0)} x={[60, 166][i]} y={84} width={16} height={32} className="mr-fig" />
          ))}
        </g>
      </g>
      {/* the doors: each leaf, with its window, slides back into the wall's pocket */}
      <g className="mr-cdoors" data-open={open ? '' : undefined} data-side={side}>
        {DOORWAYS.map((x) => (
          <g key={x}>
            <path d={`M${x} 36h24v114h-24Z M${x + 4} 42h16v50h-16Z`} fillRule="evenodd" className="mr-cleaf mr-cleaf-l mr-cdoor" />
            <path d={`M${x + 24} 36h24v114h-24Z M${x + 28} 42h16v50h-16Z`} fillRule="evenodd" className="mr-cleaf mr-cleaf-r mr-cdoor" />
          </g>
        ))}
      </g>
      {/* the car's far wall: panels round the windows and the doorway */}
      <path
        d={`M${X0} 0h${VW}v150h${-VW}Z ${WINDOWS.map((x) => `M${x} 43a3 3 0 0 1 3-3h32a3 3 0 0 1 3 3v46a3 3 0 0 1-3 3h-32a3 3 0 0 1-3-3Z`).join(' ')} ${DOORWAYS.map((x) => `M${x - 2} 34h52v116h-52Z`).join(' ')}`}
        fillRule="evenodd"
        className="mr-panel"
      />
      <rect x={X0} y={0} width={VW} height={22} className="mr-ceiling" />
      <rect x={X0} y={20} width={VW} height={2} className="mr-light" />
      <g className="mr-cdoors" data-open={open ? '' : undefined}>
        {DOORWAYS.map((x) => (
          <g key={x}>
            <rect x={x - 2} y={30} width={52} height={6} className="mr-cdoor-top" />
            <circle cx={x + 24} cy={33} r={1.6} className="mr-cdoor-lamp" />
          </g>
        ))}
      </g>
      {/* seats under the windows, poles by the door, the floor */}
      {[-236, -88, 4, 152, 244].map((x) => (
        <rect key={x} x={x} y={112} width={84} height={14} rx={3} className="mr-seat" />
      ))}
      <rect x={X0} y={150} width={VW} height={50} className="mr-cfloor" />
      <rect x={X0} y={150} width={VW} height={2} className="mr-cfloor-edge" />
      {[-150, -90, 90, 150, 330].map((x) => (
        <rect key={x} x={x - 1} y={22} width={2.5} height={160} className="mr-pole" />
      ))}
      <g className="mr-sway" data-state={state}>
        {crowd.slice(2, 5).map((d, i) => (
          <image key={i} href={FIG(d, 'down', 0)} x={[30, 186, 62][i]} y={[98, 98, 132][i]} width={16} height={32} className="mr-fig" />
        ))}
        <image href={FIG(me, state === 'off' ? 'up' : 'down', 0)} x={112} y={128} width={16} height={32} className="mr-me" data-state={state} />
      </g>
    </Scene>
  );
}

/** Changing lines: a short walk down a passage under the 换乘 sign. */
function Corridor({ me, step, to }: { me: HeroDress | null; step: number; to: string }) {
  const l = lineOf(to);
  return (
    <Scene label={`The passage to ${l.en}`}>
      <defs>
        <pattern id="mr-ctiles" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" className="mr-floor" />
          <path d="M0 0.25H12M0.25 0V12" className="mr-floor-line" />
        </pattern>
      </defs>
      <rect x={X0} width={VW} height={70} className="mr-wall" />
      <rect x={X0} y={66} width={VW} height={4} style={{ fill: l.color }} />
      <rect x={X0} y={70} width={VW} height={130} fill="url(#mr-ctiles)" />
      <g transform="translate(70 22)">
        <rect width={100} height={24} rx={2} className="mr-board-bg" />
        <rect x={6} y={6} width={12} height={12} rx={2} style={{ fill: l.color }} />
        <text x={24} y={13} className="mr-board-zh" style={{ fontSize: 9 }}>
          换乘{l.zh} →
        </text>
        <text x={24} y={20} className="mr-board-py">
          {l.en}
        </text>
      </g>
      {[-90, -30, 30, 90, 150, 210, 270, 330].map((x) => (
        <path key={x} d={`M${x} 140h14l-4 -4M${x + 14} 140l-4 4`} className="mr-arrow" />
      ))}
      <image href={FIG(me, 'right', step)} x={X0} y={110} width={16} height={32} className="mr-me mr-walk-across" />
    </Scene>
  );
}

// ---------------------------------------------------------------------------

const seedOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100000, 7);

/** a few riders, the same at a station each time (seeded by where), dressed from the game's clothes */
function people(clothes: ClothesContent, seed: number): HeroDress[] {
  let x = seed * 9301 + 49297;
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const pick = (slot: string) => {
    const items = clothes.clothes.filter((c) => c.slot === slot);
    if (!items.length) return undefined;
    const c = items[Math.floor(rand() * items.length)]!;
    return `${c.id}:${c.colours[Math.floor(rand() * c.colours.length)]!.id}`;
  };
  if (!clothes.clothes.length) return [];
  return Array.from({ length: 6 }, () => {
    const outfit: Outfit = { top: pick('top'), bottom: pick('bottom'), shoes: pick('shoes') };
    if (rand() < 0.3) outfit.hat = pick('hat');
    if (rand() < 0.3) outfit.accessory = pick('accessory');
    return dressOf(randomLook(rand, DEFAULT_LOOK), outfit, clothes);
  });
}
