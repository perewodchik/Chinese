import { useNavigate } from 'react-router';
import { planSession } from '../../domain/session';
import { paths } from '../../navigation/paths';
import { newId } from '../../platform/ids';
import { startPlan } from '../../store/commands';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';

const dateName = () =>
  `Reading, ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;

/**
 * Starting a writing session: Claude writes a few texts out of the characters
 * you know, onto a new shelf or onto the one named.
 */
export function useStartSession() {
  const lib = useLibrary();
  const navigate = useNavigate();
  const texts = useStore((s) => s.texts);
  const plan = useStore((s) => s.plan);
  const learned = useStore((s) => s.learned);
  const settings = useStore((s) => s.settings);

  return (setId: string | null = null, name?: string) => {
    if (plan && !confirm(`Start a new session? “${plan.name}” is still in progress, and would be thrown away.`)) {
      return;
    }
    startPlan(
      planSession({
        id: newId(),
        name: name ?? dateName(),
        setId,
        now: Date.now(),
        lib,
        learned,
        texts,
        basisCount: settings.basisCount,
        hsk: settings.targetHsk,
      }),
    );
    navigate(paths.session('plan'));
  };
}
