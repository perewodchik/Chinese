import type { Time } from './content';

/**
 * A clock face, drawn: twelve marks, the numbers, two hands. The hour hand
 * moves on with the minutes, as a real one does — half past three has the
 * hour hand between the 3 and the 4, which is half of what reading a clock is.
 */
export function Clock({ time, part }: { time: Time; part: boolean }) {
  const minAngle = (time.m / 60) * 360;
  const hourAngle = ((time.h % 12) / 12) * 360 + (time.m / 60) * 30;
  const hand = (angle: number, len: number, w: number, cls: string) => {
    const r = ((angle - 90) * Math.PI) / 180;
    return (
      <line
        className={cls}
        x1={100}
        y1={100}
        x2={100 + Math.cos(r) * len}
        y2={100 + Math.sin(r) * len}
        strokeWidth={w}
        strokeLinecap="round"
      />
    );
  };
  return (
    <div className="g-clock-wrap">
      <svg className="g-clock" viewBox="0 0 200 200" role="img" aria-label="a clock">
        <circle cx={100} cy={100} r={92} className="g-clock-face" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          return (
            <text key={i} x={100 + Math.cos(a) * 72} y={100 + Math.sin(a) * 72 + 6} textAnchor="middle" className="g-clock-num">
              {i === 0 ? 12 : i}
            </text>
          );
        })}
        {Array.from({ length: 60 }, (_, i) => {
          const a = ((i * 6 - 90) * Math.PI) / 180;
          const long = i % 5 === 0;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * (long ? 82 : 86)}
              y1={100 + Math.sin(a) * (long ? 82 : 86)}
              x2={100 + Math.cos(a) * 90}
              y2={100 + Math.sin(a) * 90}
              className="g-clock-tick"
              strokeWidth={long ? 2 : 1}
            />
          );
        })}
        {hand(hourAngle, 44, 6, 'g-clock-hour')}
        {hand(minAngle, 66, 3.5, 'g-clock-min')}
        <circle cx={100} cy={100} r={5} className="g-clock-pin" />
      </svg>
      {part && (
        <span className="g-clock-part" aria-label={['morning', 'afternoon', 'evening'][time.part]}>
          <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
            {time.part === 2 ? (
              <path d="M26 6a15 15 0 1 0 8 26A13 13 0 0 1 26 6z" className="g-moon" />
            ) : (
              <g className="g-sun">
                <circle cx="20" cy="20" r="8" />
                {Array.from({ length: 8 }, (_, i) => {
                  const a = (i * Math.PI) / 4;
                  return <line key={i} x1={20 + Math.cos(a) * 12} y1={20 + Math.sin(a) * 12} x2={20 + Math.cos(a) * 17} y2={20 + Math.sin(a) * 17} />;
                })}
              </g>
            )}
          </svg>
          <span className="tiny muted">{['morning', 'afternoon', 'evening'][time.part]}</span>
        </span>
      )}
    </div>
  );
}
