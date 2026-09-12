import { Link, Navigate, useParams } from 'react-router';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { CollectionEditor } from './CollectionEditor';

/** One collection: /collections/:id for how it prints, /collections/:id/items for what is in it. */
export function CollectionPage() {
  const { collectionId = '', tab } = useParams();
  const collection = useStore((s) => s.collections.find((c) => c.id === collectionId) ?? null);

  if (tab !== undefined && tab !== 'items') return <Navigate to={paths.collection(collectionId)} replace />;
  if (!collection) return <Missing />;
  return <CollectionEditor key={collection.id} c={collection} tab={tab === 'items' ? 'items' : 'design'} />;
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
