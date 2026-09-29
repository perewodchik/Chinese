import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../features/shared/library';
import { useWordKnowledge } from '../../features/words/useWordKnowledge';
import { canRecognise, listen, RECOGNITION_MESSAGE, type Listening } from '../../platform/audio/recognition';
import { buildIme, type ImeIndex } from '../core/ime';
import type { Hint, InputMode } from '../core/types';
import { pinyinOf } from './pinyin';
import { PixelIcon } from './PixelIcon';
import { PropSprite } from './PropSprite';
import { STICKERS } from '../core/photo';
import { ASKS, askMeaning, deviceInput, fieldCandidates, hintChips, isHold, pickCandidate, rememberInput, startMode } from './typing';

let imeIndex: ImeIndex | null = null;

type Voice =
  | { phase: 'idle'; error?: string }
  | { phase: 'listening'; text: string }
  | { phase: 'heard'; text: string };

/**
 * What you answer with (concept §11): `[mic|keys] [field / talk] [stickers] [send]`,
 * one row above it that is always there, so nothing moves.
 *
 * Keyboard: a plain field (the system Chinese keyboard works), with the
 * game's own pinyin input — type `ditie`, pick 地铁 from the row above; ↑ in
 * an empty field brings back what you said last.
 * Voice: tap to talk and tap to stop, or hold and let go. What was heard is
 * never sent by itself: it waits in hanzi and pinyin, with once more / change
 * / throw away in the row above, until you send it (➤ or Enter).
 * The row above, in order: stickers when open, pinyin candidates, the hint
 * 兔儿爷 gave (chips), and otherwise the things you can always say to them —
 * 再说一遍 · 慢一点 · 听不懂 · 「…是什么意思？」 — sent as your line when tapped.
 */
