import { useMemo, useState, type ReactNode } from 'react';
import { charId, type ItemId } from '../../domain/ids';
import { cardsFor } from '../../domain/teach';
import { hskLabel, type GeneratedText } from '../../domain/text';
import { itemForToken } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { gradeItem, setShelfStudy, studyText } from '../../store/commands';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { Icon } from '../../ui/Icon';
import { Modal } from '../../ui/Modal';
import { WritePad } from '../review/WritePad';
import { useLibrary } from '../shared/library';
import { AnswerBox } from './AnswerBox';
import type { Standing } from './Passage';
import { SYSTEM_VOICE, type Reading } from './readAloud';

/**
 * The parts of a text, as the strip at the top of the page names them.
 *
 * They are parts of one text, not steps: read it, hear it, check what it
 * says, take the words worth having, write the new characters, answer the
 * questions — in any order, as often as you like. Each fills the line under
 * its name as it is done, so coming back to a text shows at a glance what is
 * left of it.
 */
export type PartId = 'read' | 'listen' | 'translate' | 'words' | 'write' | 'questions';

export const PARTS: Array<{ id: PartId; han: string; label: string }> = [
  { id: 'read', han: '读', label: 'Text' },
  { id: 'listen', han: '听', label: 'Listen' },
  { id: 'translate', han: '译', label: 'Translate' },
  { id: 'words', han: '词', label: 'Words' },
  { id: 'write', han: '写', label: 'Write' },
  { id: 'questions', han: '问', label: 'Questions' },
];

/** How far each part has got, from nothing (0) to done (1). */
export function partFill(text: GeneratedText, standing: (w: string) => Standing): Record<PartId, number> {
  const s = text.study ?? {};
  const words = text.vocab.length ? text.vocab.filter((w) => standing(w.w) !== 'new').length / text.vocab.length : 1;
  const write = text.teach.length ? (s.written ?? []).filter((c) => text.teach.includes(c)).length / text.teach.length : 1;
  const answered = text.questions.length ? (s.answered ?? []).length / text.questions.length : 1;
  return {
    read: text.read ? 1 : 0,
    listen: s.heard ? 1 : 0,
    translate: s.translated ? 1 : 0,
    words: Math.min(1, words),
    write: Math.min(1, write),
    questions: Math.min(1, answered),
  };
}

/** The parts a text has: no questions, no Questions; nothing new to write, no Write. */
export function partsOf(text: GeneratedText): typeof PARTS {
  return PARTS.filter(
    (p) => (p.id !== 'questions' || text.questions.length > 0) && (p.id !== 'write' || text.teach.length > 0),
  );
}

