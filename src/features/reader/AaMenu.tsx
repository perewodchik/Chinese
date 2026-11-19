import { useEffect, useRef, useState } from 'react';
import { hskLabel } from '../../domain/text';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import {
  PAPER_HAN,
  PAPER_LABEL,
  PAPER_MODES,
  PICTURE_LABEL,
  PICTURE_MODES,
  PINYIN_LABEL,
  PINYIN_MODES,
  TRANSLATION_LABEL,
  TRANSLATION_MODES,
  type GlossMode,
  type PaperMode,
  type PictureMode,
  type PinyinMode,
  type TranslationMode,
  type BookStyleMode,
} from './readerView';
import type { BookStyle } from '../../domain/bookStyle';

const SCALE_MIN = 0.8;
const SCALE_MAX = 1.6;

/** A tenth larger or smaller, kept to one decimal so steps land where they started. */
const stepScale = (at: number, by: number) =>
  Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, at + by * 0.1)) * 10) / 10;

/** Aa: the size, the layout, and the marks — everything about the look that is not pinyin or translation. */
export function AaMenu({
  pinyin,
  setPinyin,
  translation,
  setTranslation,
  hasTrad,
  hasPictures,
  book,
  bookOn,
  setBookOn,
  pictures,
  setPictures,
  paper,
  setPaper,
  glosses,
  setGlosses,
}: {
  pinyin: PinyinMode;
  setPinyin: (m: PinyinMode) => void;
  translation: TranslationMode;
  setTranslation: (m: TranslationMode) => void;
  hasTrad: boolean;
  hasPictures: boolean;
  /** the book's own look, when it has one */
  book: BookStyle | null;
  bookOn: BookStyleMode;
  setBookOn: (m: BookStyleMode) => void;
  pictures: PictureMode;
  setPictures: (m: PictureMode) => void;
  paper: PaperMode;
  setPaper: (m: PaperMode) => void;
  glosses: GlossMode;
  setGlosses: (m: GlossMode) => void;
}) {
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
      <button className="rd-aa-btn" aria-expanded={open} aria-haspopup="dialog" title="How the text looks" aria-label="How the text looks" onClick={() => setOpen((o) => !o)}>
        Aa
      </button>
      {open && (
        <div className="rd-aa-panel" role="dialog" aria-label="How the text looks">
          <div className="rd-aa-papers" role="group" aria-label="Page">
            {PAPER_MODES.map((m) => (
              <button key={m} data-paper={m} aria-pressed={paper === m} onClick={() => setPaper(m)}>
                <span className="hanzi">{PAPER_HAN[m]}</span>
                <small>{PAPER_LABEL[m]}</small>
              </button>
            ))}
          </div>
          <div className="rd-aa-row">
            <span>Pinyin</span>
            <span className="spacer" />
            <div className="seg sm" role="group" aria-label="Pinyin">
              {PINYIN_MODES.map((m) => (
                <button key={m} aria-pressed={pinyin === m} onClick={() => setPinyin(m)}>
                  {PINYIN_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="rd-aa-row">
            <span>
              Translation
              <small>When it is off, hold a sentence for its English.</small>
            </span>
            <span className="spacer" />
            <div className="seg sm" role="group" aria-label="Translation">
              {TRANSLATION_MODES.map((m) => (
                <button key={m} aria-pressed={translation === m} onClick={() => setTranslation(m)}>
                  {TRANSLATION_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="rd-aa-row">
            <span>Text size</span>
            <span className="spacer" />
            <div className="seg sm" role="group" aria-label="Text size">
              <button
                onClick={() => setSettings({ readerScale: stepScale(settings.readerScale, -1) })}
                disabled={settings.readerScale <= SCALE_MIN}
                aria-label="Smaller"
              >
                A−
              </button>
              <button
                onClick={() => setSettings({ readerScale: stepScale(settings.readerScale, 1) })}
                disabled={settings.readerScale >= SCALE_MAX}
                aria-label="Larger"
              >
                A+
              </button>
            </div>
          </div>
          <div className="rd-aa-row">
            <span>Layout</span>
            <span className="spacer" />
            <div className="seg sm" role="group" aria-label="Layout">
              <button aria-pressed={settings.readerLayout === 'paragraph'} onClick={() => setSettings({ readerLayout: 'paragraph' })}>
                Paragraphs
              </button>
              <button aria-pressed={settings.readerLayout === 'sentences'} onClick={() => setSettings({ readerLayout: 'sentences' })}>
                Lines
              </button>
            </div>
          </div>
          {hasPictures && (
            <div className="rd-aa-row">
              <span>Pictures</span>
              <span className="spacer" />
              <div className="seg sm" role="group" aria-label="Pictures">
                {PICTURE_MODES.map((m) => (
                  <button key={m} aria-pressed={pictures === m} onClick={() => setPictures(m)}>
                    {PICTURE_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {book && (
            <label className="rd-aa-row">
              <span>
                Book style
                <small>The page dressed as the book, each paragraph against the place it happens in.</small>
              </span>
              <span className="spacer" />
              <input type="checkbox" checked={bookOn === 'on'} onChange={(e) => setBookOn(e.target.checked ? 'on' : 'off')} />
            </label>
          )}
          <label className="rd-aa-row">
            <span>
              New words beside the text
              <small>Each with its pinyin and meaning, by its paragraph.</small>
            </span>
            <span className="spacer" />
            <input type="checkbox" checked={glosses === 'on'} onChange={(e) => setGlosses(e.target.checked ? 'on' : 'off')} />
          </label>
          <label className="rd-aa-row">
            <span>
              Underline what is not known yet
              <small>Red: what your answers say you do not know yet.</small>
            </span>
            <span className="spacer" />
            <input type="checkbox" checked={settings.markUnknown} onChange={(e) => setSettings({ markUnknown: e.target.checked })} />
          </label>
          <label className="rd-aa-row">
            <span>
              Mark words above {hskLabel(settings.targetHsk)}
              <small>Your level is set in Settings.</small>
            </span>
            <span className="spacer" />
            <input type="checkbox" checked={settings.markAbove} onChange={(e) => setSettings({ markAbove: e.target.checked })} />
          </label>
          {hasTrad && (
            <label className="rd-aa-row">
              <span>Traditional characters</span>
              <span className="spacer" />
              <input
                type="checkbox"
                checked={settings.readerTraditional}
                onChange={(e) => setSettings({ readerTraditional: e.target.checked })}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
