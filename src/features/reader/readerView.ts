import { useCallback, useEffect, useState } from 'react';

/**
 * How a text is shown, chosen with the two buttons beside Listen — kept on
 * this device, because the phone in the hand and the iPad on the table are
 * read differently.
 *
 * Pinyin over every word turns reading Chinese into reading pinyin: the eye
 * goes to the letters and the characters are looked through. So the default
 * is pinyin only over the words you do not know yet, which is exactly where
 * it helps, and the translation stays off until it is turned on — or, line
 * by line, until a line's number is tapped.
 */
export type PinyinMode = 'off' | 'new' | 'all';
export type TranslationMode = 'hidden' | 'shown';

/**
 * A text's pictures: off, small beside the paragraph they go with, or large
 * above it. Beside is the default: the picture is there for a glance and a
 * tap, and the Chinese stays the thing on the page.
 */
export type PictureMode = 'off' | 'beside' | 'large';

export const PINYIN_MODES: PinyinMode[] = ['off', 'new', 'all'];
export const PICTURE_MODES: PictureMode[] = ['off', 'beside', 'large'];
export const PICTURE_LABEL: Record<PictureMode, string> = { off: 'Off', beside: 'Beside', large: 'Large' };
export const TRANSLATION_MODES: TranslationMode[] = ['hidden', 'shown'];

export const PINYIN_LABEL: Record<PinyinMode, string> = { off: 'Off', new: 'New', all: 'All' };
export const TRANSLATION_LABEL: Record<TranslationMode, string> = { hidden: 'Off', shown: 'On' };

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

export const usePictureMode = () => useStoredChoice<PictureMode>('hanzi.reader.pictures', PICTURE_MODES, 'beside');

/** The next choice round, for a button that steps through them. */
export const nextOf = <T,>(list: readonly T[], at: T): T => list[(list.indexOf(at) + 1) % list.length]!;

/**
 * The page's colour: Paper is the app's own (light or dark, as the app is),
 * Sepia a warm light page, Night a dark one whatever the app is. Kept on the
 * device: the iPad in the evening and the phone on the train differ.
 */
export type PaperMode = 'paper' | 'sepia' | 'night';
export const PAPER_MODES: PaperMode[] = ['paper', 'sepia', 'night'];
export const PAPER_LABEL: Record<PaperMode, string> = { paper: 'Paper', sepia: 'Sepia', night: 'Night' };
/** The character on each page's tile in Aa. */
export const PAPER_HAN: Record<PaperMode, string> = { paper: '纸', sepia: '旧', night: '夜' };
export const usePaperMode = () => useStoredChoice<PaperMode>('hanzi.reader.paper', PAPER_MODES, 'paper');

/** New words glossed beside their paragraph (under it where the page is narrow): on unless turned off. */
export type GlossMode = 'on' | 'off';
const GLOSS_MODES: GlossMode[] = ['on', 'off'];
export const useGlossMode = () => useStoredChoice<GlossMode>('hanzi.reader.glosses', GLOSS_MODES, 'on');
