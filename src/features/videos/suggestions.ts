/**
 * Videos worth starting with at HSK 1–2, looked at by hand on 2026-09-25.
 * Shown on the shelf until they are added. The ones with Chinese captions
 * come first: they can be checked against at once. The others burn their
 * text into the picture, so their text has to be pasted in.
 */
export interface Suggestion {
  videoId: string;
  title: string;
  channel: string;
  why: string;
  captions: boolean;
}

export const SUGGESTIONS: Suggestion[] = [
  {
    videoId: 'TUJw4nfN7S8',
    title: 'Peppa Pig — Best Friends 最好的朋友',
    channel: 'Gaofushuai Adrian',
    why: 'Natural speed, short everyday lines, Chinese captions with pinyin.',
    captions: true,
  },
  {
    videoId: 'qywI0X0Sq0c',
    title: 'Peppa Pig — At the Beach',
    channel: 'Gaofushuai Adrian',
    why: 'The same, at the seaside.',
    captions: true,
  },
  {
    videoId: 'w3lfaxSVN90',
    title: '猫在哪儿 — Where is the cat? (no pinyin)',
    channel: 'Mandarin Click',
    why: 'HSK 1–2, slow and clear, all about 在 and where things are. Its text is in the picture: paste it in.',
    captions: false,
  },
  {
    videoId: '7sjhE6Y9f8c',
    title: 'The Three Little Pigs 三只小猪',
    channel: 'Pandarin',
    why: 'About HSK 3 — a target for later. Its text is in the picture: paste it in.',
    captions: false,
  },
];
