import { useEffect, useRef, useState } from 'react';
import type { Actor } from '../core/cutscene';
import { speakerOf } from '../core/cutscene';
import { playLine } from './lineVoice';
import { ZhText } from './ZhText';
import './cutscene.css';

/** What the page shows over the world while a cutscene runs (§13 K1). */
export interface CutView {
  letterbox: boolean;
  line: { actor: Actor; zh?: string; en: string; pinyin?: string } | null;
  title: { zh: string; en: string } | null;
  /** 弹幕 flying now, each with a key */
  danmaku: { id: number; text: string; row: number; delay: number }[];
  seal: number;
}

export const EMPTY_CUT: CutView = { letterbox: false, line: null, title: null, danmaku: [], seal: 0 };

/** How long ⏭ must be held (a tap would be too easy to hit by mistake). */
export const SKIP_HOLD_MS = 600;

/**
 * Letterbox bars (moved in by a transform — nothing else on the page moves),
 * the line in a read-only box (words tappable, 拼 works; a tap anywhere
 * else goes on), the chapter card, 弹幕, the seal, and ⏭ held to skip.
 * A word tapped opens the word drawer and the cutscene waits for the tap on.
 */
export function CutsceneOverlay({
  view,
  names,
  pinyin,
  setPinyin,
  onNext,
  onSkip,
}: {
  view: CutView;
  names: (actor: Actor) => string;
  pinyin: boolean;
  setPinyin: (on: boolean) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { line } = view;
  // each line is heard in its speaker's voice as it appears
  useEffect(() => {
    if (!line?.zh) return;
    void playLine({ speaker: speakerOf(line.actor), zh: line.zh, en: line.en, node: '' });
  }, [line]);
  // Space / Enter goes on, as in a talk
  useEffect(() => {
    if (!line) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      onNext();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [line, onNext]);

  return (
    <div className="cs-layer" data-lines={line ? '' : undefined} onClick={() => line && onNext()}>
      <div className="cs-bar cs-top" data-on={view.letterbox ? '' : undefined} aria-hidden />
      <div className="cs-bar cs-bottom" data-on={view.letterbox ? '' : undefined} aria-hidden />
      {view.title && (
        <div className="cs-title" role="status">
          <span className="cs-title-zh han">{view.title.zh}</span>
          <span className="cs-title-en">{view.title.en}</span>
        </div>
      )}
      <div className="cs-danmaku" aria-hidden>
        {view.danmaku.map((d) => (
          <span key={d.id} className="cs-dm han" style={{ top: `${8 + d.row * 9}%`, animationDelay: `${d.delay}ms` }}>
            {d.text}
          </span>
        ))}
      </div>
      {view.seal > 0 && (
        <span key={view.seal} className="cs-seal han" aria-hidden>
          好
        </span>
      )}
      {line && (
        <div className="cs-box" role="dialog" aria-label="Cutscene line" onClick={(e) => e.stopPropagation()}>
          <div className="cs-head">
            <span className="cs-who han">{names(line.actor)}</span>
            <span className="spacer" />
            {line.zh && (
              <button type="button" className="wd-tool" aria-pressed={pinyin} onClick={() => setPinyin(!pinyin)} title="Pinyin">
                拼
              </button>
            )}
          </div>
          <button type="button" className="cs-body" onClick={onNext} aria-label="Go on">
            {line.zh ? (
              <span className="cs-zh" onClick={(e) => e.stopPropagation()}>
                <ZhText zh={line.zh} pinyin={pinyin && !line.pinyin} />
                {pinyin && line.pinyin && <span className="wd-py-line">{line.pinyin}</span>}
              </span>
            ) : null}
            <span className={line.zh ? 'cs-en small muted' : 'cs-en cs-en-only'}>{line.en}</span>
            <span className="cs-next tiny" aria-hidden>
              ▼
            </span>
          </button>
        </div>
      )}
      <SkipButton onSkip={onSkip} />
    </div>
  );
}

/** ⏭ held for 0.6 s: a ring fills while it is held; letting go early does nothing. */
function SkipButton({ onSkip }: { onSkip: () => void }) {
  const [held, setHeld] = useState(false);
  const timer = useRef<number | null>(null);
  const stop = () => {
    setHeld(false);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      className="cs-skip"
      data-held={held ? '' : undefined}
      aria-label="Hold to skip"
      title="Hold to skip"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        setHeld(true);
        timer.current = window.setTimeout(() => {
          stop();
          onSkip();
        }, SKIP_HOLD_MS);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      <span className="cs-skip-ring" aria-hidden />
      <span aria-hidden>⏭</span>
      <span className="cs-skip-label tiny">Hold</span>
    </button>
  );
}
