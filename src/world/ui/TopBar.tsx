import { dayOf, formatTime, partOfDay } from '../core/clock';
import { dateZh, festivalOf, WEATHER_EN, WEATHER_ICON, weatherOf } from '../core/calendar';
import { Link } from 'react-router';
import { paths } from '../../navigation/paths';
import './menu.css';
import { PixelIcon } from './PixelIcon';

import type { PanelId } from './menu';

const DAY_ICON = { morning: '☀', day: '☀', evening: '◐', night: '☾' } as const;

/**
 * The game's one line at the top (concept §4): ‹ out, the game time, and the menu (with a red
 * dot when something in it is new; it opens where you left it, §10). The learner (2026-09-30,
 * iPhone) took the rest off: the place's name is on the corner map already, the camera is in
 * the bag (拍照), the map and the bag are tabs of the menu. Fixed widths, so nothing moves as
 * the clock turns.
 */
export function TopBar({ minutes, open, news }: { minutes: number; open: (p: PanelId) => void; news?: boolean }) {
  const weather = weatherOf(dayOf(minutes));
  const festival = festivalOf(dayOf(minutes));
  return (
    <div className="wt-bar">
      <Link className="wt-btn wt-exit" to={paths.play()} aria-label="Leave the game">
        ‹
      </Link>
      <span className="wt-time" aria-label={`Game time ${formatTime(minutes)}, ${dateZh(dayOf(minutes))}, ${WEATHER_EN[weather]}`} title={`${dateZh(dayOf(minutes))}${festival ? ` ${festival.zh}` : ''}`}>
        <span className="wt-when" aria-hidden>
          {DAY_ICON[partOfDay(minutes)]}
        </span>
        <span className="wt-clock">{formatTime(minutes)}</span>
        {/* today's weather (X4) in a slot of its own, so the chip never changes width */}
        <span className="wt-sky" aria-hidden>
          {festival ? '🏮' : weather === 'clear' ? '' : WEATHER_ICON[weather]}
        </span>
      </span>
      <span className="spacer" />
      <button type="button" className="wt-btn wt-menu" onClick={() => open('menu')} aria-label={news ? 'Menu — something new' : 'Menu: journal, bag, map, collection'}>
        <PixelIcon name="menu" size={14} />
        {news && <i className="mn-dot" aria-hidden />}
      </button>
    </div>
  );
}
