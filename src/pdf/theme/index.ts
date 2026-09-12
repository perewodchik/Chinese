import type { SheetOptions } from '../../domain/sheet';
import { palette, type Colours } from './palettes';
import { style, type SheetStyle } from './styles';

export type { Colours } from './palettes';
export type { SheetStyle } from './styles';
export { PALETTES } from './palettes';
export { STYLES } from './styles';

/**
 * Type scale. Six sizes, each with a job — a page that uses more than that
 * stops having a hierarchy and starts having a list of exceptions.
 */
export const T = {
  hero: 16, // the pinyin reading in the heading
  lead: 10, // the definition; hanzi inside words
  body: 8.6, // running text
  small: 7.6, // glosses, translations
  label: 6.4, // section labels, tracked
  micro: 6.6, // page furniture
} as const;

/** Extra space per character for tracked small caps. */
export const LABEL_TRACKING = 0.55;

export interface SheetTheme {
  c: Colours;
  s: SheetStyle;
}

export const themeOf = (o: SheetOptions): SheetTheme => ({
  c: palette(o.palette),
  s: style(o.style),
});
