import type { PDFDocument } from 'pdf-lib';
import type { Sheet } from '../draw';
import { T } from '../theme';
import { contentLeft, contentRight, contentWidth, PAGE } from './page';

/**
 * What every sheet has around its blocks, whatever is in them: the line at the
 * top, the line at the foot, and whatever comes between one block and the next.
 *
 * Shared by the character worksheets and the radical sheets so that two kinds
 * of paper coming out of the same printer look like two pages of one thing.
 */

export function header(s: Sheet, title: string, right: string) {
  const st = s.st;
  if (st.header === 'band') {
    // Sized to the title it sits behind: 4pt above the cap height, 4pt below
    // the descender, rather than a 24pt slab with the words pushed to its top.
    s.roundRect(contentLeft - 10, PAGE.top - 11.5, contentWidth + 20, 18, 3, {
      fill: s.c.accentBand,
    });
  } else if (st.header === 'bar') {
    s.rect(contentLeft, PAGE.top - 8.5, 2.4, 11, { fill: s.c.accent });
  }
  const x = st.header === 'bar' ? contentLeft + 9 : contentLeft;
  s.text(title, x, PAGE.top, { size: 10.5, bold: true });
  s.textRight(right, contentRight, PAGE.top, {
    size: T.micro,
    color: st.accentFurniture ? s.c.accent : s.c.ink3,
    tracking: 0.3,
  });
  if (st.header === 'bar' || st.header === 'rule') {
    s.line(contentLeft, PAGE.top + 9, contentRight, PAGE.top + 9, {
      width: st.header === 'rule' ? 0.35 : 0.5,
      color: st.header === 'rule' ? s.c.hair : s.c.rule,
    });
  }
}

export function footer(s: Sheet, left: string, right: string) {
  const y = PAGE.height - PAGE.bottom + 9;
  s.line(contentLeft, y - 11, contentRight, y - 11, { width: 0.35, color: s.c.hair });
  s.text(left, contentLeft, y, { size: T.micro, color: s.c.ink3, tracking: 0.25 });
  s.textRight(right, contentRight, y, { size: T.micro, color: s.c.ink3, tracking: 0.25 });
}

/**
 * What comes between one block and the next.
 *
 * The frame is drawn in the gutter rather than inside the block, which is what
 * lets a design variant add one without moving a single character: the space
 * it uses was already empty.
 */
export function separate(s: Sheet, top: number, slotH: number, spacing: number, first: boolean) {
  switch (s.st.separator) {
    case 'hairline':
      if (!first) {
        s.line(contentLeft, top - spacing / 2, contentRight, top - spacing / 2, {
          width: 0.4,
          color: s.c.hair,
        });
      }
      break;
    case 'topRule': {
      // Mid-gutter, but never inside the heading band that starts 6pt above
      // the block: at five or more to a page half a gutter is only 5pt, and
      // the rule came down across the tint instead of above it.
      const y = Math.min(top - spacing / 2 + 2, top - 8);
      s.line(contentLeft - 6, y, contentRight + 6, y, {
        width: first ? 0 : 0.6,
        color: s.c.rule,
      });
      break;
    }
    case 'frame':
      s.roundRect(
        contentLeft - 7,
        top - Math.min(8, spacing / 2),
        contentWidth + 14,
        slotH + Math.min(16, spacing),
        6,
        { border: s.c.hair, borderWidth: 0.6 },
      );
      break;
    default:
      break;
  }
}

/** The document's own description of itself, for the reader that opens it. */
export function describe(doc: PDFDocument, name: string) {
  doc.setTitle(name);
  doc.setSubject('Chinese handwriting practice');
  doc.setCreator('Hanzi Workshop');
  doc.setProducer('Hanzi Workshop');
}
