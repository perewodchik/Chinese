import { useEffect, useRef, useState } from 'react';
import { say } from '../../platform/audio/voiceOut';
import { board, callNext, fareOut, getOff, runOn, startRide, stationSign, trainsAt, type RideState, type Train } from '../core/ride';
import { station } from '../core/travel';
import { ZhText } from './ZhText';

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
  pinyin,
  fast,
  canExit,
  card,
  onExit,
  onClose,
}: {
  from: string;
  pinyin: boolean;
  /** three rides done: the calls go quicker */
  fast: boolean;
  /** stations whose gates you can go out by (they have a map) */
  canExit: (station: string) => boolean;
  /** the 交通卡's balance */
  card: number;
  onExit: (ride: RideState) => void;
  onClose: () => void;
}) {
  const [ride, setRide] = useState<RideState>(() => startRide(from));
  const [phase, setPhase] = useState<Phase>('platform');
  const [line, setLine] = useState<string>('');
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
        setRide((r) => getOff(r));
        setPhase('platform');
        return;
      }
      setLine(call);
      void say(call).catch(() => undefined);
      timer.current = window.setTimeout(() => {
        setRide((r) => runOn(r));
        setPhase('stopped');
      }, step);
    } else if (phase === 'stopped') {
      const here = `${station(ride.at).zh}到了。`;
      setLine(here);
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
  };

  const trains = trainsAt(ride.at);
  const exitable = canExit(ride.at);
  const fare = fareOut(ride);
  const onTrain = ride.train !== null;

  return (
    <div className="wp-scrim">
      <section className="wr" role="dialog" aria-label="Subway">
        <header className="wr-head">
          <span className="wr-sign han">{stationSign(ride.at)}</span>
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
            {line ? <ZhText zh={line} pinyin={pinyin} /> : <span className="small muted">Which train? The signs say where each one goes.</span>}
          </p>
          {onTrain ? (
            <div className="wr-acts">
              <button type="button" className="btn primary" disabled={phase !== 'stopped'} onClick={off}>
                <span className="han">下车</span> · Get off
              </button>
              <span className="small muted">{phase === 'stopped' ? 'Get off here, or stay on.' : 'The train is moving…'}</span>
            </div>
          ) : (
            <>
              <ul className="wr-trains">
                {trains.map((t) => (
                  <li key={`${t.line}${t.dir}`}>
                    <button type="button" className="wr-train-btn" onClick={() => take(t)}>
                      <b className="han">{t.name}</b> <span className="han">{t.towards}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="wr-acts">
                {exitable && (ride.stops > 0 || ride.at !== from) && (
                  <button type="button" className="btn primary" disabled={fare > card} onClick={() => onExit(ride)}>
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
