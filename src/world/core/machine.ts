/**
 * The ticket machine in every subway station: it sells the 交通卡 and tops
 * it up, so a station without an attendant is never a dead end. The story's
 * first card is still bought from the attendant at 南锣鼓巷 (the `card`
 * scene); the machine is the same deal — 20 deposit and 20 on the card —
 * spoken to like a person: 买交通卡, 充值.
 */

import type { Scene, WorldSave } from './types';

export const CARD_PRICE = 40;
export const TOP_UP = 50;

/** Is this map object a ticket machine? (props drawn with a ticket-machine frame) */
export const isMachine = (o: { kind: string; frame?: string }) => o.kind === 'prop' && !!o.frame?.startsWith('ticket-machine');

const WORDS = [
  { w: '交通卡', explain: '坐地铁、坐公交车的卡。', en: 'transport card' },
  { w: '充值', explain: '给卡里放钱。', en: 'top up' },
  { w: '押金', explain: '先给的钱，不用卡的时候还给你。', en: 'deposit' },
];

const YES = ['好', '好的', '行', '可以', '要', '是', '对', '买'];
const NO = ['不', '不要', '不用', '不买', '没有'];

export function machineScene(s: WorldSave, id = 'machine'): Scene {
  const base = { id: `machine-${id}`, map: '', trigger: 'look' as const, start: 'a', words: WORDS };
  const card = s.bag.card;
  const money = s.bag.money;
  if (card === null) {
    if (money < CARD_PRICE)
      return {
        ...base,
        nodes: [
          {
            id: 'a',
            speaker: 'sign',
            say: `交通卡：四十块。你的钱不够。`,
            translate: `Transport card: 40 yuan (20 deposit, 20 on the card). You have ${money} — not enough yet.`,
          },
        ],
      };
    return {
      ...base,
      nodes: [
        {
          id: 'a',
          speaker: 'sign',
          say: '你好！买交通卡吗？四十块。',
          translate: 'Hello! Buy a transport card? 40 yuan: 20 deposit, 20 on the card.',
          expect: [
            {
              intent: 'yes',
              match: [[...YES, '交通卡', '卡']],
              go: 'done',
              actions: [
                { do: 'money', amount: -CARD_PRICE },
                { do: 'card', amount: 20 },
                { do: 'flag', flag: 'has-card' },
                { do: 'stamp', stamp: 'card' },
              ],
            },
            { intent: 'no', match: [NO], go: 'bye' },
          ],
          hint: { word: '交通卡', frame: '我要买___。', full: '我要买交通卡。' },
        },
        { id: 'done', speaker: 'sign', say: '这是你的交通卡。刷卡，进站。', translate: "Here's your transport card. Tap it at the gates to go in." },
        { id: 'bye', speaker: 'sign', say: '再见。', translate: 'Goodbye.' },
      ],
    };
  }
  if (money < TOP_UP)
    return {
      ...base,
      nodes: [{ id: 'a', speaker: 'sign', say: `卡里有${card}块。`, translate: `There are ${card} yuan on your card. Topping up is ${TOP_UP} yuan — you have ${money}.` }],
    };
  return {
    ...base,
    nodes: [
      {
        id: 'a',
        speaker: 'sign',
        say: `卡里有${card}块。充值吗？五十块。`,
        translate: `There are ${card} yuan on your card. Top it up with 50 yuan?`,
        expect: [
          {
            intent: 'yes',
            match: [[...YES, '充值', '充']],
            go: 'done',
            actions: [
              { do: 'money', amount: -TOP_UP },
              { do: 'card', amount: TOP_UP },
            ],
          },
          { intent: 'no', match: [NO], go: 'bye' },
        ],
        hint: { word: '充值', frame: '我要___。', full: '我要充值。' },
      },
      { id: 'done', speaker: 'sign', say: '充值好了。', translate: 'Done — your card is topped up.' },
      { id: 'bye', speaker: 'sign', say: '再见。', translate: 'Goodbye.' },
    ],
  };
}

/**
 * The ticket gates (闸机) of a station, walked into: from the platform side
 * they always let you out; from the street side a card with money on it
 * goes through. Without one the gate sells you a card (or a top-up) right
 * there, as the machine would — no hunting for the machine first.
 * Returns null to walk through, or the scene to play instead.
 */
export function gateCheck(s: WorldSave, fromAbove: boolean): Scene | null {
  if (!fromAbove) return null;
  const card = s.bag.card;
  if (card !== null && card > 0) return null;
  const scene = machineScene(s, 'gates');
  const first = scene.nodes[0]!;
  const why = card === null ? { say: '你没有交通卡。', en: "You haven't got a transport card." } : { say: '卡里没有钱了。', en: 'There is no money left on the card.' };
  return { ...scene, nodes: [{ ...first, say: `${why.say}${first.say.replace('你好！', '')}`, translate: `${why.en} ${first.translate.replace('Hello! ', '')}` }, ...scene.nodes.slice(1)] };
}
