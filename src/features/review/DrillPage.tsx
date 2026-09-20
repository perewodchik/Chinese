import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { drillPools } from '../../domain/drill';
import { paths } from '../../navigation/paths';
import { getState } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { ConfuseDrill } from './ConfuseDrill';
import { drillById, planSitting, sittingSize, type DrillInfo } from './drills';
import { RecallDrill } from './RecallDrill';
import { ToneDrill } from './ToneDrill';
import { WordDrill } from './WordDrill';
import { WriteDrill } from './WriteDrill';

/** One sitting of one drill, at /review/:drill?n=30. */
export function DrillPage() {
  const params = useParams();
  const [query] = useSearchParams();
  const drill = drillById(params.drill);
  if (!drill) return <Navigate to={paths.review()} replace />;
  const size = sittingSize(query.get('n'));
  return <Sitting key={`${drill.id}/${size}`} drill={drill} size={size} />;
}

function Sitting({ drill, size }: { drill: DrillInfo; size: number }) {
  useTitle(drill.name);
  const lib = useLibrary();
  const navigate = useNavigate();

  // The questions are chosen once, as the sitting starts. Every answer changes
  // what is due, and a queue that planned itself again after each one would
  // never come to an end.
  const [sitting] = useState(() => {
    const { recall, learned } = getState();
    const pools = drillPools(lib, recall, learned);
    return { ids: planSitting(drill, pools, recall, size, Date.now()).ids, known: pools.known };
  });

  // Stopping, or finishing, leaves nothing behind to come back to: the back
  // button from Review should not start a sitting all over again.
  const exit = () => navigate(paths.review(), { replace: true });

  if (!sitting.ids.length) {
    return (
      <div className="empty">
        <span className="big">空</span>
        <p>Nothing is due for {drill.name.toLowerCase()}, and there is nothing new to introduce.</p>
        <Link className="btn" to={paths.review()} replace>
          Back to Review
        </Link>
      </div>
    );
  }

  switch (drill.id) {
    case 'tone':
      return <ToneDrill ids={sitting.ids} onExit={exit} />;
    case 'confuse':
      return <ConfuseDrill ids={sitting.ids} onExit={exit} />;
    case 'write':
      return <WriteDrill ids={sitting.ids} onExit={exit} />;
    case 'word':
      return <WordDrill ids={sitting.ids} known={sitting.known} onExit={exit} />;
    case 'sound':
      return <RecallDrill ids={sitting.ids} skill="sound" onExit={exit} />;
    default:
      return <RecallDrill ids={sitting.ids} skill="recognise" onExit={exit} />;
  }
}
