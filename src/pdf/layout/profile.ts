import { profileIdFor } from '../../domain/sheet';
import { T } from '../theme';

/**
 * The same layout at four sizes.
 *
 * Nothing about the arrangement changes between them: heading on the left with
 * the reading beside it, two columns of sections, then the squares. What
 * changes is the size of the drawn things and the leading, so three characters
 * a page is the same page read smaller rather than a second design to learn.
 *
 * Every offset a block draws with comes from one of these tables. The version
 * before this carried hardcoded numbers left over from an older type size, and
 * collapsed into itself the first time a label changed.
 */
export interface CharScale {
  /** heading height: the big glyph, the reading, the facts line */
  headH: number;
  /** the square the big glyph sits in */
  box: number;
  boxGap: number;
  /** baselines inside the heading, measured from the top of the block */
  pyY: number;
  defY: number;
  ruleY: number;
  factY: number;
  /** the definition sits beside the reading rather than under it */
  defInline: boolean;

  hero: number;
  lead: number;
  body: number;
  small: number;

  partGlyph: number;
  partRow: number;
  soBox: number;
  wordRow: number;

  /** label baseline to the first content baseline under it */
  labelDrop: number;
  /** space between two sections in a column */
  blockGap: number;
  /** the sections zone to the practice grid */
  gridGap: number;
}

const CHAR: Record<string, CharScale> = {
  solo: {
    headH: 96,
    box: 86,
    boxGap: 22,
    pyY: 20,
    defY: 38,
    ruleY: 54,
    factY: 70,
    defInline: false,
    hero: 18,
    lead: 11,
    body: 9,
    small: 8,
    partGlyph: 18,
    partRow: 20,
    soBox: 27,
    wordRow: 24,
    labelDrop: 13,
    blockGap: 14,
    gridGap: 16,
  },
  full: {
    headH: 80,
    box: 70,
    boxGap: 20,
    pyY: 18,
    defY: 34,
    ruleY: 48,
    factY: 62,
    defInline: false,
    hero: T.hero,
    lead: T.lead,
    body: T.body,
    small: T.small,
    partGlyph: 17,
    partRow: 19,
    soBox: 25,
    wordRow: 23,
    labelDrop: 13,
    blockGap: 13,
    gridGap: 15,
  },
  mid: {
    headH: 67,
    box: 56,
    boxGap: 16,
    pyY: 16,
    defY: 31,
    ruleY: 42,
    factY: 55,
    defInline: false,
    hero: 14,
    lead: 9.6,
    body: 8.2,
    small: 7.3,
    partGlyph: 15,
    partRow: 17.5,
    soBox: 21,
    wordRow: 22,
    labelDrop: 12,
    blockGap: 12,
    gridGap: 13,
  },
  tight: {
    headH: 54,
    box: 44,
    boxGap: 13,
    pyY: 13.5,
    defY: 13.5,
    ruleY: 24,
    factY: 36,
    defInline: true,
    hero: 12.4,
    lead: 9,
    body: 7.7,
    small: 7,
    partGlyph: 13,
    partRow: 16,
    soBox: 18,
    wordRow: 20,
    labelDrop: 10.5,
    blockGap: 10,
    gridGap: 10,
  },
};

export const charScale = (perPage: number): CharScale =>
  CHAR[profileIdFor(perPage)];
