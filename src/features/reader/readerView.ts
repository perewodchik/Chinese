import { useCallback, useEffect, useState } from 'react';

/**
 * How a text is shown, chosen with the two buttons beside Listen — kept on
 * this device, because the phone in the hand and the iPad on the table are
 * read differently.
 *
 * Pinyin over every word turns reading Chinese into reading pinyin: the eye
 * goes to the letters and the characters are looked through. So the default
 * is pinyin only over the words you do not know yet, which is exactly where
 * it helps, and the translation is hidden until a line is asked for.
 */
export type PinyinMode = 'off' | 'new' | 'all';
export type TranslationMode = 'hidden' | 'lines' | 'shown';

export const PINYIN_MODES: PinyinMode[] = ['off', 'new', 'all'];
export const TRANSLATION_MODES: TranslationMode[] = ['hidden', 'lines', 'shown'];

export const PINYIN_LABEL: Record<PinyinMode, string> = { off: 'Off', new: 'New words', all: 'All' };
export const TRANSLATION_LABEL: Record<TranslationMode, string> = { hidden: 'Hidden', lines: 'Tap a line', shown: 'Shown' };

function stored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

/** The setting is shared by every reader on the page and remembered; a change in one shows in all. */
function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => stored(key, allowed, fallback));
  useEffect(() => {
    const onChange = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) setValue(stored(key, allowed, fallback));
    };
    window.addEventListener('hanzi-reader-view', onChange);
    return () => window.removeEventListener('hanzi-reader-view', onChange);
  }, [key, allowed, fallback]);
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, v);
      } catch {
        // private browsing: it holds for this visit
      }
      window.dispatchEvent(new CustomEvent('hanzi-reader-view', { detail: key }));
    },
    [key],
  );
  return [value, set];
}

export const usePinyinMode = () => useStoredChoice<PinyinMode>('hanzi.reader.pinyin', PINYIN_MODES, 'new');
export const useTranslationMode = () =>
  useStoredChoice<TranslationMode>('hanzi.reader.english', TRANSLATION_MODES, 'hidden');

/** The next choice round, for a button that steps through them. */
export const nextOf = <T,>(list: readonly T[], at: T): T => list[(list.indexOf(at) + 1) % list.length]!;
