import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { loadFamilies } from '../../data/families';
import type { RadicalEntry } from '../../data/radicals';
import type { Library, StrokeMap } from '../../data/types';
import {
  countIn,
  familyOf,
  shortGloss,
  type CharFacts,
  type FamilyData,
  type FamilyNode,
  type FamilyRole,
} from '../../domain/families';
import { charId } from '../../domain/ids';
import { POSITION_PHRASE } from '../../domain/radicals/forms';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { Seg } from '../../ui/Seg';
import { Splash } from '../../ui/Splash';
import { useTitle } from '../../ui/useTitle';
import { RadicalGate, useRadicalLibrary } from '../library/radicalData';
import { useLibrary } from '../shared/library';
import './families.css';

const BANDS = ['1', '2', '3', 'all'] as const;
type Band = (typeof BANDS)[number];
const BAND_OPTIONS = [
  { id: '1', label: 'HSK 1' },
  { id: '2', label: '1–2' },
  { id: '3', label: '1–3' },
  { id: 'all', label: 'All' },
] as const;
const bandNumber = (b: Band) => (b === 'all' ? 7 : Number(b));

const SECTION_TITLE: Record<FamilyRole, string> = {
  meaning: 'Gives the meaning',
  sound: 'Gives the sound',
  shape: 'Only the shape',
};

/**
 * How a radical grows into characters, drawn as a tree.
 *
 *   /families/:n?band=2
 *
 * The radical at the top; below it, in three branches, every character with
 * it inside — the ones it gives a meaning to (氵: 洗 游 汉, all wet), the ones
 * it gives a sound to (马: 妈 吗, nothing to do with horses), and the ones
 * where it is only a shape. A character built on another character hangs off
 * that one, so 口 → 吾 → 语 reads as the path it is. In every tile the part
 * its parent gave it is drawn in full ink (or red, when what it gave was the
 * sound) and the rest of the character faint, so you can see where it went.
 *
 * Like the radical drawer, it is a reference: nothing here is scheduled. The
 * characters are, and a tap opens the character drawer.
 */
export function FamiliesPage() {
  return (
    <RadicalGate>
      <Families />
    </RadicalGate>
  );
}

function Families() {
  const lib = useLibrary();
  const rlib = useRadicalLibrary();
  const navigate = useNavigate();
  const { radical } = useParams();
  const [query, setQuery] = useQuery();
  const band = oneOf(query.get('band'), BANDS, '2');
  const [data, setData] = useState<FamilyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadFamilies()
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, []);

  const facts = useFacts(lib);

  // Radicals with nothing in the band are left off the strip; they would open
  // on an empty tree.
  const strip = useMemo(() => {
    if (!data) return [];
    const b = bandNumber(band);
    return rlib.radicals.filter((r) => {
      const edges = data.trees[String(r.n)];
      return edges?.some((e) => (facts(e[0])?.hsk ?? 99) <= b);
    });
  }, [data, rlib, band, facts]);

  const n = Number(radical);
  const r = (Number.isInteger(n) && rlib.byNumber.get(n)) || null;

  // No radical in the address: the most useful one with a family in the band.
  useEffect(() => {
    if (!r && strip.length) {
      navigate(`${paths.family(strip[0].n)}${band === '2' ? '' : `?band=${band}`}`, { replace: true });
    }
  }, [r, strip, navigate, band]);

  useTitle(r ? `${r.r} — radical family` : 'Radical families');

  if (error) {
    return (
      <Splash mark="误">
        <p>Could not load the radical families.</p>
        <p className="small">{error}</p>
        <p className="small">
          Run <code>python scripts/build_families.py</code> to build <code>public/data/families.json</code>.
        </p>
      </Splash>
    );
  }

  return (
    <div className="fam-page">
      <div className="row fam-head">
        <div>
          <h1>Radical families</h1>
          <div className="small muted">How one part grows into the characters you read</div>
        </div>
        <div className="spacer" />
        <Seg
          size="sm"
          label="Characters up to"
          value={band}
          options={BAND_OPTIONS}
          onChange={(v) => setQuery('band', v, '2')}
        />
      </div>

      <RadicalStrip radicals={strip} current={r?.n ?? null} band={band} />

      {!data || !r ? (
        <div className="fam-skeleton" aria-hidden />
      ) : (
        <FamilyTree key={`${r.n}-${band}`} r={r} data={data} band={bandNumber(band)} facts={facts} />
      )}
    </div>
  );
}

