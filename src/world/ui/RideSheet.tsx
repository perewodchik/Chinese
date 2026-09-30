import { useEffect, useRef, useState } from 'react';
import { playLine } from './lineVoice';
import { arrivalCall, board, callEn, callNext, fareOut, getOff, HOLD_ON, nextStop, runOn, startRide, stationSign, stopCalls, trainsAt, type RideState, type Train } from '../core/ride';
import { station } from '../core/travel';
import type { Mode } from '../core/travel';
import type { RouteLeg } from '../core/journal';
import { ZhText } from './ZhText';

/** the next few stops of a train, so a direction means something (bold: stops you can get off at) */
function stopsAhead(t: Train, from: string, n = 5): string[] {
  const out: string[] = [];
  for (let at = from; out.length < n; ) {
    const next = nextStop(t.line, at, t.dir);
    if (!next || next === from) break;
    out.push(next);
    at = next;
  }
  return out;
}

/** a stop takes this long on screen: the call, then the arrival */
const STEP_MS = 2600;

type Phase = 'platform' | 'moving' | 'stopped';

/**
 * On the platform and in the train (concept §5): choose a train by its sign,
 * hear 「下一站：……」, get off where you like. A station with no map yet
 * lets you change trains but not go out; getting off wrong costs nothing.
 * The world is paused while this is open.
 */
