import { useEffect } from 'react';

const APP = 'Hanzi Workshop';

/** The tab's title, so history, bookmarks and the tab strip all say which page this is. */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP;
  }, [title]);
}
