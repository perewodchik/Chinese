import { useState } from 'react';
import { Link } from 'react-router';
import { dayOf, formatTime, partOfDay } from '../core/clock';
import { dateZh, festivalOf, WEATHER_EN, WEATHER_ICON, weatherOf } from '../core/calendar';
import { districtInfo } from '../core/districts';
import { useLibrary } from '../../features/shared/library';
import { paths } from '../../navigation/paths';
import { pinyinOf } from './pinyin';

export type Panel = 'map' | 'bag' | 'tasks';

const DAY_ICON = { morning: '☀', day: '☀', evening: '◐', night: '☾' } as const;

/**
 * The game's one line at the top (concept §4): where you are (tap for 拼),
 * the game time, and 🗺 🎒 📜. Fixed widths, so nothing moves as the clock
 * turns or the place changes.
 */
export function TopBar({ district, minutes, open, onPhoto }: { district: string; minutes: number; open: (p: Panel) => void; onPhoto: () => void }) {
  const lib = useLibrary();
  const [py, setPy] = useState(false);
  const info = districtInfo(district);
  const weather = weatherOf(dayOf(minutes));
  const festival = festivalOf(dayOf(minutes));
  const name = info?.name ?? '北京';
  return (
    <div className="wt-bar">
      <Link className="wt-btn wt-exit" to={paths.play()} aria-label="Leave the game">
        ‹
      </Link>
      <button type="button" className="wt-place" onClick={() => setPy((v) => !v)} title={info?.en}>
        <span className="han">{name}</span>
        {py && <span className="wt-py">{pinyinOf(name, lib)}</span>}
      </button>
      <span className="wt-time" aria-label={`Game time ${formatTime(minutes)}, ${dateZh(dayOf(minutes))}, ${WEATHER_EN[weather]}`} title={`${dateZh(dayOf(minutes))}${festival ? ` ${festival.zh}` : ''}`}>
        <span aria-hidden>{DAY_ICON[partOfDay(minutes)]}</span> {formatTime(minutes)}
        {/* today's weather (X4) in a slot of its own, so the chip never changes width */}
        <span className="wt-sky" aria-hidden>
          {festival ? '🏮' : weather === 'clear' ? '' : WEATHER_ICON[weather]}
        </span>
      </span>
      <span className="spacer" />
      <button type="button" className="wt-btn" onClick={onPhoto} aria-label="Take a photo">
        📷
      </button>
      <button type="button" className="wt-btn" onClick={() => open('map')} aria-label="Map (M)">
        🗺
      </button>
      <button type="button" className="wt-btn" onClick={() => open('bag')} aria-label="Bag (B)">
        🎒
      </button>
      <button type="button" className="wt-btn" onClick={() => open('tasks')} aria-label="Tasks and riddles">
        📜
      </button>
    </div>
  );
}
