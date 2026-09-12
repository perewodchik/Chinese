/** A4, and the box everything is drawn inside. */
export const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 42,
  top: 40,
  bottom: 42,
};

export const contentLeft = PAGE.margin;
export const contentRight = PAGE.width - PAGE.margin;
export const contentWidth = contentRight - contentLeft;

/** Space taken by the page header and the footer line. */
export const HEADER = 26;
export const FOOTER = 18;

/** Vertical space available for blocks, once the header and footer are taken. */
export const bodyTop = PAGE.top + HEADER;
export const bodyHeight = PAGE.height - PAGE.bottom - FOOTER - bodyTop;

/**
 * Air between blocks.
 *
 * Blocks are separated by space rather than by a rule, and how much space
 * depends on how many there are: two big blocks want a clear break between
 * them, eight small ones want the paper back. At a flat 26pt a page of five
 * radicals lost 104pt and had to drop its example characters.
 */
export function blockSpacing(perPage: number): number {
  if (perPage <= 2) return 26;
  if (perPage === 3) return 20;
  if (perPage === 4) return 16;
  if (perPage <= 6) return 13;
  return 10;
}

/** How tall one item's slot is at this many per page. */
export const slotHeight = (perPage: number) =>
  (bodyHeight - blockSpacing(perPage) * (perPage - 1)) / Math.max(1, perPage);