export function InputBar({
  onSend,
  onSticker,
  hint,
  hintStep,
  asks,
  saved,
  setSaved,
}: {
  onSend: (text: string, via: InputMode) => void;
  /** send a sticker instead of words (X6); without it there is no sticker button (成语 Practise) */
  onSticker?: (id: string) => void;
  hint?: Hint;
  /** how far 兔儿爷's hint has gone at this line: its chips show above the field */
  hintStep: number;
  /** the words of their turn, to ask about; without it there is no row of things to say (成语 Practise) */
  asks?: readonly string[];
  saved: InputMode;
  setSaved: (m: InputMode) => void;
}) {
  const lib = useLibrary();
  const listenable = canRecognise();
  const [mode, setMode] = useState<InputMode>(() => startMode(deviceInput(), saved, listenable));
  const [text, setText] = useState('');
  const [stickers, setStickers] = useState(false);
  const [asking, setAsking] = useState(false);
  const [voice, setVoice] = useState<Voice>({ phase: 'idle' });
  const field = useRef<HTMLInputElement>(null);
  const mic = useRef<Listening | null>(null);
  const pressed = useRef(0);
  const last = useRef('');

  const ime = useMemo(() => (imeIndex ??= buildIme(lib)), [lib]);
  // the words you do not know yet come first: those are the ones to ask about
  const known = useWordKnowledge();
  const askable = useMemo(
    () => (asks && known.any ? [...asks].sort((a, b) => Number(known.status(a) === 'known') - Number(known.status(b) === 'known')) : (asks ?? [])),
    [asks, known],
  );
  const cands = mode === 'keyboard' ? fieldCandidates(text, ime, 10) : [];
  const chips = hintChips(hint, hintStep);

  useEffect(() => () => mic.current?.cancel(), []);
  // a new turn of theirs: the word list starts over
  useEffect(() => setAsking(false), [asks]);

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
    last.current = clean;
    onSend(clean, via);
    setText('');
    setVoice({ phase: 'idle' });
  };
  /** a thing you can always say: sent as it is, what is in the field stays */
  const say = (t: string) => {
    setAsking(false);
    onSend(t, 'keyboard');
  };

  // --- voice: tap to talk and tap to stop, or hold and let go
  const start = () => {
    if (!listenable) return;
    mic.current?.cancel();
    setVoice({ phase: 'listening', text: '' });
    const session = listen((t) => setVoice((v) => (v.phase === 'listening' ? { ...v, text: t } : v)), 30_000);
    mic.current = session;
    session.result.then(
      (t) => {
        if (mic.current !== session) return;
        mic.current = null;
        setVoice({ phase: 'heard', text: t });
      },
      (e: Error) => {
        if (mic.current !== session) return;
        mic.current = null;
        setVoice(e.message === 'aborted' ? { phase: 'idle' } : { phase: 'idle', error: RECOGNITION_MESSAGE[e.message] ?? 'Nothing was heard. Tap and try again.' });
      },
    );
  };
  const press = () => {
    if (voice.phase === 'listening') {
      // the second tap
      pressed.current = 0;
      mic.current?.stop();
      return;
    }
    pressed.current = Date.now();
    start();
  };
  const release = () => {
    if (!pressed.current) return;
    const held = isHold(Date.now() - pressed.current);
    pressed.current = 0;
    if (held) mic.current?.stop();
  };
  const edit = (t: string) => {
    setVoice({ phase: 'idle' });
    setText(t);
    setMode('keyboard');
    window.setTimeout(() => field.current?.focus(), 0);
  };
  const discard = () => {
    mic.current?.cancel();
    mic.current = null;
    setVoice({ phase: 'idle' });
  };

  // What was heard: Enter sends it, Escape throws it away (before the talk hears Escape and closes).
  const heard = voice.phase === 'heard' ? voice.text : null;
  useEffect(() => {
    if (heard === null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        send(heard, 'voice');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        discard();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heard]);

  const put = (t: string) => {
    if (mode === 'voice') return; // in voice mode the chips are there to be read aloud
    setText((v) => v + t);
    field.current?.focus();
  };

  const row = stickers
    ? 'stickers'
    : cands.length
      ? 'candidates'
      : voice.phase === 'heard'
        ? 'heard'
        : chips.length
          ? 'hint'
          : voice.phase === 'idle' && voice.error
            ? 'error'
            : asks
              ? 'say'
              : 'none';

  return (
    <div className="wi">
      <div className="wi-row" aria-label={{ stickers: 'Stickers', candidates: 'Pinyin candidates', heard: 'What was heard', hint: 'Hint', error: 'Listening', say: 'Things you can say', none: '' }[row]}>
        {row === 'stickers' &&
          STICKERS.map((st) => (
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
          ))}
        {row === 'candidates' &&
          cands.map((c, i) => (
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
          ))}
        {row === 'heard' && (
          <>
            <span className="wi-note wi-check tiny">Is that what you said?</span>
            <button type="button" className="wi-act" onClick={() => start()}>
              <PixelIcon name="again" /> Again
            </button>
            <button type="button" className="wi-act" onClick={() => heard !== null && edit(heard)}>
              <PixelIcon name="edit" /> Change
            </button>
            <button type="button" className="wi-act" onClick={discard}>
              <PixelIcon name="close" /> Throw away
            </button>
          </>
        )}
        {row === 'hint' &&
          chips.map((c, i) => (
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
        {row === 'error' && voice.phase === 'idle' && <span className="wi-note tiny">{voice.error}</span>}
        {row === 'say' &&
          (asking ? (
            <>
              <button type="button" className="wi-act" onClick={() => setAsking(false)} aria-label="Back">
                ‹
              </button>
              <span className="wi-note tiny">What does … mean?</span>
              {askable.map((w) => (
                <button key={w} type="button" className="wi-chip wi-say" onMouseDown={(e) => e.preventDefault()} onClick={() => say(askMeaning(w))} title={`Ask: ${askMeaning(w)}`}>
                  <span className="han">{w}</span>
                  <span className="wi-chip-py">{pinyinOf(w, lib)}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              {ASKS.map((a) => (
                <button key={a.zh} type="button" className="wi-chip wi-say" onMouseDown={(e) => e.preventDefault()} onClick={() => say(a.zh)} title={`Say: ${a.en}`}>
                  <span className="han">{a.zh}</span>
                  <span className="wi-chip-py">{pinyinOf(a.zh, lib)}</span>
                </button>
              ))}
              {(asks?.length ?? 0) > 0 && (
                <button type="button" className="wi-chip wi-say" onMouseDown={(e) => e.preventDefault()} onClick={() => setAsking(true)} title="Ask what a word means">
                  <span className="han">…是什么意思？</span>
                  <span className="wi-chip-py">… shì shénme yìsi</span>
                </button>
              )}
            </>
          ))}
      </div>
      <div className="wi-main">
        <span className="wi-mode" role="group" aria-label="Answer by">
          <button
            type="button"
            aria-pressed={mode === 'voice'}
            disabled={!listenable}
            aria-label="Talk"
            title={listenable ? 'Talk' : 'This browser cannot listen — type instead'}
            onClick={() => choose('voice')}
          >
            <PixelIcon name="mic" size={14} />
          </button>
          <button type="button" aria-pressed={mode === 'keyboard'} aria-label="Type" title="Type" onClick={() => choose('keyboard')}>
            <PixelIcon name="keys" size={14} />
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
              } else if (e.key === 'ArrowUp' && !text && last.current) {
                e.preventDefault();
                setText(last.current);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                send(text, 'keyboard');
              }
            }}
            placeholder="Chinese or pinyin…"
            lang="zh"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            autoFocus
          />
        ) : voice.phase === 'heard' ? (
          <button type="button" className="wi-heard" onClick={() => edit(voice.text)} title="Tap to change it">
            <span className="han">{voice.text}</span>
            <span className="wi-chip-py">{pinyinOf(voice.text, lib)}</span>
          </button>
        ) : (
          <button
            type="button"
            className="wi-hold"
            data-on={voice.phase === 'listening' ? '' : undefined}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              press();
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onContextMenu={(e) => e.preventDefault()}
            title="Tap to talk and tap to stop — or hold, and let go when you are done"
          >
            {voice.phase === 'listening' ? (
              <>
                <span className="wi-bars" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                {voice.text ? <span className="han">{voice.text}</span> : <span className="wi-hold-say">Listening…</span>}
              </>
            ) : (
              <span className="wi-hold-say">Tap to talk</span>
            )}
          </button>
        )}
        {onSticker && (
          <button type="button" className="wd-tool wi-tool" aria-pressed={stickers} onClick={() => setStickers((v) => !v)} aria-label="Stickers">
            <PixelIcon name="face" size={14} />
          </button>
        )}
        <button
          type="button"
          className="wd-go wi-send"
          disabled={mode === 'keyboard' ? !text.trim() : voice.phase !== 'heard'}
          onClick={() => (mode === 'keyboard' ? send(text, 'keyboard') : voice.phase === 'heard' && send(voice.text, 'voice'))}
          aria-label="Send"
        >
          <PixelIcon name="send" size={14} />
        </button>
      </div>
    </div>
  );
}
