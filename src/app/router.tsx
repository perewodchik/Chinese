import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { GuestOnly } from '../features/auth/gates';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { RecoverPage } from '../features/auth/RecoverPage';
import { WorldRoute } from '../features/world/WorldRoute';
import { LibraryHome } from '../features/library/LibraryHome';
import { SetPage } from '../features/library/SetPage';
import { AddTextPage } from '../features/reader/AddTextPage';
import { ReaderPage } from '../features/reader/ReaderPage';
import { ReadPage, ShelfPage } from '../features/reader/ReadPage';
import { CardsPage } from '../features/cards/CardsPage';
import { CardSessionPage } from '../features/cards/CardSession';
import { paths } from '../navigation/paths';
import { useStore } from '../store/store';
import { NotFoundPage, RouteError } from './errors';
import { RequireSession } from './RequireSession';
import { lazyPage } from './lazyPage';

// R5: pages that come in pieces of their own, fetched when opened.
const CollectionPage = lazyPage(() => import('../features/collections/CollectionPage'), 'CollectionPage');
const PaperPage = lazyPage(() => import('../features/collections/BlankPaper'), 'PaperPage');
const BuildListPage = lazyPage(() => import('../features/collections/build/BuildListPage'), 'BuildListPage');
const FamiliesPage = lazyPage(() => import('../features/families/FamiliesPage'), 'FamiliesPage');
const GamePage = lazyPage(() => import('../features/play/GamePage'), 'GamePage');
const PlayPage = lazyPage(() => import('../features/play/PlayPage'), 'PlayPage');
const RadicalsPage = lazyPage(() => import('../features/library/RadicalShelf'), 'RadicalsPage');
const PhrasesPage = lazyPage(() => import('../features/pinyin/PhrasesPage'), 'PhrasesPage');
const SpeakingFrame = lazyPage(() => import('../features/pinyin/SpeakingFrame'), 'SpeakingFrame');
const SpeakHome = lazyPage(() => import('../features/speak/SpeakPage'), 'SpeakHome');
const SpeakSay = lazyPage(() => import('../features/speak/SpeakPage'), 'SpeakSay');
const TalkFrontPage = lazyPage(() => import('../features/pinyin/TalkFrontPage'), 'TalkFrontPage');
const PracticePage = lazyPage(() => import('../features/pinyin/PracticePage'), 'PracticePage');
const SoundLessonPage = lazyPage(() => import('../features/pinyin/SoundLessonPage'), 'SoundLessonPage');
const TalkPage = lazyPage(() => import('../features/pinyin/TalkPage'), 'TalkPage');
const TalkSetupPage = lazyPage(() => import('../features/pinyin/TalkSetupPage'), 'TalkSetupPage');
const NarratorsPage = lazyPage(() => import('../features/pinyin/NarratorsPage'), 'NarratorsPage');
const TonesPage = lazyPage(() => import('../features/pinyin/TonesPage'), 'TonesPage');
const TriesPage = lazyPage(() => import('../features/pinyin/TriesPage'), 'TriesPage');
const SessionPage = lazyPage(() => import('../features/reader/SessionPage'), 'SessionPage');
const ExplainTextPage = lazyPage(() => import('../features/reader/ExplainTextPage'), 'ExplainTextPage');
const EditTextPage = lazyPage(() => import('../features/reader/EditTextPage'), 'EditTextPage');
const GradeSheetPage = lazyPage(() => import('../features/review/GradeSheetPage'), 'GradeSheetPage');
const SettingsPage = lazyPage(() => import('../features/settings/SettingsPage'), 'SettingsPage');
const StatsPage = lazyPage(() => import('../features/stats/StatsPage'), 'StatsPage');
const AccountPage = lazyPage(() => import('../features/account/AccountPage'), 'AccountPage');
const AccountData = lazyPage(() => import('../features/account/AccountData'), 'AccountData');
const AccountSecurity = lazyPage(() => import('../features/account/AccountSecurity'), 'AccountSecurity');
const AdminLogPage = lazyPage(() => import('../features/admin/AdminLogPage'), 'AdminLogPage');
const AdminFeedbackPage = lazyPage(() => import('../features/admin/AdminFeedbackPage'), 'AdminFeedbackPage');
const FeedbackPage = lazyPage(() => import('../features/feedback/FeedbackPage'), 'FeedbackPage');
const AdminPage = lazyPage(() => import('../features/admin/AdminPage'), 'AdminPage');
const AddVideoPage = lazyPage(() => import('../features/videos/AddVideoPage'), 'AddVideoPage');
const VideoPage = lazyPage(() => import('../features/videos/VideoPage'), 'VideoPage');
const VideosPage = lazyPage(() => import('../features/videos/VideosPage'), 'VideosPage');
const SweepPage = lazyPage(() => import('../features/words/SweepPage'), 'SweepPage');

