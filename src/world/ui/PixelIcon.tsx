import type { OptionIcon } from './companionLines';

/**
 * Tiny icons drawn in square pixels, in the text's own colour — what the
 * game uses where the site would put an emoji (prompt §11: no emoji in UI
 * text). Each is a small square grid, drawn at a whole number of screen
 * pixels per pixel (7 → 14px, 9 → 18px); `#` is a lit pixel.
 */
export type IconName =
  | OptionIcon
  | 'star-full'
  | 'again'
  | 'speaker'
  | 'mic'
  | 'keys'
  | 'send'
  | 'face'
  | 'edit'
  | 'close'
  | 'check'
  | 'huh'
  | 'gear'
  | 'heart'
  | 'heart-empty'
  | 'back'
  | 'menu';

const ICONS: Record<IconName, readonly string[]> = {
  // a round arrow: once more
  again: ['..###..', '.#...#.', '#.....#', '#......', '#...###', '.#...##', '..####.'],
  // a speech bubble with a question in it
  ask: ['#######', '#..#..#', '#...#.#', '#..#..#', '#.....#', '#######', '.##....'],
  // a little lamp: a hint
  hint: ['..###..', '.#...#.', '.#...#.', '.#...#.', '..#.#..', '..###..', '..###..'],
  // a flag on a pole: where to go
  now: ['.####..', '.#####.', '.####..', '.#.....', '.#.....', '.#.....', '###....'],
  // a star to keep a word, hollow… (9×9: a star needs the room)
  star: ['....#....', '...#.#...', '####.####', '#.......#', '.#.....#.', '..#...#..', '.#..#..#.', '.#.#.#.#.', '.##...##.'],
  // …and kept
  'star-full': ['....#....', '...###...', '#########', '#########', '.#######.', '..#####..', '.#######.', '.###.###.', '.##...##.'],
  // a loudspeaker: hear the line
  speaker: ['...#...', '..##.#.', '####..#', '####..#', '####..#', '..##.#.', '...#...'],
  // a microphone: talk
  mic: ['..###..', '..###..', '..###..', '#.###.#', '.#...#.', '..###..', '...#...'],
  // a keyboard: type
  keys: ['.......', '#######', '#.#.#.#', '#######', '#.###.#', '#######', '.......'],
  // an arrow: send
  send: ['...#...', '...##..', '######.', '#######', '######.', '...##..', '...#...'],
  // a face: stickers
  face: ['.#####.', '#.....#', '#.#.#.#', '#.....#', '#.###.#', '#.....#', '.#####.'],
  // a pencil: change it
  edit: ['.....##', '....###', '...###.', '..###..', '.###...', '##.....', '#......'],
  close: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
  // understood…
  check: ['.......', '......#', '.....#.', '#...#..', '.#.#...', '..#....', '.......'],
  // …or not
  huh: ['..###..', '.#...#.', '.....#.', '....#..', '...#...', '.......', '...#...'],
  // a cog: settings (9×9)
  gear: ['....#....', '.#.###.#.', '..##.##..', '.##...##.', '###...###', '.##...##.', '..##.##..', '.#.###.#.', '....#....'],
  // friendship, kept and not yet
  heart: ['.......', '.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  'heart-empty': ['.......', '.##.##.', '#..#..#', '#.....#', '.#...#.', '..#.#..', '...#...'],
  // back: an arrow to the left
  // three bars: the menu
  menu: ['.......', '#######', '.......', '#######', '.......', '#######', '.......'],
  back: ['...#...', '..##...', '.######', '#######', '.######', '..##...', '...#...'],
};

export function PixelIcon({ name, size = 14 }: { name: IconName; size?: number }) {
  const rows = ICONS[name];
  const n = rows.length;
  return (
    <svg className="w-px-icon" width={size} height={size} viewBox={`0 0 ${n} ${n}`} aria-hidden shapeRendering="crispEdges">
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)))}
    </svg>
  );
}
