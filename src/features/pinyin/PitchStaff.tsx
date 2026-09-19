import { templateFor, type Verdict } from '../../domain/pinyin/contour';

export interface StaffSyllable {
  tone: number;
  halfThird: boolean;
  /** seconds, when an attempt placed it; otherwise laid out evenly */
  from?: number;
  to?: number;
  verdict?: Verdict;
}

interface Props {
  syllables: StaffSyllable[];
  /** the learner's voice, Chao scale per frame (NaN where unvoiced) */
  line?: Array<{ t: number; chao: number }>;
  /** bumps to replay the drawing animation */
  take?: number;
}

const W = 640;
const H = 210;
const LEFT = 30;
const RIGHT = 10;
const TOP = 14;
const BOTTOM = 26;
const PLOT_W = W - LEFT - RIGHT;
const PLOT_H = H - TOP - BOTTOM;

const y = (chao: number) => TOP + ((5 - chao) / 4) * PLOT_H;

/**
 * The voice on five lines.
 *
 * Chao's scale drawn as a staff: 5 at the top of the speaker's voice, 1 at
 * the bottom. Each expected syllable is a dashed reference in grey — the
 * shape the tone should have — and the learner's own pitch is laid over it
 * as one line in the pronunciation colour. The comparison is the lesson: a
 * third tone that never got down to the bottom line is visible at a glance
 * in a way no score would make it.
 *
 * Before an attempt the references are spread evenly; after one, each sits
 * over the stretch of voice it was matched to, so the two lines are compared
 * where they actually overlap.
 */
export function PitchStaff({ syllables, line, take = 0 }: Props) {
  const voiced = line?.filter((p) => Number.isFinite(p.chao)) ?? [];
  const timed = voiced.length > 0 && syllables.every((s) => s.from !== undefined && s.to !== undefined);

  let x: (t: number) => number;
  let spans: Array<[number, number]>;
  if (timed) {
    const t0 = Math.min(voiced[0]!.t, syllables[0]!.from!) - 0.06;
    const t1 = Math.max(voiced[voiced.length - 1]!.t, syllables[syllables.length - 1]!.to!) + 0.06;
    x = (t) => LEFT + ((t - t0) / (t1 - t0)) * PLOT_W;
    spans = syllables.map((s) => [x(s.from!), x(s.to!)]);
  } else {
    const n = syllables.length;
    const gap = n > 1 ? 36 : 0;
    const w = Math.min(220, (PLOT_W - gap * (n - 1) - 40) / n);
    const start = LEFT + (PLOT_W - (w * n + gap * (n - 1))) / 2;
    x = () => 0;
    spans = syllables.map((_, i) => [start + i * (w + gap), start + i * (w + gap) + w]);
  }

  const voicePaths = timed && line ? pathsOf(line, x) : [];

  return (
    <svg className="staff" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(syllables)}>
      {[1, 2, 3, 4, 5].map((c) => (
        <g key={c}>
          <line className="staff-line" x1={LEFT} x2={W - RIGHT} y1={y(c)} y2={y(c)} />
          <text className="staff-num" x={LEFT - 12} y={y(c) + 4}>
            {c}
          </text>
        </g>
      ))}

      {syllables.map((s, i) => {
        const [a, b] = spans[i]!;
        const t = templateFor(s.tone, s.halfThird);
        return (
          <g key={i}>
            {s.verdict && s.verdict !== 'unheard' && (
              <rect className="staff-band" data-state={s.verdict} x={a} y={H - BOTTOM + 9} width={Math.max(4, b - a)} height={4} rx={2} />
            )}
            {t ? (
              <polyline
                className="staff-ref"
                points={t.map((c, k) => `${a + (k / (t.length - 1)) * (b - a)},${y(c)}`).join(' ')}
              />
            ) : (
              // A neutral tone has no shape of its own: a short, light dot where it falls.
              <circle className="staff-ref-dot" cx={(a + b) / 2} cy={y(neutralHeight(syllables[i - 1]?.tone))} r={4} />
            )}
          </g>
        );
      })}

      {voicePaths.map((d, i) => (
        <path key={`${take}-${i}`} className="staff-voice" d={d} pathLength={1} />
      ))}
    </svg>
  );
}

/** Where a neutral tone sits, after each tone: low after 1 and 4, mid after 2, high after 3. */
const neutralHeight = (prev?: number) => (prev === 3 ? 4 : prev === 2 ? 3 : prev === 1 ? 2 : 1.5);

/** One path per unbroken run of voice. */
function pathsOf(line: Array<{ t: number; chao: number }>, x: (t: number) => number): string[] {
  const out: string[] = [];
  let d = '';
  for (const p of line) {
    if (!Number.isFinite(p.chao)) {
      if (d.includes('L')) out.push(d);
      d = '';
      continue;
    }
    const px = x(p.t).toFixed(1);
    const py = y(p.chao).toFixed(1);
    d += d ? ` L${px},${py}` : `M${px},${py}`;
  }
  if (d.includes('L')) out.push(d);
  return out;
}

function describe(syllables: StaffSyllable[]) {
  return `Pitch staff: ${syllables
    .map((s) => (s.tone === 5 ? 'neutral' : `tone ${s.tone}`) + (s.verdict ? ` (${s.verdict})` : ''))
    .join(', ')}`;
}
