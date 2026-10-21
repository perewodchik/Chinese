import { Link } from 'react-router';
import type { Collection } from '../../domain/collection';
import { paths } from '../../navigation/paths';
import { deleteCollection, setShelfStudy } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/toast';
import { FROM_TEXT, listSetId } from './sets';

/**
 * Lists made from texts, folded away under your lists, with the way to put
 * each back where it belongs: its items onto its shelf's list, and the list
 * gone. Nothing is moved without being asked.
 */
export function FromTexts({ lists }: { lists: Collection[] }) {
  const sets = useStore((s) => s.sets);
  const toast = useToast();
  const home = (c: Collection) => sets.find((s) => s.name === FROM_TEXT.exec(c.name)?.[1]) ?? null;
  const movable = lists.filter((c) => home(c));
  return (
    <details className="from-texts">
      <summary>
        <span className="grow">
          <b>Made from texts</b>
          <span className="small muted">
            {lists.length} old list{lists.length === 1 ? '' : 's'} of new characters, from before shelves kept their own
          </span>
        </span>
        <Icon name="down" />
      </summary>
      <div className="list">
        {lists.map((c) => (
          <Link key={c.id} className="lib-set" to={paths.librarySet(listSetId(c))}>
            <span className="grow">
              <b>{FROM_TEXT.exec(c.name)?.[1] ?? c.name}</b>
              <span className="small muted">{c.items.length} characters</span>
            </span>
            <Icon name="chevron" className="muted" />
          </Link>
        ))}
      </div>
      {movable.length > 0 && (
        <div className="page-foot">
          <button
            className="btn tonal"
            onClick={() => {
              if (!confirm(`Put the characters of ${movable.length} list${movable.length === 1 ? '' : 's'} onto their shelves, and remove the lists?`)) return;
              for (const c of movable) {
                setShelfStudy(home(c)!.id, c.items, true);
                deleteCollection(c.id);
              }
              toast(`Moved ${movable.length} list${movable.length === 1 ? '' : 's'} onto their shelves`);
            }}
          >
            Move them onto their shelves
          </button>
          <p className="tiny muted">Their characters join each shelf’s list, where the texts are.</p>
        </div>
      )}
    </details>
  );
}
