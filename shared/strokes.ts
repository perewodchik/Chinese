/**
 * Stroke outlines the server looks up for characters off the syllabus.
 *
 *   GET /api/strokes?c=圳鹏   → StrokesResponse
 */

/** One character's strokes, in the shape of the built data (`src/data/types.ts` StrokeData). */
export interface StrokeOutline {
  s: string[];
  m?: number[][][];
}

export interface StrokesResponse {
  /** the characters found; one not found is simply absent */
  strokes: Record<string, StrokeOutline>;
}

/** How many characters one request may ask for: a word, or a line of a text. */
export const STROKES_PER_REQUEST = 24;
