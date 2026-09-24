import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { GuestOnly } from '../features/auth/gates';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { CollectionPage } from '../features/collections/CollectionPage';
import { CollectionsPage } from '../features/collections/CollectionsPage';
import { BuildListPage } from '../features/collections/build/BuildListPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { PinyinPage } from '../features/pinyin/PinyinPage';
import { PracticePage } from '../features/pinyin/PracticePage';
import { ShadowPage } from '../features/pinyin/ShadowPage';
import { SoundLessonPage } from '../features/pinyin/SoundLessonPage';
import { TalkPage } from '../features/pinyin/TalkPage';
import { TalkSetupPage } from '../features/pinyin/TalkSetupPage';
import { VoicePage } from '../features/pinyin/VoicePage';
import { SessionPage } from '../features/reader/SessionPage';
import { ReaderPage } from '../features/reader/ReaderPage';
import { DrillPage } from '../features/review/DrillPage';
import { GradeSheetPage } from '../features/review/GradeSheetPage';
import { ReviewPage } from '../features/review/ReviewPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SweepPage } from '../features/words/SweepPage';
import { WordsDrillPage } from '../features/words/WordsDrillPage';
import { paths } from '../navigation/paths';
import { NotFoundPage, RouteError } from './errors';
import { RequireSession } from './RequireSession';

/**
 * Every page, and the address it lives at.
 *
 *   /login  /register
 *   /review                        what is due, and the drills
 *   /review/:drill?n=30            one sitting of one drill
 *   /review/sheets/:sheetId        marking a printed test sheet
 *   /review/sweep?band             sorting a band's words: known, not sure, new
 *   /review/words?n=30             one sitting of words
 *   /library?q&show&sort           browsing, filters in the query
 *   /library?band=radicals         the same page showing all 214 radicals
 *   /collections?show              every collection, of characters and of texts, and the ready-made sets
 *   /collections/build/:step       a word list written with Claude: describe, prompt, paste
 *   /collections/:id[/items|words] one collection: its design, what is in it, its words
 *   /texts                         moved: the texts are on /collections?show=texts
 *   /texts/session/:step           a writing session: plan, prompt, paste
 *   /texts/:sessionId?page&mode    a session: ?page=2 one text, ?mode=all every one
 *   /texts/:textId                 one passage — within a session, its page there
 *   /speaking                      pronunciation: the four tones and the twenty pairs
 *   /speaking/practice/:set        saying things out loud: pair-3-3, tone-2
 *   /speaking/sounds/:lesson?step  one sound lesson: how it is made, hear it, say it
 *   /speaking/shadow?level&topic   saying sentences along with a natural voice
 *   /speaking/new                  setting a conversation up before it starts
 *   /speaking/:conversationId      one conversation with Claude, kept
 *   /speaking/voice                the voice range, and a check of the sounds
 *   /settings
 *
 * and, on any page, ?item=c好 for the character drawer — or, in the library,
 * ?radical=61 for a radical.
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
              { index: true, element: <Navigate to={paths.review()} replace /> },
              { path: 'review', element: <ReviewPage /> },
              { path: 'review/sheets/:sheetId', element: <GradeSheetPage /> },
              { path: 'review/sweep', element: <SweepPage /> },
              { path: 'review/words', element: <WordsDrillPage /> },
              { path: 'review/:drill', element: <DrillPage /> },
              { path: 'library', element: <LibraryPage /> },
              { path: 'collections', element: <CollectionsPage /> },
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
              { path: 'texts', element: <Navigate to={paths.texts()} replace /> },
              { path: 'texts/session/:step?', element: <SessionPage /> },
              { path: 'texts/:textId', element: <ReaderPage /> },
              { path: 'speaking', element: <PinyinPage /> },
              { path: 'speaking/practice/:set', element: <PracticePage /> },
              { path: 'speaking/sounds/:lesson', element: <SoundLessonPage /> },
              { path: 'speaking/shadow', element: <ShadowPage /> },
              { path: 'speaking/voice', element: <VoicePage /> },
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
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);

/** An old /radicals address, sent to the library with its radical intact. */
function MovedToLibrary() {
  const asked = new URLSearchParams(useLocation().search).get('radical');
  const n = asked && /^\d+$/.test(asked) ? Number(asked) : null;
  return <Navigate to={n ? paths.radical(n) : paths.radicals()} replace />;
}
