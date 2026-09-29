import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../features/shared/library';
import { canRecognise, listen, RECOGNITION_MESSAGE, type Listening } from '../../platform/audio/recognition';
import { buildIme, type ImeIndex } from '../core/ime';
import type { Hint, InputMode } from '../core/types';
import { pinyinOf } from './pinyin';
import { PropSprite } from './PropSprite';
import { STICKERS } from '../core/photo';
import { deviceInput, fieldCandidates, hintChips, pickCandidate, rememberInput, startMode } from './typing';

/** how long a heard line waits before it sends itself */
const SEND_AFTER = 1500;

let imeIndex: ImeIndex | null = null;

type Voice =
  | { phase: 'idle'; error?: string }
  | { phase: 'listening'; text: string }
  | { phase: 'heard'; text: string };

/**
 * What you answer with (concept §11): `[🎤|⌨] [field / hold to talk] [💡] [➤]`.
 *
 * Keyboard: a plain field (the system Chinese keyboard works), with the
 * game's own pinyin input — type `ditie`, pick 地铁 from the row above.
 * Voice: hold to talk; what was heard shows in hanzi and pinyin and sends
 * itself after 1.5 s unless you tap it (to edit) or ×. 💡 goes one hint
 * step further each tap and puts the hint above the field as chips.
 * One row above the field is always there, so nothing moves.
 */
