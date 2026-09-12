import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { shelve } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { TextView } from './TextView';

/** One passage, at /texts/:textId, knowing where it sits in its session. */
export function TextPage() {
  const { textId } = useParams();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const shelf = useMemo(() => shelve(texts, sets), [texts, sets]);
  const text = texts.find((t) => t.id === textId);

  if (!text) return <Missing />;

  // A session is meant to be read straight through, so the passage knows which
  // one it is and what comes next.
  const set = sets.find((s) => s.id === text.setId) ?? null;
  const siblings = set ? (shelf.bySet.get(set.id) ?? [text]) : [text];
  const index = Math.max(0, siblings.findIndex((t) => t.id === text.id));
  return <TextView text={text} set={set} siblings={siblings} index={index} />;
}

function Missing() {
  useTitle('Text not found');
  return (
    <div className="empty">
      <span className="big">读</span>
      <p>This text is not on the shelf. It may have been deleted — here, or on another device.</p>
      <Link className="btn" to={paths.texts()}>
        Back to the shelf
      </Link>
    </div>
  );
}