/** What the tree needs from the character data, looked up once per library. */
function useFacts(lib: Library) {
  return useMemo(() => {
    const cache = new Map<string, CharFacts | null>();
    return (g: string): CharFacts | null => {
      let f = cache.get(g);
      if (f !== undefined) return f;
      const c = lib.byChar.get(g);
      // The sense the syllabus means when the character is a word on its own
      // (呢 is the question particle, not "wool"), the dictionary's first otherwise.
      const w = lib.byWord.get(g);
      f = c
        ? { hsk: c.hsk, py: w?.py ?? c.py[0] ?? '', gloss: shortGloss(w?.d ?? c.def), freq: c.freq }
        : null;
      cache.set(g, f);
      return f;
    };
  }, [lib]);
}

/** One line of radicals, scrolled so the chosen one is in view. */
function RadicalStrip({ radicals, current, band }: { radicals: RadicalEntry[]; current: number | null; band: Band }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [current, radicals.length]);
  const suffix = band === '2' ? '' : `?band=${band}`;
  return (
    <div className="fam-strip" ref={ref} role="navigation" aria-label="Radicals">
      {radicals.map((r) => (
        <Link
          key={r.n}
          to={`${paths.family(r.n)}${suffix}`}
          replace
          className="fam-pick"
          aria-current={r.n === current}
          title={`${r.r} — ${r.mean}`}
        >
          {r.r}
        </Link>
      ))}
    </div>
  );
}

