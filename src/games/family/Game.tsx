import { useState } from 'react';
import { ChoiceGame } from '../kit/ChoiceGame';
import type { GameProps } from '../types';
import { buildFamily, itemsOf, peopleAt, type Person } from './content';
import './game.css';

/** A family drawn around 我; one of them is ringed — who is it? */
export default function FamilyGame({ ctx, report, finish }: GameProps) {
  const [people] = useState(() => peopleAt(ctx));
  const [named, setNamed] = useState<Set<string>>(new Set(['我']));
  const [rounds] = useState(() =>
    buildFamily(ctx).map((r) => ({
      ...r,
      options: r.options.map((o) => ({
        ...o,
        body: (
          <>
            <span className="hanzi">{o.id}</span>
            <span className="g-sub">{people.find((p) => p.w === o.id)?.py}</span>
          </>
        ),
      })),
    })),
  );
  return (
    <ChoiceGame
      rounds={rounds}
      props={{
        report: (r) => {
          setNamed((s) => new Set(s).add(r.answer));
          report(r);
        },
        finish,
      }}
      describe={(r) => ({ prompt: r.person.en, answer: r.person.w, items: itemsOf(r) })}
      say={(r) => r.person.w}
      stage={(r) => (
        <div className="g-family">
          <p className="g-prompt small muted">这是谁？ Who is this?</p>
          <Tree people={people} ask={r.person.w} named={named} />
        </div>
      )}
    />
  );
}

const W = 400;
const ROW_Y = [80, 180, 290];

function Tree({ people, ask, named }: { people: Person[]; ask: string; named: Set<string> }) {
  const has = (w: string) => people.some((p) => p.w === w);
  const top = has('爷爷') ? 0 : 1;
  const rows = ROW_Y.slice(top);
  const y = (p: Person) => rows[p.row - top];
  const height = rows[rows.length - 1] + 40;
  const at = (w: string) => people.find((p) => p.w === w)!;
  const line = (a: Person, b: Person) => (
    <path d={`M${a.x * W} ${y(a) + 8} V${(y(a) + y(b)) / 2 - 6} H${b.x * W} V${y(b) - 62}`} />
  );
  return (
    <svg className="g-tree" viewBox={`0 ${top ? 90 : 0} ${W} ${height - (top ? 90 : 0)}`} role="img" aria-label="a family">
      <g className="g-tree-lines">
        {top === 0 && line(at('爷爷'), at('爸爸'))}
        {people.filter((p) => p.row === 2).map((p) => (
          <path key={p.w} d={`M${W / 2} ${y(at('爸爸')) + 8} V${(y(at('爸爸')) + y(p)) / 2 - 6} H${p.x * W} V${y(p) - 62 * p.tall}`} />
        ))}
        {top === 0 && <path d={`M${0.36 * W} ${y(at('爷爷')) - 20} H${0.64 * W}`} />}
        <path d={`M${0.36 * W} ${y(at('爸爸')) - 20} H${0.64 * W}`} />
      </g>
      {people.map((p) => (
        <Figure key={p.w} p={p} y={y(p)} ask={p.w === ask} named={named.has(p.w)} />
      ))}
    </svg>
  );
}

function Figure({ p, y, ask, named }: { p: Person; y: number; ask: boolean; named: boolean }) {
  const s = p.tall;
  const x = p.x * W;
  const head = 11 * (0.7 + 0.3 * s);
  const bodyH = 44 * s;
  const top = y - bodyH - head * 2;
  return (
    <g className="g-person" data-ask={ask || undefined} data-me={p.w === '我' || undefined} data-old={p.old || undefined}>
      {ask && <circle cx={x} cy={y - bodyH / 2 - head} r={40 * (0.7 + 0.3 * s)} className="g-person-ring" />}
      {/* body: a dress for the women, a coat for the men */}
      {p.sex === 'f' ? (
        <path className="g-person-body" d={`M${x - 6} ${top + head * 2} L${x - 16 * s} ${y} H${x + 16 * s} L${x + 6} ${top + head * 2} Z`} />
      ) : (
        <rect className="g-person-body" x={x - 11 * s} y={top + head * 2} width={22 * s} height={bodyH} rx={6} />
      )}
      <circle className="g-person-head" cx={x} cy={top + head} r={head} />
      {p.sex === 'f' ? (
        <path className="g-person-hair" d={`M${x - head} ${top + head} a${head} ${head} 0 0 1 ${head * 2} 0 v${head * 1.2} h-3 v-${head} a${head - 3} ${head - 4} 0 0 0 -${head * 2 - 6} 0 v${head} h-3 z`} />
      ) : (
        <path className="g-person-hair" d={`M${x - head} ${top + head - 1} a${head} ${head} 0 0 1 ${head * 2} 0 z`} />
      )}
      <text x={x} y={y + 22} textAnchor="middle" className="g-person-name">
        {named ? p.w : ask ? '？' : ''}
      </text>
    </g>
  );
}
