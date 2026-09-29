/**
 * The words of 走走's first two or three hours, as a ready-made word set.
 *
 * "The first hours" is chapters 1 and 2 as the solver plays them: the scenes
 * in the golden save taken when chapter 3 begins (content/world/test-saves),
 * in the order they were played — the hutong, breakfast, the stone lion, the
 * subway to 天安门, then 后海, 北海 and 景山. Every line is cut into words; a
 * word you are given to say (the companion's whole-sentence hint) or a
 * scene's situation word (豆浆, 充值) comes first within its scene, then what
 * people say to you. Place and people's names are left out.
 *
 * Writes src/world/firstWords.json, which the collections page offers as a
 * set. Run again after the chapters change:  npx tsx scripts/world/first-words.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import type { CollectionWord } from '../../src/domain/collection';
import { segment } from '../../src/domain/segment';
import { readLine } from '../../src/world/ui/pinyin';
import { checkContent, readLibrary } from './check-content';

const lib = readLibrary();
const districts = checkContent('content/world', lib).districts;
const played: string[] = JSON.parse(readFileSync('content/world/test-saves/chapter-3.json', 'utf8')).scenes;

const names = new Set(districts.flatMap((d) => d.district.names));
const idioms = new Map(districts.flatMap((d) => d.idioms.map((i) => [i.id, i] as const)));
const scenes = new Map(districts.flatMap((d) => d.scenes.map((s) => [s.id, s] as const)));

/** Words no list knows, with a reading and a meaning; anything else unlisted is a fragment and left out. */
const OFF_LIST: Record<string, [string, string]> = {
  你好: ['nǐ hǎo', 'hello'],
  没: ['méi', "not (have); didn't"],
  给你: ['gěi nǐ', 'here you are'],
  下次: ['xià cì', 'next time'],
  好喝: ['hǎohē', 'nice to drink; tasty'],
  请进: ['qǐng jìn', 'come in, please'],
  小声: ['xiǎoshēng', 'quietly; in a low voice'],
  左手: ['zuǒshǒu', 'left hand; on the left'],
  右手: ['yòushǒu', 'right hand; on the right'],
  东边: ['dōngbian', 'the east side; to the east'],
  西边: ['xībian', 'the west side; to the west'],
  地铁站: ['dìtiězhàn', 'subway station'],
  交通卡: ['jiāotōngkǎ', 'transport card (subway and bus)'],
  充值: ['chōngzhí', 'to top up (a card)'],
  刷卡: ['shuā kǎ', 'to swipe a card'],
  进站: ['jìn zhàn', 'to enter the station'],
  剪头: ['jiǎn tóu', 'to get a haircut'],
  油条: ['yóutiáo', 'fried dough stick'],
  鱼饵: ['yú’ěr', 'fishing bait'],
  狐狸: ['húli', 'fox'],
  九尾狐: ['jiǔwěihú', 'nine-tailed fox'],
  石狮子: ['shíshīzi', 'stone lion'],
  明: ['míng', 'bright (日 sun + 月 moon)'],
};

interface Seen {
  w: string;
  said: boolean;
  situation?: { en: string; explain: string };
  scene: number;
  /** where it is first said, with its translation */
  line?: { zh: string; en: string };
  n: number;
}

const seen = new Map<string, Seen>();
played.forEach((id, at) => {
  const s = scenes.get(id);
  if (!s) return;
  const situation = new Map((s.words ?? []).map((w) => [w.w, w]));
  const whole = new Set([...names, ...situation.keys(), ...idioms.keys()]);
  const note = (w: string, said: boolean, line?: { zh: string; en: string }) => {
    if (names.has(w)) return;
    const x = seen.get(w) ?? { w, said, scene: at, n: 0 };
    x.said ||= said;
    x.n++;
    if (!x.line && line?.en) x.line = line;
    const sw = situation.get(w);
    if (sw && !x.situation) x.situation = { en: sw.en, explain: sw.explain };
    seen.set(w, x);
  };
  const cut = (zh: string) => segment(zh, lib, whole).filter((t) => t.word).map((t) => t.text);
  for (const w of situation.keys()) note(w, true);
  for (const n of s.nodes) {
    const line = { zh: n.say, en: n.translate ?? '' };
    for (const w of cut(n.say)) note(w, n.speaker === 'hero', line);
    if (n.hint) for (const w of cut(n.hint.full.replace(/\{[^}]*\}/g, ''))) note(w, true);
  }
});

/** A line's reading, with the game's own words (成语, 交通卡) read whole. */
const own = new Map<string, string>([
  ...[...idioms.values()].map((i) => [i.id, i.pinyin] as const),
  ...Object.entries(OFF_LIST).map(([w, [py]]) => [w, py] as const),
].map(([w, py]) => [w, py.replace(/ /g, '')]));
const readingOf = (zh: string) =>
  readLine(zh, lib, own)
    .map((p) => (p.word ? p.py : p.text.trim()))
    .filter(Boolean)
    .join(' ')
    .replace(/ ([、，。！？：；,.!?:;])/g, '$1');

const words: CollectionWord[] = [];
const rank = (x: Seen) => x.scene * 2 + (x.said || x.situation ? 0 : 1);
for (const x of [...seen.values()].sort((a, b) => rank(a) - rank(b))) {
  const listed = lib.byWord.get(x.w);
  const idiom = idioms.get(x.w);
  const off = OFF_LIST[x.w];
  if (!listed && !idiom && !off) continue;
  const py = listed?.py ?? idiom?.pinyin ?? off![0];
  const d = x.situation?.en ?? off?.[1] ?? listed?.d ?? idiom?.meaning ?? '';
  const how = [
    x.said ? 'You say this in the game.' : 'People say this to you.',
    x.situation ? `The game explains it: ${x.situation.explain}` : '',
    idiom ? 'A 成语 from the 成语 book.' : '',
  ].filter(Boolean).join(' ');
  words.push({
    w: x.w,
    py,
    d,
    hsk: listed?.hsk ?? null,
    explain: how,
    examples: x.line ? [{ zh: x.line.zh, py: readingOf(x.line.zh), en: x.line.en }] : [],
  });
}

writeFileSync('src/world/firstWords.json', JSON.stringify(words, null, 1) + '\n');
console.log(`${words.length} words from ${played.length} scenes`);
