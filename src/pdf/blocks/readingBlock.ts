import type { SheetOptions } from '../../domain/sheet';
import type { TeachCard } from '../../domain/teach';
import { genreLabel, levelLabel, type GeneratedText } from '../../domain/text';
import type { Sheet } from '../draw';
import { contentLeft, contentWidth } from '../layout/page';
import { T } from '../theme';

/**
 * The reading sheet.
 *
 * Not a practice grid: a page of text you can actually read, set the way a
 * textbook sets a passage — what is new stated before you meet it, the reading
 * above the line, the translation under it, and the grammar the passage was
 * built to show collected at the end, where it belongs once you have read it
 * rather than before.
 */

export interface Flow {
  /** the sheet being drawn on now */
  s: Sheet;
  /** current baseline, from the top of the page */
  y: number;
  /** starts a new page and resets `y` */
  page: () => void;
  /** the lowest y anything may be drawn at */
  bottom: number;
}

export interface ReadingCtx {
  /** the characters this passage introduces, with their readings */
  cards: TeachCard[];
  /** show the pinyin line above each sentence */
  pinyin?: boolean;
  /** show the English under each sentence */
  english?: boolean;
}

const LINE = { py: 10.5, zh: 26, en: 13, gap: 8 };

/** Makes sure `need` points of room exist, breaking the page if they do not. */
function room(f: Flow, need: number) {
  if (f.y + need > f.bottom) f.page();
}

const firstSense = (s: string) => s.split(/[;,]/)[0].trim();

/**
 * What is new, before you meet it.
 *
 * Two columns of glyph, reading and meaning. Printed at the top rather than
 * the bottom because the whole bargain of the passage is that you can read it
 * in one pass: three characters you have never seen are fine if you were told
 * what they were thirty seconds ago, and a wall if you were not.
 */
function drawTeachPanel(f: Flow, cards: TeachCard[]) {
  if (!cards.length) return;
  const x0 = contentLeft;
  const cols = cards.length > 3 ? 2 : 1;
  const colW = (contentWidth - 20) / cols;
  const rows = Math.ceil(cards.length / cols);
  const rowH = 30;

  room(f, 22 + rows * rowH);
  f.s.label('NEW IN THIS TEXT', x0, f.y, contentWidth, `${cards.length}`);
  f.y += 8;

  const top = f.y;
  cards.forEach((card, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = x0 + col * (colW + 20);
    const y = top + row * rowH;
    const s = f.s;

    s.headBox(x, y, 22, 'blank');
    s.glyphOrText(card.c, x, y, 22);

    const tx = x + 28;
    s.text(card.py, tx, y + 9, {
      size: T.small,
      color: s.st.accentReading ? s.c.accent : s.c.ink2,
      maxWidth: colW - 30,
    });
    s.text(firstSense(card.def), tx, y + 18.5, {
      size: T.small,
      color: s.c.ink,
      maxWidth: colW - 30,
    });
    const w = card.words[0];
    if (w) {
      s.text(`${w.w} ${w.py}`, tx, y + 27, {
        size: T.label + 0.6,
        color: s.c.ink3,
        maxWidth: colW - 30,
      });
    }
  });
  f.y = top + rows * rowH + 10;
}