/**
 * Every page, and the address it lives at.
 *
 *   /login  /register
 *   /cards                         today's cards, how many a day, and the other ways to practise
 *   /cards/session?n&shelf         one sitting of cards; ?shelf=<id> for one shelf's words
 *   /review                        moved: the drills are on /cards
 *   /review/:drill?n=30            one sitting of one drill
 *   /review/sheets/:sheetId        marking a printed test sheet
 *   /review/sweep?band             sorting a band's words: known, not sure, new
 *   /review/words?n=30             one sitting of words
 *   /library                       every set: your lists, the HSK bands, the topics; search
 *   /library/:setId?tab&show&order one set: hsk-1, theme-food, list-<id>; ?tab=words
 *   /library/radicals?q            the 214 radicals
 *   /library/paper                 blank paper to print
 *   /families/:radical?band        a radical's family: what it grows into, as a tree
 *   /play?band                     the games, and the seals they have won
 *   /play/world?map&time           走走, the walk through Beijing (Phaser, loaded lazily)
 *   /play/:gameId?band&seed        one round of one game
 *   /read                          where you stopped, every shelf, and search
 *   /read/:setId?tab               one shelf: its texts, its words, its characters
 *   /library/lists/build/:step     a word list written with Claude: describe, prompt, paste
 *   /library/lists/:id[/items|words] one list to print: its design, what is in it, its words
 *   /read/session/:step            a writing session: plan, prompt, paste
 *   /read/add?shelf                Chinese pasted or scanned in, made a text to read
 *   /read/explain/:textId          that text's English, words and questions, from the learner's Claude
 *   /read/edit/:textId             a text put right by hand: its lines, title, place in its book
 *   /read/text/:setId?page&v&mode  a shelf read a text at a time: ?page=2, ?v=easy|book, ?mode=all
 *   /read/text/:textId             one passage — within a session, its page there
 *   /collections/…, /texts/…       moved (V14): the old addresses land on the new ones
 *   /speaking                      phrases said and scored by SpeechSuper or iFlytek (Speaking's first tab)
 *   /speaking/voices, /talk, /pinyin  Speaking's other tabs: narrators, Claude, the tones and sounds
 *   /speaking/history              every try at a line, with filters, each opened to its scored characters
 *   /speaking/say/:source?line     a text said line by line, each line scored, on the whole screen
 *   /speaking/practice/:set        saying things out loud: pair-3-3, tone-2
 *   /speaking/sounds/:lesson?step  one sound lesson: how it is made, hear it, say it
 *   /videos                        videos to study, and how well each fits
 *   /videos/add?url                adding one from a link
 *   /videos/:id?part&do            one video, a part of it, a step
 *   /speaking/new                  setting a conversation up before it starts
 *   /speaking/:conversationId      one conversation with Claude, kept
 *   /speaking/voice                (gone: the voice range was for pitch the app measured itself) → the tones
 *   /settings
 *
 * and, on any page, ?item=c好 for the character drawer and ?view=好 for a
 * character full screen — or, on the radicals, ?radical=61 for a radical.
 *
 * The section answered to /pinyin until the conversation grew into the largest
 * thing in it; every old address redirects to its new one.
 */

/**
 * One name a section (V14): lists to print live in the Library and texts in
 * Read, so /collections/… and /texts/… carry across, query and hash intact.
 */
