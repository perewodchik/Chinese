import { createBrowserRouter, Navigate } from 'react-router';
import { GuestOnly } from '../features/auth/gates';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { CollectionPage } from '../features/collections/CollectionPage';
import { CollectionsPage } from '../features/collections/CollectionsPage';
import { BuildListPage } from '../features/collections/build/BuildListPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { PinyinPage } from '../features/pinyin/PinyinPage';
import { PracticePage } from '../features/pinyin/PracticePage';
import { VoicePage } from '../features/pinyin/VoicePage';
import { RadicalSetPage } from '../features/radicals/RadicalSetPage';
import { RadicalSetsPage } from '../features/radicals/RadicalSetsPage';
import { RadicalsLayout } from '../features/radicals/RadicalsLayout';
import { RadicalsPage } from '../features/radicals/RadicalsPage';
import { SessionPage } from '../features/reader/SessionPage';
import { TextPage } from '../features/reader/TextPage';
import { TextsPage } from '../features/reader/TextsPage';
import { DrillPage } from '../features/review/DrillPage';
import { GradeSheetPage } from '../features/review/GradeSheetPage';
import { ReviewPage } from '../features/review/ReviewPage';
import { SettingsPage } from '../features/settings/SettingsPage';
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
 *   /library?q&show&sort           browsing, filters in the query
 *   /collections                   every collection, and the ready-made sets
 *   /collections/build/:step       a word list written with Claude: describe, prompt, paste
 *   /collections/:id[/items|words] one collection: its design, what is in it, its words
 *   /radicals?q&show&sort          all 214, and what each is made of
 *   /radicals/sets                 radical sets, and the ready-made ones
 *   /radicals/sets/:id[/items]     one set: its design, or what is in it
 *   /texts                         the shelf
 *   /texts/session/:step           a writing session: plan, prompt, paste
 *   /texts/:textId                 one passage
 *   /pinyin                        pronunciation: the four tones and the twenty pairs
 *   /pinyin/practice/:set          saying things out loud: pair-3-3, tone-2
 *   /pinyin/voice                  the voice range, and a check of the sounds
 *   /settings
 *
 * and, on any page, ?item=c好 for the character drawer — or ?radical=61 for a
 * radical, under /radicals.
 */
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
              { path: 'review/:drill', element: <DrillPage /> },
              { path: 'library', element: <LibraryPage /> },
              { path: 'collections', element: <CollectionsPage /> },
              { path: 'collections/build/:step?', element: <BuildListPage /> },
              { path: 'collections/:collectionId/:tab?', element: <CollectionPage /> },
              {
                path: 'radicals',
                element: <RadicalsLayout />,
                children: [
                  { index: true, element: <RadicalsPage /> },
                  { path: 'sets', element: <RadicalSetsPage /> },
                  { path: 'sets/:setId/:tab?', element: <RadicalSetPage /> },
                ],
              },
              { path: 'texts', element: <TextsPage /> },
              { path: 'texts/session/:step?', element: <SessionPage /> },
              { path: 'texts/:textId', element: <TextPage /> },
              { path: 'pinyin', element: <PinyinPage /> },
              { path: 'pinyin/practice/:set', element: <PracticePage /> },
              { path: 'pinyin/voice', element: <VoicePage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