export function drawReading(
  text: GeneratedText,
  o: SheetOptions,
  f: Flow,
  ctx: ReadingCtx = { cards: [] },
) {
  const x0 = contentLeft;
  const x1 = contentLeft + contentWidth;
  const width = contentWidth;
  const showPy = ctx.pinyin !== false;
  const showEn = ctx.english !== false;

  // ------------------------------------------------------------------ title
  const s = () => f.s;
  s().text(text.titleZh || text.title, x0, f.y + 18, { size: 19 });
  f.y += 32;
  s().text(text.title, x0, f.y, {
    size: T.lead,
    color: s().st.accentReading ? s().c.accent : s().c.ink2,
    maxWidth: width,
  });
  f.y += 13;
  const facts = [
    text.topic,
    `${genreLabel(text.genre).toLowerCase()}, ${levelLabel(text.level).toLowerCase()}`,
    `${text.lines.length} sentences`,
    text.teach.length
      ? `${text.teach.length} new characters`
      : `built from ${text.basis.length} you know`,
  ].filter(Boolean);
  s().text(facts.join('   ·   '), x0, f.y + 7, {
    size: T.small,
    color: s().c.ink3,
    maxWidth: width,
  });
  f.y += 15;
  s().line(x0, f.y, x1, f.y, { width: 0.5, color: s().c.rule });
  f.y += 20;

  drawTeachPanel(f, ctx.cards);

  // ------------------------------------------------------------------ lines
  const indent = 20;
  const teachSet = new Set(text.teach);
  text.lines.forEach((line, i) => {
    const h =
      (showPy ? LINE.py : 0) + LINE.zh + (showEn ? LINE.en : 0) + LINE.gap;
    room(f, h);
    const cur = f.s;
    const zhY = f.y + (showPy ? LINE.py : 0) + 18;
    cur.text(String(i + 1), x0, zhY - 12, { size: T.micro, color: cur.c.ink3 });
    if (showPy && line.py) {
      cur.text(line.py, x0 + indent, f.y + LINE.py, {
        size: T.small,
        color: cur.st.accentReading ? cur.c.accent : cur.c.ink2,
        maxWidth: width - indent,
      });
    }
    // The sentence, drawn character by character so the new ones can be
    // underlined where they fall. A sentence too long for the measure falls
    // back to the plain call, which shrinks to fit rather than running off the
    // page — losing the underline is better than losing the words.
    const fits = cur.measure(line.zh, 15) <= width - indent;
    if (!fits) {
      cur.text(line.zh, x0 + indent, zhY, { size: 15, maxWidth: width - indent });
    } else {
      let cx = x0 + indent;
      for (const ch of line.zh) {
        const w = cur.text(ch, cx, zhY, { size: 15 });
        if (teachSet.has(ch)) {
          cur.line(cx, zhY + 3, cx + w, zhY + 3, { width: 0.5, color: cur.c.accent });
        }
        cx += w;
      }
    }
    if (showEn && line.en) {
      cur.text(line.en, x0 + indent, zhY + 16, {
        size: T.small,
        color: cur.c.ink2,
        maxWidth: width - indent,
      });
    }
    f.y += h;
  });

  // ------------------------------------------------------------------ words
  if (text.vocab.length) {
    room(f, 60);
    f.y += 12;
    f.s.label('WORDS IN THIS TEXT', x0, f.y, width);
    f.y += 16;
    const cols = 2;
    const colW = (width - 18) / cols;
    const rows = Math.ceil(text.vocab.length / cols);
    const rowH = 17;
    room(f, Math.min(rows, 6) * rowH);
    const top = f.y;
    text.vocab.forEach((w, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const x = x0 + col * (colW + 18);
      const y = top + row * rowH;
      // A dot for a word built out of one of this passage's new characters:
      // the ones to copy into a notebook, if only some of them get copied.
      if (w.isNew) {
        f.s.rect(x - 6, y - 3.4, 2.6, 2.6, { fill: f.s.c.accent });
      }
      let cx = x + f.s.text(w.w, x, y, { size: 11 }) + 7;
      cx +=
        f.s.text(w.py, cx, y - 0.5, {
          size: T.small,
          color: f.s.st.accentReading ? f.s.c.accent : f.s.c.ink2,
          maxWidth: colW * 0.4,
        }) + 8;
      f.s.text(w.d, cx, y - 0.5, {
        size: T.small,
        color: f.s.c.ink2,
        maxWidth: Math.max(24, x + colW - cx),
      });
    });
    f.y = top + rows * rowH + 6;
  }

  // ---------------------------------------------------------------- grammar
  if (text.grammar.length) {
    room(f, 60);
    f.y += 12;
    f.s.label('WHAT THIS TEXT IS SHOWING YOU', x0, f.y, width);
    f.y += 16;
    for (const g of text.grammar) {
      room(f, 40);
      const cur = f.s;
      cur.text(g.point, x0, f.y, { size: T.body, bold: true, maxWidth: width });
      if (g.zh) {
        cur.text(g.zh, x0 + 10, f.y + 13, { size: 11.5, maxWidth: width - 10 });
      }
      if (g.en) {
        cur.text(g.en, x0 + 10, f.y + 24, {
          size: T.small,
          color: cur.c.ink3,
          maxWidth: width - 10,
        });
      }
      f.y += g.zh || g.en ? 34 : 16;
    }
  }

  // ------------------------------------------------------------------- note
  if (text.note.trim()) {
    const h = f.s.paragraph(text.note.trim(), x0 + 10, f.y + 8, width - 14, {
      size: T.small,
      color: f.s.c.ink2,
      maxLines: 4,
      dry: true,
    });
    room(f, h + 22);
    f.y += 10;
    f.s.note(x0, f.y, width - 4, h);
    f.s.paragraph(text.note.trim(), x0 + 10, f.y + 6, width - 14, {
      size: T.small,
      color: f.s.c.ink2,
      maxLines: 4,
    });
    f.y += h + 12;
  }

  // -------------------------------------------------------------- questions
  if (text.questions.length) {
    room(f, 70);
    f.y += 12;
    f.s.label('QUESTIONS', x0, f.y, width);
    f.y += 18;
    for (const q of text.questions) {
      room(f, 46);
      const cur = f.s;
      if (showPy && q.py) {
        cur.text(q.py, x0, f.y, {
          size: T.small,
          color: cur.st.accentReading ? cur.c.accent : cur.c.ink2,
          maxWidth: width,
        });
      }
      cur.text(q.zh, x0, f.y + 15, { size: 12.5, maxWidth: width });
      if (showEn && q.en) {
        cur.text(q.en, x0, f.y + 26, {
          size: T.small,
          color: cur.c.ink3,
          maxWidth: width,
        });
      }
      // A line to answer on, in the same grey as the practice grid.
      cur.line(x0, f.y + 40, x1, f.y + 40, { width: 0.4, color: cur.c.grid });
      f.y += 50;
    }
  }

  // Somewhere to copy a sentence out by hand, if the sheet has room left.
  if (o.practiceRows > 0 && f.bottom - f.y > 70) {
    f.y += 10;
    f.s.label('COPY OUT WHAT YOU WANT TO REMEMBER', x0, f.y, width);
    f.y += 14;
    while (f.bottom - f.y > 26) {
      f.s.line(x0, f.y, x1, f.y, { width: 0.4, color: f.s.c.grid });
      f.y += 26;
    }
  }
}