function MovedAddress() {
  const { pathname, search, hash } = useLocation();
  const to = pathname
    .replace(/^\/collections(?=\/|$)/, '/library/lists')
    .replace(/^\/texts\/session(?=\/|$)/, '/read/session')
    .replace(/^\/texts(?=\/)/, '/read/text')
    .replace(/^\/texts$/, '/read')
    .replace(/^\/library\/lists$/, '/library');
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

/** Anything else under the old /pinyin name, carried across with its tail intact. */
function MovedToSpeaking() {
  const { pathname, search } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/pinyin/, '/speaking')}${search}`} replace />;
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        path: 'login',
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      {
        path: 'register',
        element: (
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        ),
      },
      {
        path: 'recover',
        element: (
          <GuestOnly>
            <RecoverPage />
          </GuestOnly>
        ),
      },
      {
        element: <RequireSession />,
        children: [
          {
            // A page that throws takes the page with it, not the bar above it.
            errorElement: <RouteError />,
            children: [
              { index: true, element: <Navigate to={paths.read()} replace /> },
              // Today is gone (V2): what it showed is at the top of Read. Its address is kept for bookmarks.
              { path: 'today', element: <Navigate to={paths.read()} replace /> },
              // Review became Cards; what the old page held is on the Cards tab.
              { path: 'review', element: <Navigate to={paths.cards()} replace /> },
              { path: 'cards', element: <CardsPage /> },
              { path: 'cards/session', element: <CardSessionPage /> },
              { path: 'review/sheets/:sheetId', element: <GradeSheetPage /> },
              { path: 'review/sweep', element: <SweepPage /> },
              // The drills, the daily review and the lessons of new characters
              // were folded into the cards: one way to practise, not six.
              { path: 'review/words', element: <Navigate to={paths.cards()} replace /> },
              { path: 'learn', element: <Navigate to={paths.cards()} replace /> },
              { path: 'review/session', element: <Navigate to={paths.cards()} replace /> },
              { path: 'review/:drill', element: <Navigate to={paths.cards()} replace /> },
              { path: 'library', element: <LibraryRoute /> },
              { path: 'library/radicals', element: <RadicalsPage /> },
              { path: 'library/lists', element: <Navigate to={paths.library()} replace /> },
              { path: 'library/lists/build/:step?', element: <BuildListPage /> },
              { path: 'library/lists/:collectionId/:tab?', element: <CollectionPage /> },
              { path: 'library/paper', element: <PaperPage /> },
              { path: 'library/:setId', element: <SetPage /> },
              { path: 'families/:radical?', element: <FamiliesPage /> },
              { path: 'play', element: <PlayPage /> },
              { path: 'play/world', element: <WorldRoute /> },
              { path: 'play/:gameId', element: <GamePage /> },
              // Lists to print became part of the library: a list is a set you made.
              { path: 'collections', element: <MovedAddress /> },
              { path: 'collections/*', element: <MovedAddress /> },
              // Radicals were a section of their own, with sets and sheets to
              // design, until it became clear that a radical is something you
              // look up rather than something you work through. They are part
              // of the library now; anything bookmarked under the old address
              // still lands, keeping the radical it named.
              { path: 'radicals', element: <MovedToLibrary /> },
              { path: 'radicals/*', element: <MovedToLibrary /> },
              // Texts were a tab of their own until they became what they
              // always were: collections, beside the character ones.
              { path: 'read', element: <ReadPage /> },
              { path: 'read/:setId', element: <ShelfPage /> },
              { path: 'read/session/:step?', element: <SessionPage /> },
              { path: 'read/add', element: <AddTextPage /> },
              { path: 'read/explain/:textId', element: <ExplainTextPage /> },
              { path: 'read/edit/:textId', element: <EditTextPage /> },
              { path: 'read/text/:textId', element: <ReaderPage /> },
              { path: 'texts', element: <MovedAddress /> },
              { path: 'texts/*', element: <MovedAddress /> },
              // Speaking's four parts, with their own tabs: down the side on an iPad, across the top on a phone.
              {
                element: <SpeakingFrame />,
                children: [
                  { path: 'speaking', element: <SpeakRoute home /> },
                  { path: 'speaking/voices', element: <NarratorsPage /> },
                  { path: 'speaking/talk', element: <TalkFrontPage /> },
                  { path: 'speaking/pinyin', element: <TonesPage /> },
                  { path: 'speaking/history', element: <TriesPage /> },
                ],
              },
              // A text said line by line has the whole screen, like a sitting.
              { path: 'speaking/say/:source', element: <SpeakRoute /> },
              { path: 'speaking/practice/:set', element: <PracticePage /> },
              { path: 'speaking/sounds/:lesson', element: <SoundLessonPage /> },
              // The sentence shadowing that was here gave way to videos.
              { path: 'speaking/shadow', element: <Navigate to={paths.videos()} replace /> },
              { path: 'videos', element: <VideosPage /> },
              { path: 'videos/add', element: <AddVideoPage /> },
              { path: 'videos/:videoId', element: <VideoPage /> },
              { path: 'speaking/voice', element: <Navigate to={paths.speakingTones()} replace /> },
              // Setting one up, and the conversation itself. `new` is matched
              // before `:conversationId` so a conversation can never be named
              // out of reach of the page that starts one.
              { path: 'speaking/new', element: <TalkSetupPage /> },
              { path: 'speaking/:conversationId', element: <TalkPage /> },
              // The section was called Pinyin until speaking became the whole
              // of it. Anything bookmarked under the old name still lands.
              { path: 'pinyin', element: <Navigate to={paths.speaking()} replace /> },
              { path: 'pinyin/talk', element: <Navigate to={paths.speakingNew()} replace /> },
              { path: 'pinyin/:rest/*', element: <MovedToSpeaking /> },
              { path: 'pinyin/:rest', element: <MovedToSpeaking /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'settings/:section', element: <SettingsPage /> },
              { path: 'account', element: <AccountPage /> },
              { path: 'account/security', element: <AccountSecurity /> },
              { path: 'account/data', element: <AccountData /> },
              { path: 'progress', element: <StatsPage /> },
              // Its old address, kept for bookmarks (V14).
              { path: 'account/stats', element: <Navigate to={paths.stats()} replace /> },
              { path: 'admin', element: <AdminPage /> },
              { path: 'admin/log', element: <AdminLogPage /> },
              { path: 'admin/feedback', element: <AdminFeedbackPage /> },
              { path: 'feedback', element: <FeedbackPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);

/**
 * The library's sets — and the addresses of the page it was before them, a
 * switch and a band strip in the query: `?kind=radicals`, `?kind=words`,
 * `?show=none` for what is not known yet of the band you were in.
 */
function LibraryRoute() {
  const { search } = useLocation();
  const band = useStore((s) => s.settings.hskBand);
  const q = new URLSearchParams(search);
  const kind = q.get('kind');
  if (kind === 'radicals' || q.get('band') === 'radicals') {
    const n = q.get('radical');
    return <Navigate to={n && /^\d+$/.test(n) ? paths.radical(Number(n)) : paths.radicals()} replace />;
  }
  if (kind || q.has('show')) {
    const set = paths.librarySet(`hsk-${band >= 1 && band <= 7 ? band : 1}`);
    const show = q.get('show');
    const rest = new URLSearchParams();
    if (kind === 'words') rest.set('tab', 'words');
    if (show && show !== 'all') rest.set('show', show);
    return <Navigate to={`${set}${rest.size ? `?${rest}` : ''}`} replace />;
  }
  return <LibraryHome />;
}

/** Speak's phrases, as they were or the new Speak, by the switch in Settings. */
function SpeakRoute({ home }: { home?: boolean }) {
  const v2 = useStore((s) => s.settings.speakV2);
  if (!v2) return <PhrasesPage />;
  return home ? <SpeakHome /> : <SpeakSay />;
}

/** An old /radicals address, sent to the library with its radical intact. */
function MovedToLibrary() {
  const asked = new URLSearchParams(useLocation().search).get('radical');
  const n = asked && /^\d+$/.test(asked) ? Number(asked) : null;
  return <Navigate to={n ? paths.radical(n) : paths.radicals()} replace />;
}
