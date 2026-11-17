import { Navigate, useLocation, type RouteObject } from 'react-router';
import { paths } from '../navigation/paths';

/**
 * Every address the app has moved away from, and where it lands now (R13):
 * bookmarks and links from before keep working. Kept apart from the router so
 * its list of pages stays a list of pages.
 */

/** Lists to print live in the Library and texts in Read (V14): /collections/… and /texts/…, query and hash intact. */
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

/** The section was Pinyin before speaking became the whole of it. */
function MovedToSpeaking() {
  const { pathname, search } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/pinyin/, '/speaking')}${search}`} replace />;
}

/** Radicals were a section of their own; now they are in the library, keeping the radical named. */
function MovedToLibrary() {
  const asked = new URLSearchParams(useLocation().search).get('radical');
  const n = asked && /^\d+$/.test(asked) ? Number(asked) : null;
  return <Navigate to={n ? paths.radical(n) : paths.radicals()} replace />;
}

const to = (where: string) => <Navigate to={where} replace />;

export const REDIRECTS: RouteObject[] = [
  // Today is gone (V2): what it showed is at the top of Read.
  { path: 'today', element: to(paths.read()) },
  // Review, the drills and the lessons became Cards: one way to practise.
  { path: 'review', element: to(paths.cards()) },
  { path: 'review/words', element: to(paths.cards()) },
  { path: 'review/session', element: to(paths.cards()) },
  { path: 'review/:drill', element: to(paths.cards()) },
  { path: 'learn', element: to(paths.cards()) },
  // Lists to print and texts, under their sections' names (V14).
  { path: 'library/lists', element: to(paths.library()) },
  { path: 'collections', element: <MovedAddress /> },
  { path: 'collections/*', element: <MovedAddress /> },
  { path: 'texts', element: <MovedAddress /> },
  { path: 'texts/*', element: <MovedAddress /> },
  { path: 'radicals', element: <MovedToLibrary /> },
  { path: 'radicals/*', element: <MovedToLibrary /> },
  // Speaking: shadowing gave way to videos; the voice range to the tones; Pinyin was its old name.
  { path: 'speaking/shadow', element: to(paths.videos()) },
  { path: 'speaking/voice', element: to(paths.speakingTones()) },
  { path: 'pinyin', element: to(paths.speaking()) },
  { path: 'pinyin/talk', element: to(paths.speakingNew()) },
  { path: 'pinyin/:rest/*', element: <MovedToSpeaking /> },
  { path: 'pinyin/:rest', element: <MovedToSpeaking /> },
  // Progress lived under the account (V14).
  { path: 'account/stats', element: to(paths.stats()) },
];
