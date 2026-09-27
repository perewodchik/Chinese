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
  // New words are met in the day's lesson now; this card only goes over them.
  const c = useMemo(() => summariseWords(recall, collections, 0, Date.now()), [recall, collections]);
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
        <span className="blurb">See the word, say what it means — the words you are learning.</span>
        <span className="figures">
          {c.due > 0 && <b className="due">{c.due} due</b>}
          {c.fresh > 0 && <i>{c.fresh} new today</i>}
          {nothing && <i>{c.waiting ? `${c.waiting} waiting for a lesson` : 'nothing waiting'}</i>}
        </span>
      </button>
    </div>
  );
}
