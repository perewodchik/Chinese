import { useRef, useState } from 'react';
import { checkHanzi, checkMeaning, checkPinyin, type HanziCheck, type PinyinCheck } from '../../domain/exercises/check';
import type { Exercise } from '../../domain/exercises/generate';
import { say } from '../../platform/audio/voiceOut';
import { FaceView, Settle, useClock, type ExerciseResult } from './parts';

type TypeExercise = Extract<Exercise, { expect: string }>;

const ALIASES = 'hanzi.meaningAliases';

/** Meanings this learner has said were right before, by item — kept on this device. */
function aliasesFor(text: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(ALIASES) ?? '{}') as Record<string, string[]>;
    return all[text] ?? [];
  } catch {
    return [];
  }
}

function keepAlias(text: string, said: string) {
  try {
    const all = JSON.parse(localStorage.getItem(ALIASES) ?? '{}') as Record<string, string[]>;
    all[text] = [...new Set([...(all[text] ?? []), said.trim()])].slice(-10);
    localStorage.setItem(ALIASES, JSON.stringify(all));
  } catch {
    // a private window keeps nothing; the answer still counts this time
  }
}

const TONE_KEYS: Array<{ digit: string; mark: string; name: string }> = [
  { digit: '1', mark: 'ˉ', name: 'first tone' },
  { digit: '2', mark: 'ˊ', name: 'second tone' },
  { digit: '3', mark: 'ˇ', name: 'third tone' },
  { digit: '4', mark: 'ˋ', name: 'fourth tone' },
  { digit: '5', mark: '·', name: 'neutral tone' },
];

/**
 * Hard mode: the answer typed, not picked.
 *
 * Pinyin takes tones as digits, as marks, or from the tone bar over the
 * keyboard, and is checked syllable by syllable — a wrong tone is told apart
 * from a wrong sound, and only costs a "hard". Characters are typed with the
 * system's Chinese keyboard; typing Latin letters is taken as the wrong
 * keyboard, not a wrong answer. A meaning is matched forgivingly, and "I was
 * right" is always there for a sense the dictionary words differently.
 */
export function TypeCard({ ex, onDone }: { ex: TypeExercise; onDone: (r: ExerciseResult[]) => void }) {
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<'right' | 'nearly' | 'wrong' | null>(null);
  const [note, setNote] = useState('');
  const [py, setPy] = useState<PinyinCheck | null>(null);
  const [hz, setHz] = useState<HanziCheck | null>(null);
  const clock = useClock();
  const input = useRef<HTMLInputElement>(null);
  const result = useRef<ExerciseResult | null>(null);
  const settled = verdict !== null;
  const text = ex.ids[0]!.slice(1);

  function settle(ok: boolean, misses: number) {
    result.current = { id: ex.ids[0]!, skill: ex.skill, ok, misses, ms: clock(), tier: ex.tier, weight: ex.weight };
    setVerdict(ok ? (misses ? 'nearly' : 'right') : 'wrong');
    void say(ex.say);
  }

  function submit() {
    if (settled || !value.trim()) return;
    if (ex.kind === 'type-pinyin') {
      const c = checkPinyin(value, ex.expect);
      setPy(c);
      // right sounds with a slip of tone: right, but it cost something
      settle(c.ok || c.tonesOnly, c.ok ? 0 : 1);
      if (c.tonesOnly) setNote('The sounds are right; look at the tones.');
    } else if (ex.kind === 'type-meaning') {
      settle(checkMeaning(value, ex.def ?? ex.expect, aliasesFor(text)), 0);
    } else {
      const c = checkHanzi(value, ex.expect);
      if (!c.anyHanzi) {
        setNote('That is not in characters. Switch to the Chinese keyboard — the 🌐 key — and type the pinyin; pick the characters from the row it offers.');
        return;
      }
      setHz(c);
      settle(c.ok, 0);
    }
  }

  function toneKey(digit: string) {
    setValue((v) => v.replace(/[1-5]$/, '') + digit);
    input.current?.focus();
  }

  const lang = ex.kind === 'type-hanzi' || ex.kind === 'type-dictation' ? 'zh-CN' : 'en';
  const placeholder =
    ex.kind === 'type-pinyin' ? 'e.g. huo3 che1' : ex.kind === 'type-meaning' ? 'in English' : 'in characters';

  return (
    <div className="ex-card" data-kind={ex.kind}>
      <p className="ex-ask">{ex.ask}</p>
      <div className="ex-prompt">
        <FaceView face={ex.prompt} />
      </div>
      <form
        className="ex-type"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={input}
          className="ex-input"
          data-state={verdict ?? undefined}
          lang={lang}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setNote('');
          }}
          placeholder={placeholder}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          readOnly={settled}
          enterKeyHint="done"
          aria-label={ex.ask}
        />
        {!settled && (
          <button type="submit" className="btn primary" disabled={!value.trim()}>
            Check
          </button>
        )}
      </form>
      {ex.kind === 'type-pinyin' && !settled && (
        <div className="ex-tonebar" role="group" aria-label="Tone of the last syllable">
          {TONE_KEYS.map((t) => (
            <button key={t.digit} type="button" className="ex-tone" title={t.name} onMouseDown={(e) => e.preventDefault()} onClick={() => toneKey(t.digit)}>
              <b>{t.mark}</b>
              <i>{t.digit === '5' ? 'light' : t.digit}</i>
            </button>
          ))}
        </div>
      )}
      {py && (
        <div className="ex-syls">
          {py.syllables.map((s, i) => (
            <span key={i} data-state={s.verdict === 'right' ? 'right' : s.verdict === 'tone' ? 'nearly' : 'wrong'}>
              {s.expected}
            </span>
          ))}
        </div>
      )}
      {hz && !hz.ok && (
        <div className="ex-syls">
          {hz.chars.map((c, i) => (
            <span key={i} className="hanzi" data-state={c.ok ? 'right' : 'wrong'} title={c.got ? `you typed ${c.got}` : 'missing'}>
              {c.want}
            </span>
          ))}
        </div>
      )}
      <p className="tiny muted ex-note">{note || ' '}</p>
      <Settle
        verdict={verdict}
        reveal={ex.reveal}
        onNext={settled ? () => result.current && onDone([result.current]) : undefined}
      >
        {verdict === 'wrong' && ex.kind === 'type-meaning' && (
          <button
            type="button"
            className="btn sm"
            onClick={() => {
              keepAlias(text, value);
              if (result.current) onDone([{ ...result.current, ok: true, misses: 0 }]);
            }}
          >
            I was right
          </button>
        )}
      </Settle>
    </div>
  );
}
