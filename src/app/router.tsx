import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { GuestOnly } from '../features/auth/gates';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { CollectionPage } from '../features/collections/CollectionPage';
import { PaperPage } from '../features/collections/BlankPaper';
import { BuildListPage } from '../features/collections/build/BuildListPage';
import { FamiliesPage } from '../features/families/FamiliesPage';
import { GamePage } from '../features/play/GamePage';
import { PlayPage } from '../features/play/PlayPage';
import { WorldRoute } from '../features/world/WorldRoute';
import { LibraryHome } from '../features/library/LibraryHome';
import { RadicalsPage } from '../features/library/RadicalShelf';
import { SetPage } from '../features/library/SetPage';
import { PinyinPage } from '../features/pinyin/PinyinPage';
import { PracticePage } from '../features/pinyin/PracticePage';
import { SoundLessonPage } from '../features/pinyin/SoundLessonPage';
import { TalkPage } from '../features/pinyin/TalkPage';
import { TalkSetupPage } from '../features/pinyin/TalkSetupPage';
import { NarratorsPage } from '../features/pinyin/NarratorsPage';
import { VoicePage } from '../features/pinyin/VoicePage';
import { SessionPage } from '../features/reader/SessionPage';
import { ReaderPage } from '../features/reader/ReaderPage';
import { ReadPage, ShelfPage } from '../features/reader/ReadPage';
import { CardsPage } from '../features/cards/CardsPage';
import { CardSessionPage } from '../features/cards/CardSession';
import { GradeSheetPage } from '../features/review/GradeSheetPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { StatsPage } from '../features/stats/StatsPage';
import { TodayPage } from '../features/today/TodayPage';
import { AddVideoPage } from '../features/videos/AddVideoPage';
import { VideoPage } from '../features/videos/VideoPage';
import { VideosPage } from '../features/videos/VideosPage';
import { SweepPage } from '../features/words/SweepPage';
import { paths } from '../navigation/paths';
import { useStore } from '../store/store';
import { NotFoundPage, RouteError } from './errors';
import { RequireSession } from './RequireSession';

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
 *   /collections                   moved: lists are in the library
 *   /collections/build/:step       a word list written with Claude: describe, prompt, paste
 *   /collections/:id[/items|words] one collection: its design, what is in it, its words
 *   /texts                         moved: the texts are on /read
 *   /texts/session/:step           a writing session: plan, prompt, paste
 *   /texts/:sessionId?page&v&mode  a shelf read a text at a time: ?page=2, ?v=easy|book, ?mode=all
 *   /texts/:textId                 one passage — within a session, its page there
 *   /speaking                      pronunciation: the four tones and the twenty pairs
 *   /speaking/practice/:set        saying things out loud: pair-3-3, tone-2
 *   /speaking/sounds/:lesson?step  one sound lesson: how it is made, hear it, say it
 *   /videos                        videos to study, and how well each fits
 *   /videos/add?url                adding one from a link
 *   /videos/:id?part&do            one video, a part of it, a step
 *   /speaking/new                  setting a conversation up before it starts
 *   /speaking/:conversationId      one conversation with Claude, kept
 *   /speaking/voice                the voice range, and a check of the sounds
 *   /settings
 *
 * and, on any page, ?item=c好 for the character drawer and ?view=好 for a
 * character full screen — or, on the radicals, ?radical=61 for a radical.
 *
 * The section answered to /pinyin until the conversation grew into the largest
 * thing in it; every old address redirects to its new one.
 */

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
        element: <RequireSession />,
        children: [
          {
            // A page that throws takes the page with it, not the bar above it.
            errorElement: <RouteError />,
            children: [
              { index: true, element: <Navigate to={paths.today()} replace /> },
              { path: 'today', element: <TodayPage /> },
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
              { path: 'library/paper', element: <PaperPage /> },
              { path: 'library/:setId', element: <SetPage /> },
              { path: 'families/:radical?', element: <FamiliesPage /> },
              { path: 'play', element: <PlayPage /> },
              { path: 'play/world', element: <WorldRoute /> },
              { path: 'play/:gameId', element: <GamePage /> },
              // Lists to print became part of the library: a list is a set you made.
              { path: 'collections', element: <Navigate to={paths.library()} replace /> },
              { path: 'collections/build/:step?', element: <BuildListPage /> },
              { path: 'collections/:collectionId/:tab?', element: <CollectionPage /> },
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
              { path: 'texts', element: <Navigate to={paths.read()} replace /> },
              { path: 'texts/session/:step?', element: <SessionPage /> },
              { path: 'texts/:textId', element: <ReaderPage /> },
              { path: 'speaking', element: <PinyinPage /> },
              { path: 'speaking/practice/:set', element: <PracticePage /> },
              { path: 'speaking/sounds/:lesson', element: <SoundLessonPage /> },
              // The sentence shadowing that was here gave way to videos.
              { path: 'speaking/shadow', element: <Navigate to={paths.videos()} replace /> },
              { path: 'videos', element: <VideosPage /> },
              { path: 'videos/add', element: <AddVideoPage /> },
              { path: 'videos/:videoId', element: <VideoPage /> },
              { path: 'speaking/voice', element: <VoicePage /> },
              { path: 'speaking/voices', element: <NarratorsPage /> },
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
              { path: 'account', element: <Navigate to={paths.stats()} replace /> },
              { path: 'account/stats', element: <StatsPage /> },
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
 * `?show=todo` for what is left of the band you were in.
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

/** An old /radicals address, sent to the library with its radical intact. */
function MovedToLibrary() {
  const asked = new URLSearchParams(useLocation().search).get('radical');
  const n = asked && /^\d+$/.test(asked) ? Number(asked) : null;
  return <Navigate to={n ? paths.radical(n) : paths.radicals()} replace />;
}
