import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../features/shared/library';
import { libraryLexicon } from '../core/dialogue/lexicon';
import { dayOf } from '../core/clock';
import { directions } from '../core/journal';
import { bestTeacher, buildRound, canPractise, isRight, PERFECT_FLAG, PRACTISE_MIN, QUESTION_KINDS, type Question } from '../core/practise';
import type { SaveAction } from '../core/save';
import type { InputMode, Spirit, WorldSave } from '../core/types';
import { ALBUM_MAX, loadAlbum, postcardPng, saveAlbum, saveFile, type Photo } from './album';
import type { WorldContent } from './content';
import { InputBar } from './InputBar';
import { Destination, FareNote, RouteStrip, useMapIndex, type RouteRequest } from './Journal';
import { playLine } from './lineVoice';
import { IDIOM_FILTERS, idiomFilter, idiomRows, passportPages, spiritHint, spiritPlace, spiritRows, type IdiomFilter, type IdiomRow, type PassportStamp } from './panelRows';
import { useEscape } from './useEscape';
import { ZhText } from './ZhText';
import './menu.css';
import { FitSprite } from './PropSprite';
import { SPIRIT_FRAMES, woodcutOf } from '../engine/spiritFrames';

/** A found spirit's picture: its woodcut (§13 V4), the lantern's painted look. */
const SPIRIT_ART: Record<string, string> = Object.fromEntries(Object.keys(SPIRIT_FRAMES).map((id) => [id, woodcutOf(id)]));

/**
 * The 📖 收藏 tab (§10 P3): 图鉴 as a grid of spirits (the missing ones as
 * silhouettes with a hint of where), the 成语 book as compact cards with a
 * Practise round, the passport with a page per neighbourhood (a missing
 * stamp says where to go), and the album. Every card opens a drawer that
 * slides over the list; the list itself never moves.
 */

export function CollectionEmpty({ han, children }: { han: string; children: React.ReactNode }) {
  return (
    <div className="empty wp-empty">
      <div className="big han">{han}</div>
      <p className="small muted">{children}</p>
    </div>
  );
}

