import type { CardSkill } from '../../domain/cards';

/** The kinds of card, as the learner chooses between them. */
export const ASKS: ReadonlyArray<{ skill: CardSkill; mark: string; name: string; blurb: string; off: string }> = [
  {
    skill: 'recognise',
    mark: '意',
    name: 'Meaning',
    blurb: 'See it, recall what it means and how it is said, then turn the card over.',
    off: 'Turn off meaning cards',
  },
  {
    skill: 'sound',
    mark: '音',
    name: 'Pinyin',
    blurb: 'Type how it is said, tones included.',
    off: 'Turn off pinyin cards',
  },
  {
    skill: 'write',
    mark: '写',
    name: 'Writing',
    blurb: 'Write the character on the screen from memory.',
    off: 'Turn off writing cards',
  },
];
