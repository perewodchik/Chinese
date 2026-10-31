import { useEffect, useState } from 'react';
import { isHanzi, type GeneratedText } from '../../domain/text';
import { canSpeak, speak, stopSpeaking } from '../../platform/speech';
import { studyText } from '../../store/commands';
import { Icon } from '../../ui/Icon';
import {
  chooseDictationVoice,
  dictationVoice,
  narratedReadings,
  pickReading,
  playLine,
  prepareClips,
  readyClips,
  stopLine,
  type Clips,
  type Narrated,
} from './narratedClips';

/**
 * Dictation: a sentence of the text is said, and written in the notebook
 * without being seen — then shown, to check by eye. The step after copying
 * out, which writes what is seen; this writes what is heard.
 *
 * Nothing is marked right or wrong: the notebook is where the checking
 * happens. On screen there is only how much to write — a square for each
 * character — and the sentence again, as often and as slowly as wanted.
 *
 * Where a narrator has read the text, the sentence is theirs: cut out of the
 * whole reading by its timings, a sentence at a time. Otherwise the device
 * says it.
 */

const RATE = { normal: 0.85, slow: 0.6 } as const;
/** A narrator already speaks at a dictating pace; slow is a little slower, not stretched. */
const NARRATED = { normal: 1, slow: 0.75 } as const;
type Pace = keyof typeof RATE;

/** Where a dictation of this text starts: where the last one stopped, unless that was the end. */
export const dictationStart = (text: GeneratedText) => {
  const d = text.study?.dictated ?? 0;
  return d < text.lines.length ? d : 0;
};

/** Opened by a tap, the first sentence is said inside it. */
export function openDictation(text: GeneratedText) {
  const i = dictationStart(text);
  const clips = dictationVoice() === 'device' ? null : readyClips(text.id);
  if (clips) playLine(clips, i, NARRATED.normal);
  else if (text.lines[i]) speak(text.lines[i]!.zh, { rate: RATE.normal });
}

export function Dictation({ text, onClose }: { text: GeneratedText; onClose: () => void }) {
  const lines = text.lines;
  const total = lines.length;
  const [at, setAt] = useState(() => dictationStart(text));
  const [shown, setShown] = useState(false);
  const [pace, setPace] = useState<Pace>('normal');
  const [device] = useState(canSpeak);
  const [voices, setVoices] = useState<Narrated[]>([]);
  const [choice, setChoice] = useState(() => dictationVoice() ?? '');
  const [clips, setClips] = useState<Clips | null>(() => (dictationVoice() === 'device' ? null : readyClips(text.id)));
  const voice = device || clips !== null;
  const done = at >= total;
  const line = lines[Math.min(at, total - 1)]!;
  const chars = [...line.zh].filter(isHanzi);

  useEffect(() => {
    let live = true;
    void narratedReadings(lines.map((l) => l.zh)).then(
      (list) => live && setVoices(list),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [lines]);

  // The narrator chosen, its audio fetched; the device's voice when none.
  const reading = pickReading(voices, choice || null);
  useEffect(() => {
    if (!reading) {
      if (voices.length || choice === 'device') setClips(null);
      return;
    }
    let live = true;
    prepareClips(text.id, reading).then(
      (c) => live && setClips(c),
      () => live && setClips(null),
    );
    return () => {
      live = false;
    };
  }, [reading, voices.length, choice, text.id]);

  // Said from the tap that asks for it: iOS lets a page speak only inside one.
  const say = (i: number, p: Pace = pace) => {
    const l = lines[i];
    if (!l) return;
    if (clips) playLine(clips, i, NARRATED[p]);
    else speak(l.zh, { rate: RATE[p] });
  };
  const go = (i: number) => {
    const n = Math.max(0, Math.min(total, i));
    setAt(n);
    setShown(false);
    if (n < total) say(n);
    else {
      stopSpeaking();
      stopLine();
    }
  };

  // The place is kept, as sentences written, whenever it moves on.
  useEffect(() => {
    if (at > (text.study?.dictated ?? 0)) studyText(text.id, { dictated: at });
  }, [at, text.id, text.study?.dictated]);

  useEffect(
    () => () => {
      stopSpeaking();
      stopLine();
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const onButton = document.activeElement instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ');
      if (e.key === 'Escape') onClose();
      else if (onButton || done) return;
      else if (e.key === ' ') {
        e.preventDefault();
        say(at);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (shown) go(at + 1);
        else setShown(true);
      } else if (e.key === 'ArrowRight') go(at + 1);
      else if (e.key === 'ArrowLeft') go(at - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="co-scrim" role="dialog" aria-modal="true" aria-label="Dictation">
      <div className="co">
        <header className="co-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={22} />
          </button>
          <div className="co-progress" aria-hidden>
            <i style={{ width: `${(Math.min(at, total) / total) * 100}%` }} />
          </div>
          <span className="small muted co-count">
            {Math.min(at + 1, total)} of {total}
          </span>
        </header>

        {done ? (
          <div className="co-end">
            <span className="cs-seal hanzi">好</span>
            <h2>The whole text, written from dictation</h2>
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="btn" onClick={() => go(0)}>
                From the start again
              </button>
              <button className="btn primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="co-switches">
              <div className="seg sm" role="group" aria-label="Speed">
                {(['slow', 'normal'] as const).map((p) => (
                  <button
                    key={p}
                    aria-pressed={pace === p}
                    onClick={() => {
                      setPace(p);
                      say(at, p);
                    }}
                  >
                    {p === 'slow' ? 'Slow' : 'Normal'}
                  </button>
                ))}
              </div>
              {voices.length > 0 && (
                <select
                  className="dc-voice"
                  aria-label="Voice"
                  value={reading?.n.narratorId ?? 'device'}
                  onChange={(e) => {
                    setChoice(e.target.value);
                    chooseDictationVoice(e.target.value);
                    stopLine();
                    stopSpeaking();
                  }}
                >
                  {voices.map((v) => (
                    <option key={v.n.narratorId} value={v.n.narratorId}>
                      {v.name}
                    </option>
                  ))}
                  {device && <option value="device">Device voice</option>}
                </select>
              )}
              <span className="spacer" />
              <span className="small muted">
                {chars.length} character{chars.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="dc-now">
              <button className="rd-play dc-play" onClick={() => say(at)} disabled={!voice} aria-label="Say it again">
                <Icon name="sound" size={26} />
              </button>
              {!voice && (
                <p className="small muted">This device has no Chinese voice: read the sentence to yourself, or ask someone to. A narrator who has read the text in Listen says it here.</p>
              )}

              {/* How much to write, and once shown, what was said: the squares never move. */}
              <div className="dc-boxes" aria-label={shown ? line.zh : `${chars.length} characters`}>
                {chars.map((c, i) => (
                  <span key={`${at}-${i}`} className="dc-box hanzi">
                    {shown ? c : ''}
                  </span>
                ))}
              </div>
              <div className="dc-check" data-shown={shown || undefined}>
                <p className="hanzi dc-zh">{line.zh}</p>
                <p className="dc-py">{line.py}</p>
                <p className="dc-en">{line.en}</p>
              </div>
            </div>

            <div className="co-actions">
              <button className="btn lg" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Back">
                <Icon name="back" />
              </button>
              {shown ? (
                <button className="btn primary lg co-next" onClick={() => go(at + 1)}>
                  Next
                </button>
              ) : (
                <button className="btn primary lg co-next" onClick={() => setShown(true)}>
                  Show it
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
