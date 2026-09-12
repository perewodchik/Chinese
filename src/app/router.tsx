import { createBrowserRouter, Navigate } from 'react-router';
import { GuestOnly } from '../features/auth/gates';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { CollectionPage } from '../features/collections/CollectionPage';
import { CollectionsPage } from '../features/collections/CollectionsPage';
import { LibraryPage } from '../features/library/LibraryPage';
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
 *   /collections/:id[/items]       one collection: its design, or what is in it
 *   /radicals?q&show&sort          all 214, and what each is made of
 *   /radicals/sets                 radical sets, and the ready-made ones
 *   /radicals/sets/:id[/items]     one set: its design, or what is in it
 *   /texts                         the shelf
 *   /texts/session/:step           a writing session: plan, prompt, paste
 *   /texts/:textId                 one passage
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
              { path: 'settings', element: <SettingsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
