import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { GeneratedText } from '../../domain/text';
import { isSpeakSectionEnabled } from '../../navigation/features';
import { Modal } from '../../ui/Modal';

/** What the end of a chapter offers to open, each in a sheet over the text. */
export type ChapterSheet = 'words' | 'grammar' | 'questions' | 'write' | 'speak';

/** Which sheet an address's #part opens: the old tabs, and copying out or dictation, which belong to Write. */
export function sheetOfHash(hash: string): ChapterSheet | null {
  if (hash === 'write' || hash === 'copy' || hash === 'more' || hash === 'dictation') return 'write';
  if (hash === 'words' || hash === 'grammar' || hash === 'questions' || hash === 'speak') return hash;
  return null;
}

/**
 * The end of a chapter: 完, then what there is to look at with it — its
 * words, its grammar, its questions — as buttons that each open a sheet.
 * Nothing is open by itself, and there is no "next chapter" here: the
 * footer's › goes on.
 *
 * States: a text with no word list, no grammar or no questions has no button
 * for it; a text with none of them shows only 完.
 */
export interface PartFinishInfo {
  index: number;
  total: number;
  /** e.g. "3.2" */
  nextLabel: string | null;
  nextTo: string | null;
  fullTo: string;
}

export function ChapterFinish({
  text,
  onOpen,
  part,
}: {
  text: GeneratedText;
  onOpen: (s: ChapterSheet) => void;
  part?: PartFinishInfo | null;
}) {
  const items: Array<{ id: ChapterSheet; han: string; label: string; sub: string }> = [
    ...(text.vocab.length ? [{ id: 'words' as const, han: '词', label: 'Words', sub: `${text.vocab.length} in it` }] : []),
    ...(text.grammar.length ? [{ id: 'grammar' as const, han: '法', label: 'Grammar', sub: `${text.grammar.length} pattern${text.grammar.length === 1 ? '' : 's'}` }] : []),
    ...(text.questions.length ? [{ id: 'questions' as const, han: '问', label: 'Questions', sub: `${text.questions.length} to answer` }] : []),
    // Saying it after the narrator, line by line, with Speak on.
    ...(isSpeakSectionEnabled ? [{ id: 'speak' as const, han: '说', label: 'Say', sub: 'line by line' }] : []),
  ];
  const midPart = Boolean(part && part.index < part.total);
  return (
    <section className="rd-finish" aria-label={midPart ? `End of part ${part!.index}` : 'End of the chapter'}>
      <p className="hanzi rd-fin" aria-hidden>
        {midPart ? '续' : '完'}
      </p>
      {part && (
        <div className="rd-finish-part">
          {part.nextTo && part.nextLabel && (
            <Link className="btn tonal" to={part.nextTo}>
              Continue to {part.nextLabel}
            </Link>
          )}
          <Link className="btn quiet sm" to={part.fullTo}>
            Read full chapter
          </Link>
        </div>
      )}
      {items.length > 0 && (
        <div className="rd-finish-row" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((it) => (
            <button key={it.id} className="rd-finish-btn" onClick={() => onOpen(it.id)}>
              <span className="hanzi">{it.han}</span>
              <span>{it.label}</span>
              <small>{it.sub}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const TITLES: Record<ChapterSheet, string> = { words: 'Words', grammar: 'Grammar', questions: 'Questions', write: 'Write it out', speak: 'Say it' };

/** One of the chapter's parts, in a sheet that rises over the text on a phone. */
export function ChapterSheetView({ which, chapter, onClose, children }: { which: ChapterSheet; chapter: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal title={TITLES[which]} subtitle={chapter} onClose={onClose} sheet wide>
      <div className="rd-sheet-body">{children}</div>
    </Modal>
  );
}