export function InputBar({
  onSend,
  onSticker,
  hint,
  hintStep,
  onHint,
  saved,
  setSaved,
}: {
  onSend: (text: string, via: InputMode) => void;
  /** send a sticker instead of words (X6); without it there is no 🙂 (成语 Practise) */
  onSticker?: (id: string) => void;
  hint?: Hint;
  /** how far the hint has gone at this line (the companion may have gone ahead) */
  hintStep: number;
  /** without it there is no 💡 (成语 Practise: the answer is shown after a miss instead) */
  onHint?: () => void;
  saved: InputMode;
  setSaved: (m: InputMode) => void;
}) {
  const lib = useLibrary();
  const listenable = canRecognise();
  const [mode, setMode] = useState<InputMode>(() => startMode(deviceInput(), saved, listenable));
  const [text, setText] = useState('');
  const [stickers, setStickers] = useState(false);
  const [voice, setVoice] = useState<Voice>({ phase: 'idle' });
  const field = useRef<HTMLInputElement>(null);
  const mic = useRef<Listening | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const ime = useMemo(() => (imeIndex ??= buildIme(lib)), [lib]);
  const cands = mode === 'keyboard' ? fieldCandidates(text, ime, 10) : [];
  const chips = hintChips(hint, hintStep);

  useEffect(
    () => () => {
      mic.current?.cancel();
      window.clearTimeout(timer.current);
    },
    [],
  );

  const choose = (m: InputMode) => {
    if (m === 'voice' && !listenable) return;
    setMode(m);
    setSaved(m);
    rememberInput(m);
    if (m === 'keyboard') window.setTimeout(() => field.current?.focus(), 0);
  };

  const send = (t: string, via: InputMode) => {
    const clean = t.trim();
    if (!clean) return;
    onSend(clean, via);
    setText('');
    setVoice({ phase: 'idle' });
  };

  // --- voice: hold to talk
  const down = () => {
    if (!listenable || voice.phase === 'listening') return;
    window.clearTimeout(timer.current);
    setVoice({ phase: 'listening', text: '' });
    const session = listen((t) => setVoice({ phase: 'listening', text: t }), 30_000);
    mic.current = session;
    session.result.then(
      (t) => {
        mic.current = null;
        setVoice({ phase: 'heard', text: t });
        timer.current = window.setTimeout(() => send(t, 'voice'), SEND_AFTER);
      },
      (e: Error) => {
        mic.current = null;
        setVoice(e.message === 'aborted' ? { phase: 'idle' } : { phase: 'idle', error: RECOGNITION_MESSAGE[e.message] ?? 'Nothing was heard. Hold and try again.' });
      },
    );
  };
  const up = () => mic.current?.stop();
  const edit = (t: string) => {
    window.clearTimeout(timer.current);
    setVoice({ phase: 'idle' });
    setText(t);
    setMode('keyboard');
    window.setTimeout(() => field.current?.focus(), 0);
  };
  const cancelHeard = () => {
    window.clearTimeout(timer.current);
    mic.current?.cancel();
    setVoice({ phase: 'idle' });
  };

  const put = (t: string) => {
    if (mode === 'voice') return; // in voice mode the chips are there to be read aloud
    setText((v) => v + t);
    field.current?.focus();
  };

  return (
    <div className="wi">
      <div className="wi-row" aria-label={stickers ? 'Stickers' : cands.length ? 'Pinyin candidates' : 'Hint'}>
        {stickers
          ? STICKERS.map((st) => (
              <button
                key={st.id}
                type="button"
                className="wi-cand"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setStickers(false);
                  onSticker?.(st.id);
                }}
                title={`${st.en} — means ${st.says}`}
              >
                <PropSprite frame={`sticker/${st.id}`} scale={2} label={st.en} />
              </button>
            ))
          : cands.length > 0
          ? cands.map((c, i) => (
              <button
                key={c.text}
                type="button"
                className="wi-cand"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setText(pickCandidate(text, c));
                  field.current?.focus();
                }}
              >
                <span className="han">{c.text}</span>
                {i < 9 && <kbd className="key-hint">{i + 1}</kbd>}
              </button>
            ))
          : chips.map((c, i) => (
              <button
                key={i}
                type="button"
                className="wi-chip"
                data-key={c.key ? '' : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => put(c.text)}
                title={mode === 'voice' ? 'Say this' : 'Put it in the field'}
              >
                <span className="han">{c.text}</span>
                <span className="wi-chip-py">{pinyinOf(c.text, lib)}</span>
              </button>
            ))}
        {!cands.length && !chips.length && voice.phase === 'idle' && voice.error && <span className="wi-note tiny">{voice.error}</span>}
      </div>
      <div className="wi-main">
        <span className="wi-mode" role="group" aria-label="Answer by">
          <button
            type="button"
            aria-pressed={mode === 'voice'}
            disabled={!listenable}
            title={listenable ? 'Talk' : 'This browser cannot listen — type instead'}
            onClick={() => choose('voice')}
          >
            🎤
          </button>
          <button type="button" aria-pressed={mode === 'keyboard'} title="Type" onClick={() => choose('keyboard')}>
            ⌨
          </button>
        </span>
        {mode === 'keyboard' ? (
          <input
            ref={field}
            type="text"
            className="wi-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              const n = Number(e.key);
              if (cands.length && n >= 1 && n <= Math.min(9, cands.length)) {
                e.preventDefault();
                setText(pickCandidate(text, cands[n - 1]!));
              } else if (e.key === ' ' && cands.length && /[a-z0-9]$/i.test(text)) {
                e.preventDefault();
                setText(pickCandidate(text, cands[0]!));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                send(text, 'keyboard');
              }
            }}
            placeholder="Chinese, or pinyin: qing wen…"
            lang="zh"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            autoFocus
          />
        ) : voice.phase === 'heard' ? (
          <span className="wi-heard">
            <button type="button" className="wi-heard-text" onClick={() => edit(voice.text)} title="Tap to change it">
              <span className="han">{voice.text}</span>
              <span className="wi-chip-py">{pinyinOf(voice.text, lib)}</span>
            </button>
            <button type="button" className="wd-tool" onClick={cancelHeard} aria-label="Throw it away">
              ×
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="wi-hold"
            data-on={voice.phase === 'listening' ? '' : undefined}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              down();
            }}
            onPointerUp={up}
            onPointerCancel={up}
            onContextMenu={(e) => e.preventDefault()}
          >
            {voice.phase === 'listening' ? <span className="han">{voice.text || '…'}</span> : 'Hold and talk'}
          </button>
        )}
        {onSticker && (
          <button type="button" className="wd-tool wi-hint" aria-pressed={stickers} onClick={() => setStickers((v) => !v)} aria-label="Stickers">
            🙂
          </button>
        )}
        {onHint && (
          <button type="button" className="wd-tool wi-hint" onClick={onHint} disabled={!hint || hintStep >= 3} aria-label="What do I say?">
            💡
          </button>
        )}
        <button
          type="button"
          className="wd-go wi-send"
          disabled={mode === 'keyboard' ? !text.trim() : voice.phase !== 'heard'}
          onClick={() => (mode === 'keyboard' ? send(text, 'keyboard') : voice.phase === 'heard' && send(voice.text, 'voice'))}
          aria-label="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
