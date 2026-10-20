import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { shelve, type GeneratedText, type TextSet } from '../../domain/text';
import { useStore } from '../../store/store';

/**
 * The shelf a drawer was opened over, if it was opened while reading: from a
 * text (`/texts/<shelf or text>`) or from a shelf's own page (`/read/<shelf>`).
 * Learning a word there puts it on that shelf's list.
 */
export function useReadingShelf(): { set: TextSet; texts: GeneratedText[] } | null {
  const { pathname } = useLocation();
  const sets = useStore((s) => s.sets);
  const texts = useStore((s) => s.texts);
  return useMemo(() => {
    const m = /^\/(?:texts|read)\/([^/]+)\/?$/.exec(pathname);
    if (!m || m[1] === 'session') return null;
    const key = decodeURIComponent(m[1]!);
    const set = sets.find((s) => s.id === key) ?? sets.find((s) => s.id === texts.find((t) => t.id === key)?.setId);
    if (!set) return null;
    return { set, texts: shelve(texts, sets).bySet.get(set.id) ?? [] };
  }, [pathname, sets, texts]);
}
