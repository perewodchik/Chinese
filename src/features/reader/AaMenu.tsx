import { useEffect, useRef, useState } from 'react';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import {
  HAN_FONT_HAN,
  HAN_FONT_LABEL,
  HAN_FONT_STACK,
  HAN_FONTS,
  LINE_SPACING_LABEL,
  LINE_SPACINGS,
  PAPER_HAN,
  PAPER_LABEL,
  PAPER_MODES,
  PICTURE_LABEL,
  PICTURE_MODES,
  PINYIN_LABEL,
  PINYIN_MODES,
  TEXT_WIDTH_LABEL,
  TEXT_WIDTHS,
  TRANSLATION_LABEL,
  TRANSLATION_MODES,
  TURN_LABEL,
  TURN_MODES,
  type TurnMode,
  type HanFont,
  type LineSpacing,
  type PaperMode,
  type PictureMode,
  type PinyinMode,
  type TextWidth,
  type TranslationMode,
} from './readerView';

const SCALE_MIN = 0.8;
const SCALE_MAX = 1.6;

export interface AaChoices {
  pinyin: PinyinMode;
  setPinyin: (m: PinyinMode) => void;
  translation: TranslationMode;
  setTranslation: (m: TranslationMode) => void;
  pictures: PictureMode;
  setPictures: (m: PictureMode) => void;
  paper: PaperMode;
  setPaper: (m: PaperMode) => void;
  font: HanFont;
  setFont: (m: HanFont) => void;
  spacing: LineSpacing;
  setSpacing: (m: LineSpacing) => void;
  width: TextWidth;
  setWidth: (m: TextWidth) => void;
  turn: TurnMode;
  setTurn: (m: TurnMode) => void;
}

/**
 * Aa: how the page looks, in groups — the page, the type, the help on it,
 * and the layout. On a phone it rises from the bottom over half the screen
 * and leaves the text above it undimmed, so a change of size or type shows
 * on the text while the panel is open; on a wider screen it drops from the
 * button.
 *
 * Gone from it, at the learner's asking: Book style, Traditional characters,
 * Paragraphs/Lines, new words beside the text, and marking words above the
 * level (the red underline already says what is new).
 */
export function AaMenu({ hasPictures, ...c }: AaChoices & { hasPictures: boolean }) {
  const settings = useStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="rd-aa" ref={root}>
      <button className="rd-aa-btn" aria-expanded={open} aria-haspopup="dialog" title="How the page looks" aria-label="How the page looks" onClick={() => setOpen((o) => !o)}>
        Aa
      </button>
      {open && (
        <div className="rd-aa-panel" role="dialog" aria-label="How the page looks">
          <span className="rd-aa-grab" aria-hidden />
          <section className="rd-aa-sec" aria-label="Page">
            <h3>Page</h3>
            <div className="rd-aa-papers" role="group" aria-label="Page">
              {PAPER_MODES.map((m) => (
                <button key={m} data-paper={m} aria-pressed={c.paper === m} onClick={() => c.setPaper(m)}>
                  <span className="hanzi">{PAPER_HAN[m]}</span>
                  <small>{PAPER_LABEL[m]}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="rd-aa-sec" aria-label="Type">
            <h3>Type</h3>
            <div className="rd-aa-size">
              <span className="hanzi" aria-hidden style={{ fontSize: 16 }}>
                字
              </span>
              <input
                type="range"
                min={SCALE_MIN}
                max={SCALE_MAX}
                step={0.1}
                value={settings.readerScale}
                aria-label="Text size"
                onChange={(e) => setSettings({ readerScale: Math.round(Number(e.target.value) * 10) / 10 })}
              />
              <span className="hanzi" aria-hidden style={{ fontSize: 26 }}>
                字
              </span>
            </div>
            <div className="rd-aa-fonts" role="group" aria-label="Typeface">
              {HAN_FONTS.map((f) => (
                <button key={f} aria-pressed={c.font === f} onClick={() => c.setFont(f)}>
                  <span style={{ fontFamily: HAN_FONT_STACK[f] }}>读书</span>
                  <small>
                    {HAN_FONT_LABEL[f]} <span className="hanzi">{HAN_FONT_HAN[f]}</span>
                  </small>
                </button>
              ))}
            </div>
            <Row label="Line spacing">
              <Seg value={c.spacing} options={LINE_SPACINGS} label={(v) => LINE_SPACING_LABEL[v]} onPick={c.setSpacing} name="Line spacing" />
            </Row>
            <Row label="Width" hint="How wide the text runs on a wide screen.">
              <Seg value={c.width} options={TEXT_WIDTHS} label={(v) => TEXT_WIDTH_LABEL[v]} onPick={c.setWidth} name="Width" />
            </Row>
          </section>

          <section className="rd-aa-sec" aria-label="Help on the page">
            <h3>Help on the page</h3>
            <Row label="Pinyin" hint="New: only over the words you do not know yet.">
              <Seg value={c.pinyin} options={PINYIN_MODES} label={(v) => PINYIN_LABEL[v]} onPick={c.setPinyin} name="Pinyin" />
            </Row>
            <Row label="Translation" hint="When it is off, hold a sentence for its English.">
              <Seg value={c.translation} options={TRANSLATION_MODES} label={(v) => TRANSLATION_LABEL[v]} onPick={c.setTranslation} name="Translation" />
            </Row>
            <label className="rd-aa-row">
              <span>
                Underline new words
                <small>In red, where your answers say you do not know them yet.</small>
              </span>
              <input type="checkbox" checked={settings.markUnknown} onChange={(e) => setSettings({ markUnknown: e.target.checked })} />
            </label>
          </section>

          <section className="rd-aa-sec" aria-label="Layout">
            <h3>Layout</h3>
            <Row label="Turning" hint="Pages: swipe, or tap the left or right edge.">
              <Seg value={c.turn} options={TURN_MODES} label={(v) => TURN_LABEL[v]} onPick={c.setTurn} name="Turning" />
            </Row>
            {hasPictures && (
              <Row label="Pictures">
                <Seg value={c.pictures} options={PICTURE_MODES} label={(v) => PICTURE_LABEL[v]} onPick={c.setPictures} name="Pictures" />
              </Row>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rd-aa-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </div>
  );
}

function Seg<T extends string>({ value, options, label, onPick, name }: { value: T; options: readonly T[]; label: (v: T) => string; onPick: (v: T) => void; name: string }) {
  return (
    <div className="seg sm" role="group" aria-label={name}>
      {options.map((m) => (
        <button key={m} aria-pressed={value === m} onClick={() => onPick(m)}>
          {label(m)}
        </button>
      ))}
    </div>
  );
}