export function RideSheet({
  from,
  mode = 'subway',
  pinyin,
  fast,
  canExit,
  card,
  onExit,
  onClose,
  guide = [],
}: {
  from: string;
  /** a subway platform, a bus stop, or the railway station */
  mode?: Mode;
  pinyin: boolean;
  /** three rides done: the calls go quicker */
  fast: boolean;
  /** stations whose gates you can go out by (they have a map) */
  canExit: (station: string) => boolean;
  /** the 交通卡's balance */
  card: number;
  onExit: (ride: RideState) => void;
  onClose: () => void;
  /** M6 "Take me there": the rides on the way — their trains are marked, and where to get off */
  guide?: readonly Extract<RouteLeg, { kind: 'ride' }>[];
}) {
  const [ride, setRide] = useState<RideState>(() => startRide(from));
  const [phase, setPhase] = useState<Phase>('platform');
  const [line, setLine] = useState<string>('');
  /** §13 N1: the call's English, as the trains say it after the Chinese */
  const [lineEn, setLineEn] = useState<string>('');
  const timer = useRef<number | undefined>(undefined);
  const step = fast ? STEP_MS / 3 : STEP_MS;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // In the train: call the next stop, run on, stop, and again — until you get off or the line ends.
  useEffect(() => {
    if (!ride.train) return;
    window.clearTimeout(timer.current);
    if (phase === 'moving') {
      const call = callNext(ride.train.line, ride.at, ride.train.dir);
      if (!call) {
        setLine('终点站到了。请下车。');
        setLineEn('This is the terminal station. Please get off.');
        setRide((r) => getOff(r));
        setPhase('platform');
        return;
      }
      // §13 N1: pulling out of the first station, 「请站稳扶好。」 first; the English after the Chinese
      const first = ride.stops === 0;
      setLine(first ? `${HOLD_ON.zh}${call}` : call);
      setLineEn(callEn(ride.train.line, ride.at, ride.train.dir) ?? '');
      void (async () => {
        if (first) await playLine({ speaker: 'announcer', zh: HOLD_ON.zh, en: HOLD_ON.en, node: '' });
        await playLine({ speaker: 'announcer', zh: call, en: '', node: '' });
      })();
      timer.current = window.setTimeout(() => {
        setRide((r) => runOn(r));
        setPhase('stopped');
      }, step);
    } else if (phase === 'stopped') {
      const here = arrivalCall(ride.at);
      // §13 N1: where to change, which doors open
      const more = stopCalls(ride.train.line, ride.at);
      setLine([here, ...more.map((m) => m.zh)].join(''));
      setLineEn(more.map((m) => m.en).join(' '));
      void (async () => {
        await playLine({ speaker: 'announcer', zh: here, en: '', node: '' });
        for (const m of more) await playLine({ speaker: 'announcer', zh: m.zh, en: m.en, node: '' });
      })();
      timer.current = window.setTimeout(() => setPhase('moving'), step * 1.4);
    }
  }, [phase, ride.train, ride.at, step]);

  const take = (t: Train) => {
    setRide((r) => board(r, t));
    setPhase('moving');
  };
  const off = () => {
    window.clearTimeout(timer.current);
    setRide((r) => getOff(r));
    setPhase('platform');
    setLine('');
    setLineEn('');
  };

  const trains = trainsAt(ride.at, mode);
  const exitable = canExit(ride.at);
  const fare = fareOut(ride, mode);
  const onTrain = ride.train !== null;
  // M6: the train to take from here, where to get off it, and whether this is the way out
  const legHere = guide.find((l) => l.from === ride.at);
  const isGuided = (t: Train) => !!legHere && t.line === legHere.line && t.towards === legHere.direction;
  const onGuided = onTrain && guide.some((l) => l.line === ride.train!.line && l.stops.includes(ride.at));
  const getOffHere = onTrain && guide.some((l) => l.line === ride.train!.line && l.to === ride.at);
  // out here: the last stop, or a change to a bus or train that leaves from its own stop outside
  const wayOut = !onTrain && guide.length > 0 && (guide.at(-1)!.to === ride.at || (!!legHere && legHere.mode !== mode));

  return (
    <div className="wp-scrim">
      <section className="wr" role="dialog" aria-label="Subway">
        <header className="wr-head">
          <span className="wr-sign han">{stationSign(ride.at)}{mode === 'bus' ? ' 🚌' : ''}</span>
          {onTrain && (
            <span className="wr-train small">
              <span className="han">
                {ride.train!.name} {ride.train!.towards}
              </span>
            </span>
          )}
          <span className="spacer" />
          {!onTrain && ride.stops === 0 && (
            <button type="button" className="wd-tool" onClick={onClose} aria-label="Back to the station">
              ×
            </button>
          )}
        </header>
        <div className="wr-body">
          <p className="wr-call" aria-live="polite">
            {line ? (
              <>
                <ZhText zh={line} pinyin={pinyin} />
                {lineEn && <span className="tiny muted wr-en">{lineEn}</span>}
              </>
            ) : <span className="small muted">{mode === 'bus' ? 'Which bus? The sign says where each one goes.' : 'Which train? The signs say where each one goes.'}</span>}
          </p>
          {onTrain ? (
            <div className="wr-acts">
              <button type="button" className="btn primary" data-guide={getOffHere && phase === 'stopped' ? '' : undefined} disabled={phase !== 'stopped'} onClick={off}>
                <span className="han">下车</span> · Get off
              </button>
              <span className="small muted">
                {getOffHere && phase === 'stopped'
                  ? 'Get off here — this is your stop.'
                  : phase === 'stopped'
                    ? onGuided
                      ? 'Not yet — stay on.'
                      : 'Get off here, or stay on.'
                    : 'The train is moving…'}
              </span>
            </div>
          ) : (
            <>
              <ul className="wr-trains">
                {trains.map((t) => (
                  <li key={`${t.line}${t.dir}`}>
                    <button type="button" className="wr-train-btn" data-guide={isGuided(t) ? '' : undefined} onClick={() => take(t)}>
                      <b className="han">{t.name}</b> <span className="han">{t.towards}</span>
                      {isGuided(t) && <span className="wr-guide tiny">This one · {legHere!.stops.length - 1} {legHere!.stops.length === 2 ? 'stop' : 'stops'}</span>}
                      <span className="wr-next tiny muted">
                        {stopsAhead(t, ride.at).map((st, i) => (
                          <span key={st} className="han" data-open={canExit(st) ? '' : undefined}>
                            {i ? ' · ' : ''}
                            {station(st).zh}
                          </span>
                        ))}
                        {' …'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="wr-acts">
                {exitable && (ride.stops > 0 || ride.at !== from) && (
                  <button type="button" className="btn primary" data-guide={wayOut ? '' : undefined} disabled={fare > card} onClick={() => onExit(ride)}>
                    <span className="han">出站</span> · Go out ({fare} 元 from your card)
                  </button>
                )}
                {!exitable && <span className="small muted">兔儿爷: “We can’t go out here yet — take a train back, or change lines.”</span>}
                {fare > card && <span className="small muted">Your card is short — top it up at a station you can leave by.</span>}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
