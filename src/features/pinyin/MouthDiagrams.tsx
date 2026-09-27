import { useEffect, useState } from 'react';

/**
 * Side views of the mouth for the sounds a learner cannot see: where the
 * tongue is for x, for sh, for s; for -n and -ng; for i and u, which between
 * them make ü.
 *
 * The drawings are real phonetics diagrams from Wikimedia Commons (see
 * scripts/mouth/build.py), not drawings of what the tongue might do. Within a
 * lesson they come from one series, in which only the tongue moves — so the
 * tongue is drawn in the colour of pronunciation and every other line faint,
 * and the difference is the one thing left to look at.
 *
 * The data (64 KB) arrives when a lesson with diagrams is opened; the boxes
 * have their size before it does, so the notes below never move.
 */

interface Diagram {
  view: string;
  faces: 'left' | 'right';
  paths: Array<{ d: string; tongue?: boolean }>;
  credit: { by: string; license: string; source: string };
}

type Key = 'x' | 'sh' | 's' | 'n' | 'ng' | 'i' | 'u';

interface Panel {
  key: Key;
  sound: string;
  says: string;
}

const LESSONS: Record<string, { panels: Panel[]; note?: string }> = {
  jqx: {
    panels: [
      { key: 'x', sound: 'j q x', says: 'tip down behind the lower teeth, the middle of the tongue up' },
      { key: 'sh', sound: 'zh ch sh', says: 'tip curled up behind the ridge' },
      { key: 's', sound: 'z c s', says: 'tip at the back of the top teeth' },
    ],
  },
  zh: {
    panels: [
      { key: 'sh', sound: 'zh ch sh r', says: 'tip curled up, behind the ridge' },
      { key: 'x', sound: 'j q x', says: 'tip down, the middle of the tongue up' },
    ],
    note: 'r is the sh tongue with the voice on.',
  },
  zcs: {
    panels: [
      { key: 's', sound: 'z c s', says: 'tip flat at the back of the top teeth' },
      { key: 'sh', sound: 'zh ch sh', says: 'tip curled back' },
    ],
  },
  nasal: {
    panels: [
      { key: 'n', sound: '-n', says: 'the tip closes on the ridge behind the top teeth' },
      { key: 'ng', sound: '-ng', says: 'the back of the tongue closes on the soft palate, tip down' },
    ],
  },
  u: {
    panels: [
      { key: 'i', sound: 'i', says: 'tongue high and forward' },
      { key: 'u', sound: 'u', says: 'tongue high and back, lips round' },
    ],
    note: 'ü is the tongue of i with the lips of u.',
  },
};

let loading: Promise<Record<Key, Diagram>> | null = null;
const load = () =>
  (loading ??= import('../../data/mouth.json').then((m) => m.default as unknown as Record<Key, Diagram>));

export function MouthDiagrams({ lesson }: { lesson: string }) {
  const spec = LESSONS[lesson];
  const [data, setData] = useState<Record<Key, Diagram> | null>(null);
  useEffect(() => {
    if (!spec) return;
    let live = true;
    load()
      .then((d) => live && setData(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [spec]);
  if (!spec) return null;
  const credits = data
    ? [...new Map(spec.panels.map((p) => [`${data[p.key].credit.by}|${data[p.key].credit.license}`, data[p.key].credit])).values()]
    : [];
  return (
    <figure className="mouth">
      <div className="mouth-row" data-n={spec.panels.length}>
        {spec.panels.map((p) => (
          <div key={p.key} className="mouth-panel">
            <svg
              className="mouth-svg"
              viewBox={data?.[p.key].view ?? '0 0 1 1'}
              role="img"
              aria-label={`The mouth from the side for ${p.sound}: ${p.says}`}
            >
              {data?.[p.key].paths.map((path, i) => (
                <path key={i} d={path.d} className={path.tongue ? 'mouth-tongue' : 'mouth-line'} vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
            <span className="mouth-sound">{p.sound}</span>
            <span className="mouth-says tiny">{p.says}</span>
          </div>
        ))}
      </div>
      {spec.note && <p className="small mouth-note">{spec.note}</p>}
      <figcaption className="tiny muted mouth-credit">
        {credits.length
          ? credits.map((c, i) => (
              <span key={c.source}>
                {i ? ' · ' : 'Diagrams: '}
                {c.by},{' '}
                <a href={c.source} target="_blank" rel="noreferrer">
                  {c.license}
                </a>
              </span>
            ))
          : ' '}
      </figcaption>
    </figure>
  );
}
