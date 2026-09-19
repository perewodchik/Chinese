import { Link, Navigate, useParams } from 'react-router';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { CollectionEditor } from './CollectionEditor';

/**
 * One collection: /collections/:id for how it prints, /collections/:id/items for
 * what is in it, and /collections/:id/words for the words it was written around.
 */
export function CollectionPage() {
  const { collectionId = '', tab } = useParams();
  const collection = useStore((s) => s.collections.find((c) => c.id === collectionId) ?? null);

  if (tab !== undefined && tab !== 'items' && tab !== 'words') {
    return <Navigate to={paths.collection(collectionId)} replace />;
  }
  if (!collection) return <Missing />;
  // Words only for a collection that has them; an old link lands on the design.
  if (tab === 'words' && !collection.words?.length) return <Navigate to={paths.collection(collectionId)} replace />;
  return <CollectionEditor key={collection.id} c={collection} tab={tab ?? 'design'} />;
}

function Missing() {
  useTitle('Collection not found');
  return (
    <div className="empty">
      <span className="big">空</span>
      <p>This collection is not here. It may have been deleted — on this device, or on another one.</p>
      <Link className="btn" to={paths.collections()}>
        All collections
      </Link>
    </div>
  );
}