function FamilyTree({
  r,
  data,
  band,
  facts,
}: {
  r: RadicalEntry;
  data: FamilyData;
  band: number;
  facts: (g: string) => CharFacts | null;
}) {
  const lib = useLibrary();
  const rlib = useRadicalLibrary();
  const learned = useStore((s) => s.learned);
  const recall = useStore((s) => s.recall);

  const forms = useMemo(() => [...new Set([...r.forms.map((f) => f.g), r.kangxi])], [r]);
  const family = useMemo(
    () => familyOf(data.trees[String(r.n)] ?? [], forms, facts, data.parts, band),
    [data, r, forms, facts, band],
  );

  const stateOf = (g: string): NodeState => {
    const id = charId(g);
    if (learned.has(id)) return 'known';
    if (recall[id]) return 'learning';
    return 'new';
  };

  const alone = lib.byChar.get(r.word) ?? null;
  const soundCount = family.sections.find((s) => s.role === 'sound')?.count ?? 0;
  const meaningCount = family.sections.find((s) => s.role === 'meaning')?.count ?? 0;
  const showForms = family.forms.length > 1;
  const formOf = (g: string) => r.forms.find((f) => f.g === g) ?? null;

  return (
    <>
      <section className="fam-root card">
        <div className="fam-root-glyph">
          <Glyph char={r.forms[0].k} strokes={rlib.strokes} size={84} fit fallback={r.r} />
        </div>
        <div className="fam-root-text">
          <div className="row" style={{ gap: 8 }}>
            <span className="fam-py">{r.py}</span>
            {r.word !== r.r && <span className="hanzi fam-word">{r.word}</span>}
            <span className="tiny muted">radical {r.n}</span>
          </div>
          <h2>{r.mean}</h2>
          {r.about && <div className="small muted">{r.about}</div>}
          <div className="fam-counts small">
            {family.count === 0
              ? 'Nothing in these bands is built with it.'
              : `${family.count} character${family.count === 1 ? '' : 's'}` +
                (meaningCount ? ` · takes its meaning in ${meaningCount}` : '') +
                (soundCount ? ` · its sound in ${soundCount}` : '')}
          </div>
          <div className="fam-root-links tiny">
            {alone && <AloneLink g={r.word} />}
            <Link to={paths.radical(r.n)}>Its forms and names</Link>
          </div>
        </div>
      </section>

      <Legend />

      {family.sections.map((s) => (
        <section key={s.role} className="fam-section" data-role={s.role}>
          <header>
            <h3>
              {SECTION_TITLE[s.role]} <span className="count">{s.count}</span>
            </h3>
            <p className="tiny muted">{sectionBlurb(s.role, r)}</p>
          </header>
          <div className="fam-scroll">
            {s.branches.map((b) => {
              const f = formOf(b.form);
              return (
                <div key={b.form} className="fam-branch">
                  {showForms && (
                    <div className="fam-form">
                      <span className="hanzi">{b.form}</span>
                      <span className="tiny muted">{f ? POSITION_PHRASE[f.pos] : 'written in full'}</span>
                      <span className="tiny muted count">{countIn(b.nodes)}</span>
                    </div>
                  )}
                  <Kids nodes={b.nodes} parent={b.form} top stateOf={stateOf} lib={lib} strokes={lib.strokes} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

function AloneLink({ g }: { g: string }) {
  const open = useOpenItem();
  return (
    <button type="button" className="fam-linkish" onClick={() => open(charId(g))}>
      <span className="hanzi">{g}</span> on its own
    </button>
  );
}

function sectionBlurb(role: FamilyRole, r: RadicalEntry): string {
  if (role === 'meaning') return `What these are about: ${r.mean.toLowerCase()}. The rest of the character usually gives the sound.`;
  if (role === 'sound') return `Read like ${r.word} (${r.py}) or close to it — the other part says what they mean.`;
  return 'It is in the drawing, but says nothing about the meaning or the sound.';
}

type NodeState = 'known' | 'learning' | 'new';

function Kids({
  nodes,
  parent,
  top,
  stateOf,
  lib,
  strokes,
}: {
  nodes: FamilyNode[];
  parent: string;
  top?: boolean;
  stateOf: (g: string) => NodeState;
  lib: Library;
  strokes: StrokeMap;
}) {
  return (
    <ul className={`fam-kids${top ? ' top' : ''}`}>
      {nodes.map((n) => (
        <li key={n.g} data-role={n.role}>
          <div className="fam-row">
            <Node node={n} parent={parent} state={n.kind === 'char' ? stateOf(n.g) : 'new'} lib={lib} strokes={strokes} />
            {n.children.length > 0 && (
              <Kids nodes={n.children} parent={n.g} stateOf={stateOf} lib={lib} strokes={strokes} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Node({
  node,
  parent,
  state,
  lib,
  strokes,
}: {
  node: FamilyNode;
  parent: string;
  state: NodeState;
  lib: Library;
  strokes: StrokeMap;
}) {
  const open = useOpenItem();
  const body = (
    <>
      <PartGlyph g={node.g} parent={parent} role={node.role} lib={lib} strokes={strokes} />
      <span className="fam-t">
        <b>{node.py || ' '}</b>
        <i>{node.above && node.hsk ? `HSK ${node.hsk === 7 ? '7–9' : node.hsk} · ` : ''}{node.gloss || 'a part'}</i>
      </span>
      {node.kind === 'char' && state !== 'new' && <span className="fam-dot" data-state={state} aria-hidden />}
    </>
  );
  if (node.kind === 'part') {
    return (
      <span className="fam-node" data-kind="part" title={`${node.g} — a part, not a character on the syllabus`}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="fam-node"
      data-kind="char"
      data-state={state}
      data-above={node.above || undefined}
      onClick={() => open(charId(node.g))}
      aria-label={`${node.g} ${node.py} ${node.gloss}`}
    >
      {body}
    </button>
  );
}

/**
 * The character with the part its parent gave it drawn solid and the rest
 * faint: 妈 with 马 in red, 女 barely there.
 *
 * The stroke data says which top-level component each stroke belongs to, and
 * the character's parts say which component the parent is. When either is
 * missing (a part that is not a syllabus character, a character whose outlines
 * have not arrived yet) it is the plain character in the font.
 */
function PartGlyph({
  g,
  parent,
  role,
  lib,
  strokes,
}: {
  g: string;
  parent: string;
  role: FamilyRole;
  lib: Library;
  strokes: StrokeMap;
}) {
  const d = strokes[g];
  const parts = lib.byChar.get(g)?.parts ?? [];
  const at = parts.findIndex((p) => p === parent || p.includes(parent));
  if (!d || !d.g || at < 0) {
    return <span className="fam-g hanzi">{g}</span>;
  }
  const strong = role === 'sound' ? 'var(--accent)' : 'currentColor';
  return (
    <svg className="fam-g" viewBox="0 0 1024 1024" width={32} height={32} aria-hidden>
      <g transform="translate(0, 900) scale(1, -1)">
        {d.s.map((p, i) => (
          <path key={i} d={p} fill={d.g![i] === at ? strong : 'var(--fam-faint)'} />
        ))}
      </g>
    </svg>
  );
}

function Legend() {
  return (
    <div className="fam-legend tiny muted" aria-label="How to read the tree">
      <span>
        <i className="ln" data-role="meaning" /> gives the meaning
      </span>
      <span>
        <i className="ln" data-role="sound" /> gives the sound
      </span>
      <span>
        <i className="ln" data-role="shape" /> only the shape
      </span>
      <span>
        <i className="fam-dot" data-state="known" /> learned
      </span>
      <span>
        <i className="fam-dot" data-state="learning" /> learning
      </span>
    </div>
  );
}
