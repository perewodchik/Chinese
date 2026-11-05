import { Link } from 'react-router';

/**
 * Where something needs a key of the learner's own: one quiet line and the
 * way to add it — never a form in place of the page, and never the red of a
 * mistake, since nothing is wrong. What works without the key still works.
 */
export function NeedsKey({ children, to, action }: { children: React.ReactNode; to: string; action: string }) {
  return (
    <p className="small muted needs-key">
      {children} <Link to={to}>{action}</Link>
    </p>
  );
}
