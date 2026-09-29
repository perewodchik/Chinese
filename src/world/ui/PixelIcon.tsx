import type { OptionIcon } from './companionLines';

/**
 * Tiny icons drawn in square pixels, in the text's own colour — what the
 * game uses where the site would put an emoji (prompt §11: no emoji in UI
 * text). Each is a 7×7 grid; `#` is a lit pixel.
 */
const ICONS: Record<OptionIcon | 'star-full', readonly string[]> = {
  // a round arrow: say it again
  again: ['..###..', '.#...#.', '#.....#', '#......', '#...###', '.#...##', '..####.'],
  // a speech bubble with a question in it
  ask: ['#######', '#..#..#', '#...#.#', '#..#..#', '#.....#', '#######', '.##....'],
  // a little lamp: a hint
  hint: ['..###..', '.#...#.', '.#...#.', '.#...#.', '..#.#..', '..###..', '..###..'],
  // a flag on a pole: where to go
  now: ['.####..', '.#####.', '.####..', '.#.....', '.#.....', '.#.....', '###....'],
  // a star to keep a word, hollow…
  star: ['...#...', '...#...', '##.#.##', '.#...#.', '..#.#..', '.#.#.#.', '#.....#'],
  // …and kept
  'star-full': ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'],
};

export function PixelIcon({ name, size = 14 }: { name: OptionIcon | 'star-full'; size?: number }) {
  const rows = ICONS[name];
  return (
    <svg className="w-px-icon" width={size} height={size} viewBox="0 0 7 7" aria-hidden shapeRendering="crispEdges">
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)))}
    </svg>
  );
}
