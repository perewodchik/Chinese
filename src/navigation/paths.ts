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

/** What a shelf shows: its texts, its words, or its characters. */
export type ShelfTab = 'texts' | 'words' | 'characters';

/** Which version of a text with two: the easier retelling, or the book's own. */
export type TextVersion = 'easy' | 'book';

/** A session read one text at a time, or all of it on one page. */
export type ReadMode = 'single' | 'all';

/** What is being done with a video: its tabs. */
export type VideoStep = 'watch' | 'check' | 'words' | 'study' | 'ask';
export const VIDEO_STEPS: readonly VideoStep[] = ['watch', 'check', 'words', 'study', 'ask'];

export const paths = {
  login: (next?: string, expired = false) =>
    withQuery('/login', { next: next && next !== '/' ? next : undefined, expired: expired ? '1' : undefined }),
  register: (next?: string) => withQuery('/register', { next }),

  /** the front door: the text to carry on with, and the day's cards */
  today: () => '/today',
  /** marking a printed sheet; kept under /review, where printed links point */
  gradeSheet: (sheetId: string) => `/review/sheets/${encodeURIComponent(sheetId)}`,
  /** sorting a band's words into known, not sure and new */
  sweep: (band?: number) => withQuery('/review/sweep', { band: band ? String(band) : undefined }),

  library: () => '/library',
  /** one set in the library: a band (`hsk-1`), a topic, or a list of yours (`list-<id>`) */
  librarySet: (id: string) => `/library/${encodeURIComponent(id)}`,
  /** the 214 radicals, with what was typed in the library's search */
  radicals: (q?: string) => withQuery('/library/radicals', { q }),
  /** the same, with one radical's drawer open over it */
  radical: (n: number) => `/library/radicals?radical=${n}`,
  /** blank paper to print: grids, writing paper, dictation sheets */
  paper: () => '/library/paper',
  /** a radical's family: the characters it grows into, drawn as a tree */
  family: (n?: number) => (n ? `/families/${n}` : '/families'),

  collection: (id: string, tab: CollectionTab = 'design') =>
    `/collections/${encodeURIComponent(id)}${tab === 'design' ? '' : `/${tab}`}`,
  /** a word list being written with Claude: describe, prompt, paste */
  buildList: (step: ListStep = 'describe') => `/collections/build/${step}`,

  /** Read: where you stopped, and every shelf — where every "back to the shelf" goes */
  read: () => '/read',
  texts: () => '/read',
  /** one shelf: its texts, the words it is teaching, or its characters */
  shelf: (setId: string, tab: ShelfTab = 'texts') =>
    withQuery(`/read/${encodeURIComponent(setId)}`, { tab: tab === 'texts' ? undefined : tab }),
  /** one text; within a session it redirects to its page there */
  text: (id: string) => `/texts/${encodeURIComponent(id)}`,
  /** a session of texts: `?page=2` for the second on its own, `?mode=all` for every one */
  reading: (setId: string, at: { page?: number; mode?: ReadMode; version?: TextVersion } = {}) =>
    withQuery(`/texts/${encodeURIComponent(setId)}`, {
      mode: at.mode === 'all' ? 'all' : undefined,
      page: at.mode !== 'all' && at.page && at.page > 1 ? String(at.page) : undefined,
      v: at.mode !== 'all' ? at.version : undefined,
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
  /** the tone and sound drills: four tones, tone pairs, sounds English does not have */
  speakingTones: () => '/speaking/pinyin',
  /** the narrators who read texts aloud: made, tuned, given texts */
  speakingNarrators: () => '/speaking/voices',

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

  /** the games, for one band */
  /** 走走, the walk through Beijing */
  world: () => '/play/world',
  play: (band?: number) => withQuery('/play', { band: band && band !== 1 ? String(band) : undefined }),
  /** one round of one game; the seed replays it */
  game: (id: string, band?: number, seed?: string) =>
    withQuery(`/play/${encodeURIComponent(id)}`, { band: band ? String(band) : undefined, seed }),

  settings: () => '/settings',
  /** the cards: how many today, and the ways to practise one kind */
  cards: () => '/cards',
  /** one sitting of cards; `n` asks for fewer (or more) than the day's size */
  cardSession: (at: { n?: number; shelf?: string } = {}) =>
    withQuery('/cards/session', { n: at.n ? String(at.n) : undefined, shelf: at.shelf }),
  /** how much has been learned, day by day and week by week */
  stats: () => '/account/stats',
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