/** A drawer over the list, the same sheet the bag and the journal use. */
function Sheet({ label, onClose, head, children }: { label: string; onClose: () => void; head: React.ReactNode; children: React.ReactNode }) {
  useEscape(onClose);
  return (
    <div className="w-sheet-scrim" onClick={onClose}>
      <section className="w-sheet jn-sheet" role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <header className="w-sheet-head">
          {head}
          <span className="spacer" />
          <button type="button" className="wd-tool" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 图鉴
// ---------------------------------------------------------------------------

export function Spirits({ save, content, pinyin }: { save: WorldSave; content: WorldContent; pinyin: boolean }) {
  const rows = spiritRows(save, content.spirits);
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return <CollectionEmpty han="灵">The spirits of the broken lantern are still out there.</CollectionEmpty>;
  const found = rows.filter((r) => r.found).length;
  const cur = rows.find((r) => r.spirit.id === open);
  return (
    <>
      <p className="cl-count small muted">
        <b>{found}</b> / {rows.length} found
      </p>
      <ul className="cl-spirits">
        {rows.map(({ spirit: x, found }) => (
          <li key={x.id}>
            <button type="button" className="cl-spirit" data-missing={found ? undefined : ''} onClick={() => setOpen(x.id)} aria-label={found ? `${x.hanzi}, ${x.en}` : 'Not found yet'}>
              <span className="cl-spirit-art han" aria-hidden data-art={found && SPIRIT_ART[x.id] ? '' : undefined}>
                {found && SPIRIT_ART[x.id] ? <FitSprite frame={SPIRIT_ART[x.id]!} box={64} atlas="woodcut" /> : found ? [...x.hanzi][0] : '?'}
              </span>
              {found ? (
                <>
                  <b className="han cl-spirit-name">{x.hanzi}</b>
                  <span className="tiny muted cl-one">{x.en}</span>
                </>
              ) : (
                <span className="tiny muted cl-hint">
                  stirs near
                  <br />
                  <b className="han">{spiritPlace(x)}</b>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {cur && <SpiritSheet spirit={cur.spirit} found={cur.found} pinyin={pinyin} onClose={() => setOpen(null)} />}
    </>
  );
}

function SpiritSheet({ spirit: x, found, pinyin, onClose }: { spirit: Spirit; found: boolean; pinyin: boolean; onClose: () => void }) {
  if (!found)
    return (
      <Sheet label="A spirit not found yet" onClose={onClose} head={<b className="han w-sheet-han cl-faint">?</b>}>
        <p className="small">{spiritHint(x)}</p>
        <p className="small muted">People talk about strange things — listen, and ask what they mean.</p>
      </Sheet>
    );
  return (
    <Sheet
      label={x.en}
      onClose={onClose}
      head={
        <>
          <FitSprite frame={woodcutOf(x.id)} box={48} atlas="woodcut" />
          <b className="han w-sheet-han">{x.hanzi}</b>
          <span>
            <span className="small">{x.pinyin}</span>
            <br />
            <span className="small muted">
              {x.en} · {x.source === 'folk' ? 'a folk tale' : <span className="han">{x.source}</span>}
            </span>
          </span>
        </>
      }
    >
      <ZhText zh={x.legend.zh} pinyin={pinyin} className="wd-zh wp-zh" />
      <p className="small muted">{x.legend.en}</p>
      <h3 className="wp-label">How you became friends</h3>
      <p className="han cl-zh">{x.befriend.text}</p>
      <p className="small muted">{x.befriend.en}</p>
      {x.credit && <p className="tiny muted">{x.credit}</p>}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// 成语
// ---------------------------------------------------------------------------

export function Idioms({ save, content, pinyin, onAct }: { save: WorldSave; content: WorldContent; pinyin: boolean; onAct?: (a: SaveAction) => void }) {
  const rows = useMemo(() => idiomRows(save, content.idioms), [save, content]);
  const [filter, setFilter] = useState<IdiomFilter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [practising, setPractising] = useState(false);
  const npcName = (id?: string) => content.npcs.find((n) => n.id === id)?.name;
  if (practising) return <Practise save={save} content={content} onAct={onAct} onDone={() => setPractising(false)} />;
  if (!rows.length) return <CollectionEmpty han="成">No 成语 yet. When someone says one, it is written here.</CollectionEmpty>;
  const shown = idiomFilter(rows, filter);
  const ready = canPractise(save, content.idioms);
  const cur = rows.find((r) => r.idiom.id === open);
  return (
    <>
      <div className="cl-bar">
        <div className="w-filters cl-filters" role="tablist" aria-label="Show">
          {IDIOM_FILTERS.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} title={f.title} onClick={() => setFilter(f.id)}>
              <span className="han">{f.label}</span>
            </button>
          ))}
        </div>
        <span className="cl-count tiny muted" title="shown / heard so far">
          {shown.length} / {rows.length}
        </span>
        <span className="spacer" />
        <button
          type="button"
          className="btn sm primary cl-practise"
          disabled={!ready}
          title={ready ? 'A short round with the 成语 you have heard' : `Opens once you know ${PRACTISE_MIN} 成语`}
          onClick={() => setPractising(true)}
        >
          Practise
        </button>
      </div>
      {!ready && <p className="tiny muted">Practise opens once you have heard {PRACTISE_MIN}.</p>}
      {!save.flags.includes('idiom-book') && <p className="tiny muted">The book 《成语故事》 itself turns up in a bookshop later; until then they are kept here.</p>}
      {shown.length ? (
        <ul className="cl-idioms">
          {shown.map(({ idiom: x }) => (
            <li key={x.id}>
              <button type="button" className="cl-idiom" onClick={() => setOpen(x.id)}>
                <b className="han cl-idiom-zh">{x.id}</b>
                <span className="cl-idiom-text">
                  <span className="small cl-py">{x.pinyin}</span>
                  <span className="tiny muted cl-one">{x.meaning}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">None of this kind yet.</p>
      )}
      {cur && <IdiomSheet row={cur} pinyin={pinyin} from={npcName(cur.npc)} onClose={() => setOpen(null)} />}
    </>
  );
}

function hear(idiom: string, npc?: string) {
  void playLine({ speaker: npc ?? 'companion', zh: idiom, en: '', node: '' });
}

function IdiomSheet({ row: { idiom: x, npc }, pinyin, from, onClose }: { row: IdiomRow; pinyin: boolean; from?: string; onClose: () => void }) {
  return (
    <Sheet
      label={x.id}
      onClose={onClose}
      head={
        <>
          <b className="han w-sheet-han cl-sheet-idiom">{x.id}</b>
          <span className="cl-sheet-sub">
            <span className="small">{x.pinyin}</span>
            <br />
            <span className="small muted">
              {x.tier === 'story' ? 'a story' : 'heard in talk'}
              {x.line ? ` · the ${x.line} line` : ''}
            </span>
          </span>
          <button type="button" className="wd-tool" onClick={() => hear(x.id, npc)} aria-label="Hear it">
            🔊
          </button>
        </>
      }
    >
      <p>{x.meaning}</p>
      <p className="wp-parts">
        {x.parts.map((p, i) => (
          <span key={i}>
            <span className="han">{p.c}</span> <span className="tiny muted">{p.gloss}</span>
          </span>
        ))}
      </p>
      <h3 className="wp-label">The story</h3>
      <ZhText zh={x.story.zh} pinyin={pinyin} className="wd-zh wp-zh" />
      <p className="small muted">{x.story.en}</p>
      {from && (
        <p className="tiny muted">
          Heard from <span className="han">{from}</span>.
        </p>
      )}
    </Sheet>
  );
}

const canSpeak = () => {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  } catch {
    return false;
  }
};

const PROMPT: Record<Question['kind'], string> = {
  'pick-idiom': 'Which 成语 means this?',
  'pick-meaning': 'What does it mean?',
  gap: 'Which character is missing?',
  say: 'Say it or type it:',
  listen: 'Which one did you hear?',
};

/**
 * A Practise round (P3): up to eight questions from the 成语 heard, the weak
 * ones first. An answer is marked at once (jade / cinnabar) and a miss
 * shows the right one; nothing is timed and nothing is lost. The first
 * round with nothing missed brings a heart from whoever taught you most.
 */
function Practise({ save, content, onAct, onDone }: { save: WorldSave; content: WorldContent; onAct?: (a: SaveAction) => void; onDone: () => void }) {
  const lib = useLibrary();
  const lex = useMemo(() => libraryLexicon(lib), [lib]);
  const [round, setRound] = useState<Question[]>(() => buildRound(save, content.idioms, Math.random, { kinds: canSpeak() ? QUESTION_KINDS : QUESTION_KINDS.filter((k) => k !== 'listen') }));
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [missed, setMissed] = useState<Question[]>([]);
  const [input, setInput] = useState<InputMode>(save.settings.input);
  const [reward, setReward] = useState<string | null | undefined>(undefined);
  // the first-time reward is decided against the save as the round began
  const first = useRef(!save.flags.includes(PERFECT_FLAG));
  const teacher = useRef(bestTeacher(save));
  const q = round[at];

  useEffect(() => {
    if (q?.kind === 'listen') hear(q.idiom.id, save.idioms[q.idiom.id]?.npc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const answer = (a: string) => {
    if (!q || picked !== null) return;
    const ok = isRight(q, a, lex.syllables);
    setPicked(a);
    if (!ok) setMissed((m) => [...m, q]);
    onAct?.({ do: 'practised', idiom: q.idiom.id, right: ok });
  };
  const next = () => {
    setPicked(null);
    if (at + 1 < round.length) return setAt(at + 1);
    setAt(round.length);
    // the whole round right, the first time: a heart for the one who taught you most
    if (!missed.length && first.current) {
      first.current = false;
      onAct?.({ do: 'flag', flag: PERFECT_FLAG });
      if (teacher.current) onAct?.({ do: 'hearts', npc: teacher.current, delta: 1 });
      setReward(teacher.current ? (content.npcs.find((n) => n.id === teacher.current)?.name ?? null) : null);
    }
  };
  const again = () => {
    setRound(buildRound(save, content.idioms, Math.random, { kinds: canSpeak() ? QUESTION_KINDS : QUESTION_KINDS.filter((k) => k !== 'listen') }));
    setAt(0);
    setMissed([]);
    setReward(undefined);
  };

  // keys: 1–4 pick, Enter goes on
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, [contenteditable]')) return;
      if (picked !== null && e.key === 'Enter') {
        e.preventDefault();
        next();
      } else if (q && picked === null && q.options.length && /^[1-4]$/.test(e.key)) {
        e.stopPropagation();
        answer(q.options[Number(e.key) - 1]!);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  if (!round.length) return <CollectionEmpty han="练">Practise opens once you have heard {PRACTISE_MIN} 成语.</CollectionEmpty>;

  if (!q) {
    const right = round.length - missed.length;
    return (
      <div className="cl-practice">
        <div className="cl-bar">
          <b className="small">Practise</b>
          <span className="spacer" />
          <button type="button" className="wd-tool" onClick={onDone} aria-label="Back to the book">
            ×
          </button>
        </div>
        <div className="cl-q cl-end">
          <b className="cl-score">
            {right} / {round.length}
          </b>
          <p className="small muted">{missed.length ? 'These come first next time:' : 'Nothing missed.'}</p>
          {reward !== undefined && (
            <p className="small cl-reward">
              {reward ? (
                <>
                  <span className="han">{reward}</span> is pleased you remember what they taught you — a friend’s heart.
                </>
              ) : (
                <>兔儿爷 claps his paws. A whole round right.</>
              )}
            </p>
          )}
          {missed.length > 0 && (
            <ul className="mn-rows cl-missed">
              {missed.map((m) => (
                <li key={m.idiom.id}>
                  <b className="han">{m.idiom.id}</b>
                  <span className="small muted">{m.idiom.story.en.split(/(?<=\.)\s/)[0]}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="row cl-end-actions">
            <button type="button" className="btn sm primary" onClick={again}>
              Another round
            </button>
            <button type="button" className="btn sm ghost" onClick={onDone}>
              Back to the book
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ok = picked !== null && isRight(q, picked, lex.syllables);
  const chars = [...q.idiom.id];
  return (
    <div className="cl-practice">
      <div className="cl-bar">
        <b className="small">Practise</b>
        <span className="cl-steps" aria-label={`Question ${at + 1} of ${round.length}`}>
          {round.map((_, i) => (
            <i key={i} data-at={i === at ? '' : undefined} data-done={i < at ? '' : undefined} />
          ))}
        </span>
        <span className="spacer" />
        <button type="button" className="wd-tool" onClick={onDone} aria-label="Stop practising">
          ×
        </button>
      </div>
      <div className="cl-q" key={at}>
        <p className="tiny muted cl-prompt">{PROMPT[q.kind]}</p>
        <div className="cl-stage">
          {q.kind === 'pick-idiom' || q.kind === 'say' ? (
            <p className="cl-meaning">{q.idiom.meaning}</p>
          ) : q.kind === 'pick-meaning' ? (
            <b className="han cl-big">{q.idiom.id}</b>
          ) : q.kind === 'gap' ? (
            <b className="han cl-big">
              {chars.map((c, i) =>
                i === q.gap ? (
                  <span key={i} className="cl-gap" data-state={picked === null ? undefined : ok ? 'right' : 'wrong'}>
                    {picked === null ? '　' : q.answer}
                  </span>
                ) : (
                  <span key={i}>{c}</span>
                ),
              )}
            </b>
          ) : (
            <button type="button" className="btn cl-hear" onClick={() => hear(q.idiom.id, save.idioms[q.idiom.id]?.npc)}>
              🔊 Play again
            </button>
          )}
        </div>
        {q.kind === 'say' ? (
          picked === null ? (
            <div className="cl-say">
              <InputBar onSend={(t) => answer(t)} hintStep={0} saved={input} setSaved={setInput} />
              <button type="button" className="btn sm ghost" onClick={() => answer('')}>
                Show me
              </button>
            </div>
          ) : (
            <p className="cl-said" data-state={ok ? 'right' : 'wrong'}>
              {picked && <span className="han">{picked}</span>}
              {!ok && (
                <>
                  {picked ? ' → ' : ''}
                  <b className="han">{q.idiom.id}</b>
                </>
              )}
              <span className="small"> {q.idiom.pinyin}</span>
            </p>
          )
        ) : (
          <ol className={q.kind === 'pick-meaning' ? 'cl-opts cl-opts-wide' : 'cl-opts'}>
            {q.options.map((o, i) => (
              <li key={o}>
                <button
                  type="button"
                  className="cl-opt"
                  disabled={picked !== null}
                  data-state={picked === null ? undefined : o === q.answer ? 'right' : o === picked ? 'wrong' : undefined}
                  onClick={() => answer(o)}
                >
                  <kbd className="key-hint">{i + 1}</kbd>
                  <span className={q.kind === 'pick-meaning' ? 'small' : 'han'}>{o}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="cl-after">
          {picked !== null && (
            <>
              <p className="small">
                {ok ? 'Right. ' : ''}
                <b className="han">{q.idiom.id}</b> <span className="muted">{q.idiom.pinyin}</span> — {q.idiom.meaning}
              </p>
              <button type="button" className="btn sm primary" onClick={next} autoFocus>
                {at + 1 < round.length ? 'Next' : 'See how it went'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 印章
// ---------------------------------------------------------------------------

/**
 * The passport (P3): a cover with the total and the pages, then a page per
 * neighbourhood — ‹ › or a swipe. A missing stamp is a dashed outline with
 * the place it is got at; a tap shows the way there.
 */
export function Stamps({ save, content, onShowRoute }: { save: WorldSave; content: WorldContent; onShowRoute: (r: RouteRequest) => void }) {
  const pages = useMemo(() => passportPages(save, content.stamps), [save, content]);
  const [page, setPage] = useState(-1);
  const [open, setOpen] = useState<string | null>(null);
  const swipe = useRef<number | null>(null);
  if (!pages.length) return <CollectionEmpty han="印">Your Beijing passport. Stamps come for what you do — buying a ticket, asking the way.</CollectionEmpty>;
  const total = pages.reduce((n, p) => n + p.stamps.length, 0);
  const got = pages.reduce((n, p) => n + p.got, 0);
  const cur = pages[page];
  const turn = (d: number) => setPage((p) => Math.max(-1, Math.min(pages.length - 1, p + d)));
  const stamp = cur?.stamps.find((x) => x.stamp.id === open);
  return (
    <div
      className="cl-passport"
      onPointerDown={(e) => (swipe.current = e.clientX)}
      onPointerUp={(e) => {
        const from = swipe.current;
        swipe.current = null;
        if (from === null || open) return;
        const dx = e.clientX - from;
        if (Math.abs(dx) > 60) turn(dx < 0 ? 1 : -1);
      }}
    >
      <div className="cl-pager">
        <button type="button" className="wd-tool" disabled={page < 0} onClick={() => turn(-1)} aria-label="Previous page">
          ‹
        </button>
        <span className="cl-page-title">
          {cur ? (
            <>
              <b className="han">{cur.zh}</b> <span className="tiny muted">{cur.got} / {cur.stamps.length}</span>
            </>
          ) : (
            <>
              <b className="han">北京护照</b> <span className="tiny muted">passport</span>
            </>
          )}
        </span>
        <span className="tiny muted cl-page-no">{page + 2} / {pages.length + 1}</span>
        <button type="button" className="wd-tool" disabled={page >= pages.length - 1} onClick={() => turn(1)} aria-label="Next page">
          ›
        </button>
      </div>
      {cur ? (
        <ul className="wp-stamps cl-stamps">
          {cur.stamps.map((x) => (
            <li key={x.stamp.id}>
              <button
                type="button"
                className="wp-stamp cl-stamp"
                data-got={x.got ? '' : undefined}
                data-landmark={x.stamp.landmark ? '' : undefined}
                onClick={() => setOpen(x.stamp.id)}
                aria-label={x.got ? x.stamp.en : `Not yet: ${x.where}`}
              >
                <span className="wp-seal han" aria-hidden>
                  {x.got ? x.stamp.name : ''}
                </span>
                <span className="tiny cl-two">{x.got ? x.stamp.en : <span className="han">{x.place}</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="cl-cover">
          <p className="cl-cover-total">
            <b>{got}</b> <span className="muted">/ {total} stamps</span>
          </p>
          <ul className="mn-rows cl-pages">
            {pages.map((p, i) => (
              <li key={p.id}>
                <button type="button" className="jn-row" onClick={() => setPage(i)}>
                  <span className="jn-row-text">
                    <span className="jn-row-top">
                      <b className="han">{p.zh}</b>
                      <span className="tiny muted cl-one">{p.en}</span>
                    </span>
                  </span>
                  <span className="tiny muted">{p.got} / {p.stamps.length}</span>
                  <span aria-hidden>›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {stamp && <StampSheet save={save} x={stamp} onClose={() => setOpen(null)} onShowRoute={onShowRoute} />}
    </div>
  );
}

function StampSheet({ save, x, onClose, onShowRoute }: { save: WorldSave; x: PassportStamp; onClose: () => void; onShowRoute: (r: RouteRequest) => void }) {
  const index = useMapIndex();
  const to = x.stamp.place;
  const dir = !x.got && Object.keys(index).length ? directions(save, to, index) : null;
  const at = save.stamps[x.stamp.id];
  return (
    <Sheet
      label={x.got ? x.stamp.en : x.where}
      onClose={onClose}
      head={
        x.got ? (
          <span className="wp-stamp" data-got="" data-landmark={x.stamp.landmark ? '' : undefined}>
            <span className="wp-seal han" aria-hidden>
              {x.stamp.name}
            </span>
          </span>
        ) : (
          <span>
            <b className="han cl-sheet-title">{x.where}</b>
            <br />
            <span className="tiny muted">a stamp not got yet</span>
          </span>
        )
      }
    >
      {x.got ? (
        <>
          <p>{x.stamp.en}</p>
          <p className="small muted">
            <span className="han">{x.where}</span>
            {at !== undefined && <> · day {dayOf(at)}</>}
          </p>
        </>
      ) : (
        <>
          <p className="small">Something happens here that earns a stamp — go and see.</p>
          <Destination map={to} />
          {dir && (
            <>
              <RouteStrip dir={dir} />
              <FareNote dir={dir} />
            </>
          )}
          {dir?.kind === 'ride' && (
            <button type="button" className="btn sm cl-show" onClick={() => onShowRoute({ legs: dir.legs, to })}>
              Show on map
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// 相册
// ---------------------------------------------------------------------------

/** The album (X6, P3): photos taken on this device; a tap opens the photo full width, to write a postcard or to throw it away. */
export function Album({ user }: { user: string }) {
  const [list, setList] = useState<Photo[]>(() => loadAlbum(user));
  const [open, setOpen] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [note, setNote] = useState<string | null>(null);
  if (!list.length) return <CollectionEmpty han="照">No photos yet. Tap 📷 at the top to take one.</CollectionEmpty>;
  const cur = list.find((p) => p.id === open) ?? null;
  const pick = (p: Photo) => {
    setOpen(p.id);
    setCaption(p.caption ?? '');
    setNote(null);
  };
  const card = async () => {
    if (!cur) return;
    const text = caption.trim() || '北京，你好！';
    setList(saveAlbum(user, list.map((p) => (p.id === cur.id ? { ...p, caption: text } : p))));
    try {
      saveFile(await postcardPng(cur, text, cur.place), `postcard-${cur.id}.png`);
      setNote('Saved as a picture — send it or print it.');
    } catch {
      setNote('The postcard could not be made on this device.');
    }
  };
  const drop = () => {
    if (!cur) return;
    setList(saveAlbum(user, list.filter((p) => p.id !== cur.id)));
    setOpen(null);
  };
  return (
    <>
      <p className="cl-count small muted">
        <b>{list.length}</b> on this device · the newest {ALBUM_MAX} are kept
      </p>
      <ul className="w-album">
        {list.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => pick(p)} aria-label={`Photo at ${p.place}`}>
              <img src={p.img} alt="" width={400} height={300} />
            </button>
          </li>
        ))}
      </ul>
      {cur && (
        <Sheet
          label={`Photo at ${cur.place}`}
          onClose={() => setOpen(null)}
          head={
            <span>
              <b className="han">{cur.place}</b>
              <br />
              <span className="tiny muted">day {dayOf(cur.at)}</span>
            </span>
          }
        >
          <div className="cl-photo">
            <img src={cur.img} alt={`Photo at ${cur.place}`} width={400} height={300} />
          </div>
          <div className="w-card-edit">
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="写一句话：北京，你好！" lang="zh" maxLength={24} aria-label="Caption in Chinese" />
            <button type="button" className="btn primary sm" onClick={() => void card()}>
              Postcard
            </button>
            <button type="button" className="btn sm danger" onClick={drop}>
              Delete
            </button>
          </div>
          {note && <p className="tiny muted">{note}</p>}
        </Sheet>
      )}
    </>
  );
}

