import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { summariseWords } from '../../domain/wordReview';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';

/**
 * Words on the Review page: one card, in the same grid shape as the drills,
 * with what is due and how many new ones today still has room for.
 */
export function WordsCard({ size }: { size: number }) {
  const navigate = useNavigate();
  const recall = useStore((s) => s.recall);
  const collections = useStore((s) => s.collections);
  const perDay = useStore((s) => s.settings.newWordsPerDay);
  const c = useMemo(
    () => summariseWords(recall, collections, perDay, Date.now()),
    [recall, collections, perDay],
  );
  if (!c.seen && !c.waiting) return null;
  const nothing = c.due === 0 && c.fresh === 0;

  return (
    <div className="drill-grid words-drills">
      <button
        className="drill-card"
        disabled={nothing}
        onClick={() => navigate(paths.wordDrill(size))}
        data-due={c.due > 0 || undefined}
      >
        <span className="mark hanzi">语</span>
        <span className="name">Words</span>
        <span className="blurb">See the word, say what it means — the words you are learning, and today's new ones.</span>
        <span className="figures">
          {c.due > 0 && <b className="due">{c.due} due</b>}
          {c.fresh > 0 && <i>{c.fresh} new today</i>}
          {nothing && <i>{c.waiting ? 'today’s new words are done' : 'nothing waiting'}</i>}
        </span>
      </button>
    </div>
  );
}
