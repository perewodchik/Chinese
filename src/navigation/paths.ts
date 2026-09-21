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
  /** the library showing the 214 radicals rather than a band of characters */
  radicals: () => '/library?band=radicals',
  /** the same, with one radical's drawer open over it */
  radical: (n: number) => `/library?band=radicals&radical=${n}`,

  collections: () => '/collections',
  collection: (id: string, tab: CollectionTab = 'design') =>
    `/collections/${encodeURIComponent(id)}${tab === 'design' ? '' : `/${tab}`}`,
  /** a word list being written with Claude: describe, prompt, paste */
  buildList: (step: ListStep = 'describe') => `/collections/build/${step}`,

  texts: () => '/texts',
  text: (id: string) => `/texts/${encodeURIComponent(id)}`,
  session: (step: PlanStep = 'plan') => `/texts/session/${step}`,

  /**
   * Speaking — the section that was called Pinyin until the conversation grew
   * into the largest thing in it. Pinyin is what is written above the
   * characters; speaking is what the whole section is for, and the old
   * addresses redirect (see `router.tsx`) so a bookmark still lands.
   */
  speaking: () => '/speaking',
  /** saying things out loud: `pair-3-3`, `tone-2` */
  speakingPractice: (set: string) => `/speaking/practice/${encodeURIComponent(set)}`,
  /** one sound lesson: how it is made, telling it apart, saying it */
  speakingSounds: (lesson: string, step?: 'hear' | 'say') =>
    withQuery(`/speaking/sounds/${encodeURIComponent(lesson)}`, { step }),
  /** saying sentences along with a natural voice */
  speakingShadow: () => '/speaking/shadow',
  /** setting a conversation up: what to talk about, and who talks back */
  speakingNew: () => '/speaking/new',
  /** a conversation already under way, by its id */
  speakingTalk: (id: string) => `/speaking/${encodeURIComponent(id)}`,
  /** the microphone, the voice range, and whether speech recognition works here */
  speakingVoice: () => '/speaking/voice',

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
