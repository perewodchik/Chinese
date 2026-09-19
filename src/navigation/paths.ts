import type { PlanStep } from '../domain/text';
import type { ListStep } from '../domain/wordlist';

/**
 * Every address in the app, built in one place.
 *
 * Screens link with these rather than with string literals, so a page can move
 * without a hunt for every link to it — and so an address in a bookmark, or
 * typed into the iPad, still means the page it meant yesterday.
 */

export type EditorTab = 'design' | 'items';
/** A collection has a third tab, for the words it was written around. */
export type CollectionTab = EditorTab | 'words';
export type DrillId = 'recognise' | 'sound' | 'tone' | 'confuse' | 'write' | 'word';

export const paths = {
  login: (next?: string, expired = false) =>
    withQuery('/login', { next: next && next !== '/' ? next : undefined, expired: expired ? '1' : undefined }),
  register: (next?: string) => withQuery('/register', { next }),

  review: () => '/review',
  drill: (drill: DrillId, size?: number) => withQuery(`/review/${drill}`, { n: size ? String(size) : undefined }),
  gradeSheet: (sheetId: string) => `/review/sheets/${encodeURIComponent(sheetId)}`,

  library: () => '/library',

  radicals: () => '/radicals',
  /** the radicals page with one radical's drawer open */
  radical: (n: number) => `/radicals?radical=${n}`,
  radicalSets: () => '/radicals/sets',
  radicalSet: (id: string, tab: EditorTab = 'design') =>
    `/radicals/sets/${encodeURIComponent(id)}${tab === 'items' ? '/items' : ''}`,

  collections: () => '/collections',
  collection: (id: string, tab: CollectionTab = 'design') =>
    `/collections/${encodeURIComponent(id)}${tab === 'design' ? '' : `/${tab}`}`,
  /** a word list being written with Claude: describe, prompt, paste */
  buildList: (step: ListStep = 'describe') => `/collections/build/${step}`,

  texts: () => '/texts',
  text: (id: string) => `/texts/${encodeURIComponent(id)}`,
  session: (step: PlanStep = 'plan') => `/texts/session/${step}`,

  pinyin: () => '/pinyin',
  /** saying things out loud: `pair-3-3`, `tone-2` */
  pinyinPractice: (set: string) => `/pinyin/practice/${encodeURIComponent(set)}`,
  /** one sound lesson: how it is made, telling it apart, saying it */
  pinyinSounds: (lesson: string, step?: 'hear' | 'say') =>
    withQuery(`/pinyin/sounds/${encodeURIComponent(lesson)}`, { step }),
  /** saying sentences along with a natural voice */
  pinyinShadow: () => '/pinyin/shadow',
  /** the microphone, the voice range, and whether speech recognition works here */
  pinyinVoice: () => '/pinyin/voice',

  settings: () => '/settings',
};

function withQuery(path: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Where to go once signed in. Only a path inside this app is honoured: a `next`
 * pointing at another site would make the sign-in page a way of sending
 * somebody there with this app's name on the link.
 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return paths.review();
  return raw;
}
