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
/** What the Collections page shows: both kinds, or one. */
export type CollectionsShow = 'all' | 'characters' | 'texts';

/** A session read one text at a time, or all of it on one page. */
export type ReadMode = 'single' | 'all';

export type DrillId = 'recognise' | 'sound' | 'tone' | 'confuse' | 'write' | 'word';

/** What is being done with a video: its tabs. */
export type VideoStep = 'watch' | 'write' | 'check' | 'words' | 'study' | 'ask' | 'say';
export const VIDEO_STEPS: readonly VideoStep[] = ['watch', 'write', 'check', 'words', 'study', 'ask', 'say'];

export const paths = {
  login: (next?: string, expired = false) =>
    withQuery('/login', { next: next && next !== '/' ? next : undefined, expired: expired ? '1' : undefined }),
  register: (next?: string) => withQuery('/register', { next }),

  /** the day's plan and everything Review can ask: the front door */
  today: () => '/today',
  /**
   * Review is a section of Today now. Kept as a name because sittings and
   * sheets still live under /review/…, and every "back to Review" means Today.
   */
  review: () => '/today',
  drill: (drill: DrillId, size?: number) => withQuery(`/review/${drill}`, { n: size ? String(size) : undefined }),
  gradeSheet: (sheetId: string) => `/review/sheets/${encodeURIComponent(sheetId)}`,
  /** one sitting of words: the due ones, and today's new ones among them */
  wordDrill: (size?: number) => withQuery('/review/words', { n: size ? String(size) : undefined }),
  /** sorting a band's words into known, not sure and new */
  sweep: (band?: number) => withQuery('/review/sweep', { band: band ? String(band) : undefined }),

  library: () => '/library',
  /** the library showing the 214 radicals rather than a band of characters */
  radicals: () => '/library?band=radicals',
  /** the same, with one radical's drawer open over it */
  radical: (n: number) => `/library?band=radicals&radical=${n}`,
  /** a radical's family: the characters it grows into, drawn as a tree */
  family: (n?: number) => (n ? `/families/${n}` : '/families'),

  /** characters and texts together, or narrowed to one of them */
  collections: (show?: CollectionsShow) =>
    withQuery('/collections', { show: show && show !== 'all' ? show : undefined }),
  collection: (id: string, tab: CollectionTab = 'design') =>
    `/collections/${encodeURIComponent(id)}${tab === 'design' ? '' : `/${tab}`}`,
  /** a word list being written with Claude: describe, prompt, paste */
  buildList: (step: ListStep = 'describe') => `/collections/build/${step}`,

  /** the texts on the Collections page — where every "back to the shelf" goes */
  texts: () => '/collections?show=texts',
  /** one text; within a session it redirects to its page there */
  text: (id: string) => `/texts/${encodeURIComponent(id)}`,
  /** a session of texts: `?page=2` for the second on its own, `?mode=all` for every one */
  reading: (setId: string, at: { page?: number; mode?: ReadMode } = {}) =>
    withQuery(`/texts/${encodeURIComponent(setId)}`, {
      mode: at.mode === 'all' ? 'all' : undefined,
      page: at.mode !== 'all' && at.page && at.page > 1 ? String(at.page) : undefined,
    }),
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
  /** setting a conversation up: what to talk about, and who talks back */
  speakingNew: () => '/speaking/new',
  /** a conversation already under way, by its id */
  speakingTalk: (id: string) => `/speaking/${encodeURIComponent(id)}`,
  /** the microphone, the voice range, and whether speech recognition works here */
  speakingVoice: () => '/speaking/voice',

  /** the videos being studied, with how well each fits */
  videos: () => '/videos',
  /** adding a video: from a link, which may come already filled in */
  addVideo: (url?: string) => withQuery('/videos/add', { url }),
  /** one video, at a part (0-based here, 1-based in the address) and a step */
  video: (id: string, at: { part?: number; step?: VideoStep } = {}) =>
    withQuery(`/videos/${encodeURIComponent(id)}`, {
      part: at.part ? String(at.part + 1) : undefined,
      do: at.step && at.step !== 'watch' ? at.step : undefined,
    }),

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
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return paths.today();
  return raw;
}
