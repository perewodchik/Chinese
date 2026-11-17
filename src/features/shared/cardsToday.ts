import { useMemo } from 'react';
import { minutesFor, planCards } from '../../domain/cards';
import { useStore } from '../../store/store';
import { useLibrary } from './library';

/** The day's cards, as Cards, the line at the top of Read and the dot on the menu all show them (R3: not a page's export). */
export function useCardsToday() {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const sets = useStore((s) => s.sets);
  const size = useStore((s) => s.settings.cardsPerDay);
  const newPerDay = useStore((s) => s.settings.newPerDay);
  const skills = useStore((s) => s.settings.cardSkills);
  return useMemo(() => {
    const plan = planCards(lib, recall, sets, Date.now(), { size, newPerDay, skills });
    return {
      plan,
      count: plan.cards.length,
      minutes: minutesFor(plan.cards.length),
      done: plan.answeredToday > 0 && plan.cards.length === 0,
      inRotation: Object.keys(recall).length,
    };
  }, [lib, recall, sets, size, newPerDay, skills]);
}
