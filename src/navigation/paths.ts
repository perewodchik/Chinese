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
  /** a new password, with a recovery code */
  recover: () => '/recover',

  /** the front door: the text to carry on with, and the day's cards */
  /** marking a printed sheet; kept under /review, where printed links point */
  gradeSheet: (sheetId: string) => `/review/sheets/${encodeURIComponent(sheetId)}`,
  /** sorting a band's words into known, not sure and new */
  sweep: (band?: number) => withQuery('/review/sweep', { band: band ? String(band) : undefined }),

  library: () => '/library',
  /** the Library with its search filled in (B6) */
  librarySearch: (q: string) => withQuery('/library', { q }),
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
    `/library/lists/${encodeURIComponent(id)}${tab === 'design' ? '' : `/${tab}`}`,
  /** a word list being written with Claude: describe, prompt, paste */
  buildList: (step: ListStep = 'describe') => `/library/lists/build/${step}`,

  /** Read: where you stopped, and every shelf — where every "back to the shelf" goes */
  read: () => '/read',
  /** Read with its search filled in (B6) */
  readSearch: (q: string) => withQuery('/read', { q }),
  texts: () => '/read',
  /** one shelf: its texts, the words it is teaching, or its characters */
  shelf: (setId: string, tab: ShelfTab = 'texts') =>
    withQuery(`/read/${encodeURIComponent(setId)}`, { tab: tab === 'texts' ? undefined : tab }),
  /** one text; within a session it redirects to its page there */
  text: (id: string) => `/read/text/${encodeURIComponent(id)}`,
  /** a session of texts: `?page=2` for the second on its own, `?mode=all` for every one */
  reading: (setId: string, at: { page?: number; mode?: ReadMode; version?: TextVersion } = {}) =>
    withQuery(`/read/text/${encodeURIComponent(setId)}`, {
      mode: at.mode === 'all' ? 'all' : undefined,
      page: at.mode !== 'all' && at.page && at.page > 1 ? String(at.page) : undefined,
      v: at.mode !== 'all' ? at.version : undefined,
    }),
  /** a chapter of a book with a companion, already read, lived again as scenes (reader/RelivePage) */
  relive: (setId: string, page: number) => `/read/relive/${encodeURIComponent(setId)}/${page}`,
  session: (step: PlanStep = 'plan') => `/read/session/${step}`,
  /** Chinese pasted or scanned in, made a text to read (T2): into a book, or a new one */
  addText: (shelf?: string) => withQuery('/read/add', { shelf }),
  /** a pasted text explained by the learner's own chat with Claude (T4) */
  /** A6: where an admin's reset link leads: a new password, no name or old one asked */
  resetPassword: (code: string) => withQuery('/recover', { reset: code }),
  explainText: (textId: string) => `/read/explain/${encodeURIComponent(textId)}`,
  /** a text put right by hand: its lines, title and place in its book (T7) */
  editText: (textId: string) => `/read/edit/${encodeURIComponent(textId)}`,

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
  /** talking with Claude: the partners and the conversations kept */
  /** saying a text line by line, on the whole screen: `line` counts from 0 */
  speakingSay: (source: string, line?: number) =>
    withQuery(`/speaking/say/${encodeURIComponent(source)}`, { line: line === undefined ? undefined : String(line + 1) }),
  /** every try at a line, to look back over */
  speakingHistory: () => '/speaking/history',
  speakingTalkFront: () => '/speaking/talk',
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

  /** the list of settings, or one section of them (P11): learning, speaking, keys, printing, appearance, app, work */
  settings: (section?: string) => (section ? `/settings/${section}` : '/settings'),
  /** who is signed in, the password, and what the learner's own keys have been spent on */
  account: () => '/account',
  /** the password, recovery codes, devices and access tokens (P12) */
  accountSecurity: () => '/account/security',
  /** a copy to download, deleting the work or the account (P12) */
  accountData: () => '/account/data',
  /** the site's own page, for whoever runs it: invitations and the accounts */
  admin: () => '/admin',
  /** what the accounts that run the site did, a year of it */
  adminLog: () => '/admin/log',
  /** A5: one account, on its own page */
  adminUser: (id: string) => `/admin/users/${encodeURIComponent(id)}`,
  /** A12: what learners sent from the site */
  adminFeedback: () => '/admin/feedback',
  /** A12: sending feedback, about the page it was opened from */
  /** `about`: what it is about when the page alone does not say — a library book's text (A9) */
  feedback: (from?: string, about?: string) => withQuery('/feedback', { from, about }),
  /** the cards: how many today, and the ways to practise one kind */
  cards: () => '/cards',
  /** one sitting of cards; `n` asks for fewer (or more) than the day's size */
  cardSession: (at: { n?: number; shelf?: string; missed?: boolean } = {}) =>
    withQuery('/cards/session', { n: at.n ? String(at.n) : undefined, shelf: at.shelf, missed: at.missed ? '1' : undefined }),
  /** how much has been learned, day by day and week by week */
  stats: () => '/progress',
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
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return paths.read();
  return raw;
}