function Section({ id, han, title, aside, children }: { id: string; han: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rd-part" id={id} data-part>
      <header className="rd-part-head">
        <span className="hanzi" aria-hidden>
          {han}
        </span>
        <h2>{title}</h2>
        <span className="spacer" />
        {aside && <span className="rd-part-aside">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- 听 Listen */

export function ListenPart({
  text,
  reading,
  spoken,
  partId,
}: {
  text: GeneratedText;
  reading: Reading;
  spoken: string[];
  partId: string;
}) {
  return (
    <Section
      id={partId}
      han="听"
      title="Listen"
      aside={text.study?.heard ? 'Heard to the end' : `${text.lines.length} lines`}
    >
      <p className="rd-part-lede">
        Hear it once following the text, then once more without looking. Tap a line to hear it on its own and say it after
        the voice.
      </p>
      {reading.voice === SYSTEM_VOICE && reading.systemHint && <p className="rd-voice-hint">{reading.systemHint}</p>}
      {reading.choices.length > 1 && (
        <div className="rd-voices" role="radiogroup" aria-label="Voice">
          {reading.choices.map((v) => (
            <button key={v.key} role="radio" aria-checked={v.active} className="chip" aria-pressed={v.active} onClick={v.pick}>
              {v.name}
            </button>
          ))}
        </div>
      )}
      <ol className="rd-listen">
        {text.lines.map((l, i) => {
          const on = reading.at === i;
          return (
            <li key={i}>
              <button
                className="rd-listen-line"
                data-on={on || undefined}
                onClick={() => (on ? reading.stop() : reading.readLine(spoken, i))}
                aria-label={on ? 'Stop' : `Hear line ${i + 1}`}
              >
                <span className="rd-listen-ic">
                  <Icon name={on ? 'stop' : 'play'} size={14} />
                </span>
                <span className="hanzi">{l.zh}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/* ---------------------------------------------------------------- 译 Translate */

export function TranslatePart({ text, partId }: { text: GeneratedText; partId: string }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const all = open.size === text.lines.length;
  const reveal = (next: Set<number>) => {
    setOpen(next);
    if (next.size && !text.study?.translated) studyText(text.id, { translated: Date.now() });
  };
  return (
    <Section
      id={partId}
      han="译"
      title="Translate"
      aside={
        <button className="btn quiet sm" onClick={() => reveal(all ? new Set() : new Set(text.lines.map((_, i) => i)))}>
          {all ? 'Hide all' : 'Show all'}
        </button>
      }
    >
      <p className="rd-part-lede">Say to yourself what each line means, then tap it to check.</p>
      <ol className="rd-pairs">
        {text.lines.map((l, i) => {
          const shown = open.has(i);
          return (
            <li key={i}>
              <button
                className="rd-pair"
                aria-expanded={shown}
                onClick={() => {
                  const next = new Set(open);
                  if (shown) next.delete(i);
                  else next.add(i);
                  reveal(next);
                }}
              >
                <span className="hanzi rd-pair-zh">{l.zh}</span>
                <span className="rd-pair-en" data-hidden={!shown || undefined}>
                  {shown ? l.en : 'Tap to see the translation'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/* ---------------------------------------------------------------- 词 Words */

export function WordsPart({
  text,
  setId,
  study,
  standing,
  onShowLine,
  partId,
}: {
  text: GeneratedText;
  setId: string | null;
  study: ReadonlySet<ItemId>;
  standing: (w: string) => Standing;
  onShowLine: (i: number) => void;
  partId: string;
}) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const [all, setAll] = useState(false);
  const words = text.vocab;
  const learning = words.filter((w) => standing(w.w) === 'learning').length;
  // The new ones first: they are what the part is for.
  const ordered = useMemo(
    () => [...words].sort((a, b) => Number(standing(a.w) === 'known') - Number(standing(b.w) === 'known')),
    [words, standing],
  );
  const shown = all ? ordered : ordered.slice(0, 6);

  /** The line a grammar note's example comes from, so it can be pointed at in the text. */
  const lineOf = (zh: string | undefined) => {
    if (!zh) return -1;
    const bare = (s: string) => s.replace(/[^\p{Script=Han}]/gu, '');
    const z = bare(zh);
    return text.lines.findIndex((l) => bare(l.zh).includes(z) || (z.length > 3 && z.includes(bare(l.zh))));
  };

  return (
    <Section id={partId} han="词" title="Words" aside={words.length ? `${learning} of ${words.length} learning` : undefined}>
      {words.length > 0 ? (
        <>
          <ul className="rd-words">
            {shown.map((w) => {
              const id = itemForToken(lib, w.w);
              const s = standing(w.w);
              const band = lib.byWord.get(w.w)?.hsk;
              return (
                <li key={w.w} className="rd-word">
                  <button className="rd-word-main" onClick={() => openItem(id)}>
                    <span className="hanzi rd-word-zh">{w.w}</span>
                    <span className="rd-word-text">
                      <span className="rd-word-py">{w.py}</span>
                      <span className="rd-word-d">
                        {w.d}
                        {band ? <span className="tiny muted"> {hskLabel(band)}</span> : null}
                      </span>
                    </span>
                  </button>
                  {s === 'known' ? (
                    <span className="rd-add" data-state="known" title="You know this one">
                      <Icon name="check" />
                    </span>
                  ) : (
                    <button
                      className="rd-add"
                      data-state={s}
                      disabled={!setId}
                      aria-pressed={study.has(id) || s === 'learning'}
                      title={study.has(id) ? 'On this shelf’s list: tap to take it off' : 'Learn this word'}
                      onClick={() => setId && setShelfStudy(setId, [id], !study.has(id))}
                    >
                      <Icon name={s === 'learning' ? 'check' : 'plus'} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {ordered.length > shown.length && (
            <button className="btn quiet sm rd-more" onClick={() => setAll(true)}>
              Show all {ordered.length}
            </button>
          )}
        </>
      ) : (
        <p className="rd-part-lede">This text came without a word list. Tap any word in it to look it up.</p>
      )}

      {text.grammar.map((g, k) => {
        const at = lineOf(g.zh);
        return (
          <div key={k} className="rd-grammar">
            <div className="row" style={{ gap: 8 }}>
              <b>{g.point}</b>
              <span className="spacer" />
              {at >= 0 && (
                <button className="btn quiet sm" onClick={() => onShowLine(at)}>
                  In line {at + 1}
                </button>
              )}
            </div>
            {g.en && <p className="rd-grammar-en">{g.en}</p>}
            {g.zh && <p className="hanzi rd-grammar-zh">{g.zh}</p>}
          </div>
        );
      })}

      {text.note.trim() && <p className="rd-note">{text.note}</p>}
    </Section>
  );
}

/* ---------------------------------------------------------------- 写 Write */

export function WritePart({ text, partId }: { text: GeneratedText; partId: string }) {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const known = useMemo(() => new Set(text.basis), [text.basis]);
  const cards = useMemo(() => cardsFor(lib, text.teach, known, text.glosses), [lib, text.teach, known, text.glosses]);
  const written = new Set(text.study?.written ?? []);
  const [writing, setWriting] = useState<number | null>(null);
  const card = writing === null ? null : cards[writing];

  return (
    <Section id={partId} han="写" title="Write" aside={`${cards.filter((c) => written.has(c.c)).length} of ${cards.length} written`}>
      <p className="rd-part-lede">The characters this text brought in. Look at each one, then write it from memory.</p>
      <div className="rd-write">
        {cards.map((c, i) => (
          <button key={c.c} className="rd-box" data-done={written.has(c.c) || undefined} onClick={() => setWriting(i)}>
            <span className="hanzi">{c.c}</span>
            <span className="rd-box-py">{c.py}</span>
          </button>
        ))}
      </div>
      {card && (
        <WriteOne
          key={card.c}
          char={card.c}
          py={card.py}
          gloss={card.def}
          strokes={lib.strokes}
          onClose={() => setWriting(null)}
          onDone={(rating) => {
            studyText(text.id, { written: [card.c] });
            // Writing it counts towards its writing schedule once it has one.
            if (recall[charId(card.c)]) gradeItem(charId(card.c), 'write', rating);
            setWriting(writing! + 1 < cards.length ? writing! + 1 : null);
          }}
        />
      )}
    </Section>
  );
}

function WriteOne({
  char,
  py,
  gloss,
  strokes,
  onClose,
  onDone,
}: {
  char: string;
  py: string;
  gloss: string;
  strokes: Parameters<typeof Glyph>[0]['strokes'];
  onClose: () => void;
  onDone: Parameters<typeof WritePad>[0]['onDone'];
}) {
  const [stage, setStage] = useState<'look' | 'write'>('look');
  return (
    <Modal title={`${py}: ${gloss}`} onClose={onClose}>
      {stage === 'look' ? (
        <div className="rd-look">
          <span className="rd-look-box">
            <Glyph char={char} strokes={strokes} size={180} />
          </span>
          <p className="small muted">Trace it with your eyes, stroke by stroke, then write it without looking.</p>
          <button className="btn primary lg" onClick={() => setStage('write')}>
            Write it from memory
          </button>
        </div>
      ) : (
        <WritePad char={char} py={py} gloss={gloss} onDone={onDone} />
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------- 问 Questions */

export function QuestionsPart({ text, partId, showPinyin }: { text: GeneratedText; partId: string; showPinyin: boolean }) {
  const answered = new Set(text.study?.answered ?? []);
  return (
    <Section id={partId} han="问" title="Questions" aside={`${answered.size} of ${text.questions.length} answered`}>
      <ol className="rd-questions">
        {text.questions.map((q, i) => (
          <li key={i} data-done={answered.has(i) || undefined}>
            {showPinyin && <p className="rd-q-py">{q.py}</p>}
            <p className="hanzi rd-q-zh">{q.zh}</p>
            {q.en && <p className="rd-q-en">{q.en}</p>}
            <AnswerBox text={text} question={q} onDone={() => !answered.has(i) && studyText(text.id, { answered: [i] })} />
          </li>
        ))}
      </ol>
    </Section>
  );
}
