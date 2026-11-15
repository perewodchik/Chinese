import { useMemo } from 'react';
import { Link } from 'react-router';
import { active, dayKey } from '../../domain/activity';
import { isCharId, type ItemId } from '../../domain/ids';
import { isLearned } from '../../domain/memory';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';

const DAY = 86_400_000;

/**
 * Back after more than a week away (G3): what was learned is still there,
 * said with its number, and one way in — a short round of cards — rather
 * than how many days were missed. Nothing for someone who was here this
 * week, or who has never worked.
 */
export function WelcomeBack() {
  const activity = useStore((s) => s.activity);
  const recall = useStore((s) => s.recall);
  const away = useMemo(() => {
    const today = dayKey(Date.now());
    const worked = Object.keys(activity)
      .filter((k) => k < today && (active(activity[k]) || (activity[k]?.ms ?? 0) > 0))
      .sort();
    const last = worked[worked.length - 1];
    if (!last || activity[today]) return null;
    const days = Math.floor((Date.parse(today) - Date.parse(last)) / DAY);
    if (days <= 7) return null;
    const chars = Object.keys(recall).filter((id) => isCharId(id as ItemId) && isLearned(recall[id as ItemId])).length;
    return { chars };
  }, [activity, recall]);
  if (!away) return null;
  return (
    <div className="welcome-back">
      <span className="grow">
        <b>Welcome back.</b>
        <span className="small muted">
          Everything you learned is still here{away.chars ? `: ${away.chars.toLocaleString('en')} characters` : ''}.
        </span>
      </span>
      <Link className="btn tonal sm" to={paths.cardSession({ n: 10 })}>
        A short warm-up
      </Link>
    </div>
  );
}
