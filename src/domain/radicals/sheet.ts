import type { SheetOptions } from '../sheet';

/**
 * What a radical worksheet says.
 *
 * The look — colour, design, squares, how many to trace — is the same set of
 * choices a character sheet offers, stored the same way, because it is the
 * same paper. What goes on the page is not. A radical block is a heading and
 * then a practice row for every way the radical is written, each row opened by
 * a line naming its form: 忄 on the left, three strokes, 快 忙 怕, then squares
 * with 忄 in them; 心 underneath, four strokes, 想 您 忘, then squares with that.
 *
 * So how many share a page decides one thing above all — whether every form
 * gets a row of its own, or the rarer ones share one.
 */

export interface RadicalSheet extends SheetOptions {
  /**
   * A practice row for every way the radical is written, and no empty rows
   * under them.
   *
   * A radical's shapes are the thing worth practising — 忄 and 心 are one
   * radical and two different movements of the hand — so the reference sheet
   * gives each of them a row of its own rather than asking for a number of
   * rows and dividing them up. Most radicals are written one way and get one
   * row; 心 gets three, which is what it needs.
   */
  rowPerForm?: boolean;
}

/** The per-page counts the designer offers, in order. */
export const RADICAL_PER_PAGE = [2, 3, 4, 6];

export const DEFAULT_RADICAL_SHEET: RadicalSheet = {
  perPage: 3,
  gridStyle: 'mizi',
  squareSize: 'medium',
  practiceRows: 3,
  traceCount: 3,
  fadeCount: 2,
  palette: 'cinnabar',
  style: 'classic',
};

/**
 * The reference sheet, which is the only radical sheet there is a button for.
 *
 * Three to a page, each with its shape drawn large, its meaning and reading,
 * the stroke order of every form it has, the characters it turns up in, and a
 * row to write it in. No designer, no options: radicals are looked up and
 * practised once, not collected and printed to a specification, and a page of
 * choices in front of that was a page of choices about nothing.
 */
export const RADICAL_TEMPLATE: RadicalSheet = {
  perPage: 3,
  gridStyle: 'mizi',
  // Few rows on the page, so they may as well be squares worth writing in.
  squareSize: 'large',
  practiceRows: 1,
  rowPerForm: true,
  traceCount: 3,
  fadeCount: 2,
  palette: 'cinnabar',
  style: 'classic',
};

export type RadicalProfileId = 'roomy' | 'standard' | 'compact' | 'drill';

export interface RadicalProfile {
  id: RadicalProfileId;
  /** what the picker says under the number */
  blurb: string;
  /** the line under the heading: how many forms, how often met, what it is about */
  facts: boolean;
  /** the look-alike warning */
  note: boolean;
  /** a line naming each form above its row of squares */
  formLines: boolean;
  /** and under that, how the form differs from the full character */
  tips: boolean;
  /** examples on that line: with their meanings, with readings only, or none */
  examples: 'glossed' | 'read' | 'none';
}

const PROFILES: Record<RadicalProfileId, RadicalProfile> = {
  roomy: {
    id: 'roomy',
    blurb: 'A row for every form, with its stroke order, examples, and how it changes.',
    facts: true,
    note: true,
    formLines: true,
    tips: true,
    examples: 'glossed',
  },
  standard: {
    id: 'standard',
    blurb: 'A row for each of the two commonest forms, with examples and meanings.',
    facts: true,
    note: true,
    formLines: true,
    tips: false,
    examples: 'glossed',
  },
  compact: {
    id: 'compact',
    blurb: 'The forms share their squares. Examples with readings only.',
    facts: true,
    note: false,
    formLines: true,
    tips: false,
    examples: 'read',
  },
  drill: {
    id: 'drill',
    blurb: 'The name and one row of squares, the forms side by side. A drill sheet.',
    facts: false,
    note: false,
    formLines: false,
    tips: false,
    examples: 'none',
  },
};

export function radicalProfileId(perPage: number): RadicalProfileId {
  if (perPage <= 2) return 'roomy';
  if (perPage === 3) return 'standard';
  if (perPage <= 4) return 'compact';
  return 'drill';
}

export const radicalProfile = (perPage: number): RadicalProfile => PROFILES[radicalProfileId(perPage)];

/** What a roomier sheet would say that this one has no room for. */
export function radicalPartsLostAt(perPage: number): string[] {
  const here = radicalProfile(perPage);
  const best = PROFILES.roomy;
  const lost: string[] = [];
  if (best.facts && !here.facts) lost.push('what it is about');
  if (best.note && !here.note) lost.push('the look-alike warning');
  if (best.formLines && !here.formLines) lost.push('the stroke order of each form');
  if (best.tips && !here.tips) lost.push('how each form changes');
  if (here.examples === 'none') lost.push('the example characters');
  else if (here.examples === 'read') lost.push('what the examples mean');
  return lost;
}

/**
 * A stored per-page count, snapped to a choice offered now.
 *
 * Radical sheets used to offer 4, 5, 6 and 8, when a sheet showed one shape per
 * radical. Now that every form has a row, five goes to four rather than six:
 * the forms need the room.
 */
export function clampRadicalPerPage(n: number | undefined): number {
  const v = Math.round(n ?? DEFAULT_RADICAL_SHEET.perPage);
  if (v <= 2) return 2;
  if (v === 3) return 3;
  if (v <= 5) return 4;
  return 6;
}
