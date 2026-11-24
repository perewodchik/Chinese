import { useCallback, useEffect, useState } from 'react';
import { stored as storage } from '../../platform/storage';

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
/** Large is not offered: a picture across the whole column outweighed its paragraph. A comic's page photo is still shown large. */
export const PICTURE_MODES: PictureMode[] = ['off', 'beside'];
export const PICTURE_LABEL: Record<PictureMode, string> = { off: 'Off', beside: 'Beside', large: 'Large' };
export const TRANSLATION_MODES: TranslationMode[] = ['hidden', 'shown'];

export const PINYIN_LABEL: Record<PinyinMode, string> = { off: 'Off', new: 'New', all: 'All' };
export const TRANSLATION_LABEL: Record<TranslationMode, string> = { hidden: 'Off', shown: 'On' };

function stored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = storage.get(key);
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
        storage.set(key, v);
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

/**
 * New words glossed beside their paragraph (under it where the page is
 * narrow): off unless turned on in Aa. Under every paragraph the list read as
 * a second text and buried the first; a new word is marked in the text, a tap
 * gives its card, and the Words tab has them all. A new key, so a page that
 * had it on by the old default starts with it off.
 */
export type GlossMode = 'on' | 'off';
const GLOSS_MODES: GlossMode[] = ['on', 'off'];
export const useGlossMode = () => useStoredChoice<GlossMode>('hanzi.reader.newWordGlosses', GLOSS_MODES, 'off');


/**
 * The type of the Chinese (Aa › Type): the brush 楷 the app is set in, a
 * printed 宋 as books are, or a plain 黑 as screens are. Kept on the device,
 * as the page colour is.
 */
export type HanFont = 'kai' | 'song' | 'hei';
export const HAN_FONTS: HanFont[] = ['kai', 'song', 'hei'];
export const HAN_FONT_LABEL: Record<HanFont, string> = { kai: 'Brush', song: 'Print', hei: 'Plain' };
export const HAN_FONT_HAN: Record<HanFont, string> = { kai: '楷', song: '宋', hei: '黑' };
/** The stack each one is drawn from: WenKai is the app's own; the other two are the system's. */
export const HAN_FONT_STACK: Record<HanFont, string> = {
  kai: 'var(--han)',
  song: "'Songti SC', 'STSong', 'Noto Serif SC', 'Source Han Serif SC', serif",
  hei: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Microsoft YaHei', sans-serif",
};
export const useHanFont = () => useStoredChoice<HanFont>('hanzi.reader.font', HAN_FONTS, 'kai');

/** Room between lines. Normal is what the page always had: room for pinyin on every line. */
export type LineSpacing = 'tight' | 'normal' | 'airy';
export const LINE_SPACINGS: LineSpacing[] = ['tight', 'normal', 'airy'];
export const LINE_SPACING_LABEL: Record<LineSpacing, string> = { tight: 'Tight', normal: 'Normal', airy: 'Airy' };
export const LINE_HEIGHT: Record<LineSpacing, number> = { tight: 2.05, normal: 2.35, airy: 2.7 };
export const useLineSpacing = () => useStoredChoice<LineSpacing>('hanzi.reader.lineSpacing', LINE_SPACINGS, 'normal');

/** How wide the column of text runs on a wide screen; on a phone it is the screen either way. */
export type TextWidth = 'narrow' | 'book' | 'wide';
export const TEXT_WIDTHS: TextWidth[] = ['narrow', 'book', 'wide'];
export const TEXT_WIDTH_LABEL: Record<TextWidth, string> = { narrow: 'Narrow', book: 'Book', wide: 'Wide' };
export const TEXT_MEASURE: Record<TextWidth, string> = { narrow: '560px', book: '780px', wide: '1100px' };
export const useTextWidth = () => useStoredChoice<TextWidth>('hanzi.reader.width', TEXT_WIDTHS, 'book');

/** How a chapter is moved through (Aa › Layout): scrolled down, or turned a screen-wide page at a time. */
export type TurnMode = 'scroll' | 'pages';
export const TURN_MODES: TurnMode[] = ['scroll', 'pages'];
export const TURN_LABEL: Record<TurnMode, string> = { scroll: 'Scroll', pages: 'Pages' };
export const useTurnMode = () => useStoredChoice<TurnMode>('hanzi.reader.turn', TURN_MODES, 'scroll');
