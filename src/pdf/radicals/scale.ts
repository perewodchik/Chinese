import { radicalProfileId } from '../../domain/radicals/sheet';
import { T } from '../theme';

/**
 * The same radical block at four sizes.
 *
 * Nothing about the arrangement changes between them — heading, then a line
 * for each way the radical is written with its practice row under it. What
 * changes is how big the drawn things are, and at the smallest sizes how many
 * of those lines there is room for.
 */
export interface RadicalScale {
  /** heading height: the big glyph, the meaning, the facts line */
  headH: number;
  /** the square the main form sits in */
  box: number;
  boxGap: number;
  /** baselines inside the heading, from the top of the block */
  nameY: number;
  ruleY: number;
  factY: number;

  lead: number;
  body: number;
  small: number;

  /** a stroke-order box, and the glyph that opens a form line */
  soBox: number;
  /** the form line itself */
  lineH: number;
  /** a second line under it, for how the form differs from the full character */
  tipH: number;
  /** the look-alike warning under the heading */
  noteH: number;
  /** heading to the first form line */
  gridGap: number;
  /**
   * The most room to leave between one form's squares and the next form's
   * line. Only ever spent out of what is left over in the slot, so a size with
   * nothing to spare simply stays as tight as it was.
   */
  rowGap: number;
}

const SCALES: Record<string, RadicalScale> = {
  roomy: {
    headH: 60,
    box: 52,
    boxGap: 18,
    nameY: 16,
    ruleY: 25,
    factY: 38,
    lead: 11.4,
    body: 8.8,
    small: T.small,
    soBox: 20,
    lineH: 25,
    tipH: 12,
    noteH: 14,
    gridGap: 11,
    rowGap: 14,
  },
  standard: {
    headH: 54,
    box: 46,
    boxGap: 16,
    nameY: 15,
    ruleY: 23,
    factY: 35,
    lead: 11,
    body: 8.4,
    small: 7.4,
    soBox: 19,
    lineH: 23,
    tipH: 0,
    noteH: 13,
    gridGap: 10,
    rowGap: 12,
  },
  compact: {
    headH: 47,
    box: 39,
    boxGap: 14,
    nameY: 13.5,
    ruleY: 20.5,
    factY: 32,
    lead: 10.2,
    body: 8,
    small: 7.2,
    soBox: 17,
    lineH: 21,
    tipH: 0,
    noteH: 0,
    gridGap: 9,
    rowGap: 9,
  },
  drill: {
    headH: 38,
    box: 30,
    boxGap: 12,
    nameY: 12,
    ruleY: 18.5,
    factY: 0,
    lead: 9.4,
    body: 7.6,
    small: 7,
    soBox: 14,
    lineH: 0,
    tipH: 0,
    noteH: 0,
    gridGap: 7,
    rowGap: 0,
  },
};

export const radicalScale = (perPage: number): RadicalScale => SCALES[radicalProfileId(perPage)];
