import { rgb } from 'pdf-lib';

/**
 * Print palette. Everything is chosen to stay readable on a cheap mono or
 * colour inkjet: the greys are light enough not to eat toner but dark enough
 * to trace over, and the accent is a muted seal red rather than a pure primary.
 */
export const C = {
  ink: rgb(0.11, 0.1, 0.09),
  accent: rgb(0.72, 0.26, 0.17),
  muted: rgb(0.47, 0.44, 0.41),
  faint: rgb(0.62, 0.59, 0.56),
  rule: rgb(0.86, 0.84, 0.81),
  grid: rgb(0.81, 0.77, 0.73),
  gridInner: rgb(0.87, 0.84, 0.81),
  trace: rgb(0.72, 0.72, 0.72),
  fade: rgb(0.87, 0.87, 0.87),
  hintBg: rgb(0.98, 0.965, 0.945),
  hintBar: rgb(0.83, 0.66, 0.45),
  white: rgb(1, 1, 1),
};

/** Tints used when colouring strokes by which component they belong to. */
export const COMPONENT_COLOURS = [
  rgb(0.72, 0.26, 0.17),
  rgb(0.16, 0.4, 0.47),
  rgb(0.44, 0.34, 0.15),
  rgb(0.35, 0.28, 0.48),
  rgb(0.2, 0.42, 0.28),
];

export const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 38,
  top: 40,
  bottom: 38,
};

export const contentWidth = PAGE.width - PAGE.margin * 2;
export const contentLeft = PAGE.margin;
export const contentRight = PAGE.width - PAGE.margin;
