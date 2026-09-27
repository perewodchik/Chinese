import { useEffect, useRef } from 'react';
import { endingsOf, reachable, type Story } from '../../domain/story';
import { reachEnding } from '../../store/commands';

/**
 * The part of a story with choices that is not prose: the choices at the end
 * of the path so far, the ending when there is one, and a small map of the
 * whole story with the way taken filled in.
 *
 * The path lives in the page, not the store — a story read again starts at
 * the beginning — but every ending reached is kept (see `reachEnding`), and
 * reaching one counts as reading the passage.
 */
export function StoryChoices({
  textId,
  story,
  path,
  onChoose,
  onRestart,
  endings,
}: {
  textId: string;
  story: Story;
  path: string[];
  onChoose: (to: string) => void;
  onRestart: () => void;
  endings: string[];
}) {
  const here = story.nodes[path[path.length - 1]];
  const counted = useRef<string | null>(null);
  const last = path[path.length - 1];

  useEffect(() => {
    if (here?.end && counted.current !== path.join('>')) {
      counted.current = path.join('>');
      reachEnding(textId, last);
    }
  }, [here, last, path, textId]);

  const all = endingsOf(story);
  if (!here) return null;
  return (
    <section className="story-choices" aria-label={here.end ? 'The end' : 'What happens next'}>
      {here.end ? (
        <div className="story-end">
          <p className="story-end-title">
            <span className="hanzi">完</span> — {here.end}
          </p>
          <p className="tiny muted">
            {endings.length} of {all.length} ending{all.length === 1 ? '' : 's'} found
          </p>
          <button type="button" className="btn" onClick={onRestart}>
            Read it another way
          </button>
        </div>
      ) : (
        <>
          <p className="tiny muted story-ask">What do you do?</p>
          <div className="story-options">
            {here.choices.map((c) => (
              <button key={c.to + c.zh} type="button" className="story-option" onClick={() => onChoose(c.to)}>
                <span className="hanzi">{c.zh}</span>
                {c.py && <span className="story-option-py">{c.py}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * The shape of the story: a dot per node, by how far into the story it is,
 * lines where a choice leads. The way taken is filled, where you are is red,
 * the endings found are ringed.
 */
export function StoryMap({ story, path, endings }: { story: Story; path: string[]; endings: string[] }) {
  const order = reachable(story);
  // depth: the shortest way in
  const depth: Record<string, number> = { [story.start]: 0 };
  for (const id of order) {
    for (const c of story.nodes[id].choices) if (depth[c.to] === undefined) depth[c.to] = depth[id] + 1;
  }
  const levels: string[][] = [];
  for (const id of order) (levels[depth[id]] ??= []).push(id);
  const W = 36 * Math.max(3, levels.length);
  const H = 18 * Math.max(...levels.map((l) => l.length), 1) + 8;
  const pos: Record<string, { x: number; y: number }> = {};
  levels.forEach((ids, d) =>
    ids.forEach((id, k) => {
      pos[id] = { x: 10 + d * 36, y: H / 2 + (k - (ids.length - 1) / 2) * 18 };
    }),
  );
  const taken = new Set(path.slice(1).map((to, k) => `${path[k]}>${to}`));
  return (
    <svg className="story-map" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="The story's paths">
      {order.flatMap((id) =>
        story.nodes[id].choices.map((c) => (
          <line
            key={`${id}>${c.to}`}
            x1={pos[id].x}
            y1={pos[id].y}
            x2={pos[c.to].x}
            y2={pos[c.to].y}
            data-taken={taken.has(`${id}>${c.to}`) || undefined}
          />
        )),
      )}
      {order.map((id) => (
        <circle
          key={id}
          cx={pos[id].x}
          cy={pos[id].y}
          r={5}
          data-visited={path.includes(id) || undefined}
          data-here={path[path.length - 1] === id || undefined}
          data-end={story.nodes[id].end ? true : undefined}
          data-found={endings.includes(id) || undefined}
        />
      ))}
    </svg>
  );
}
