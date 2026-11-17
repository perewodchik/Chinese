import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

/**
 * The app's own questions, in place of the browser's confirm() and prompt()
 * (R6): those look foreign in Safari on an iPhone, stop the whole page, and
 * prompt() is unreliable in the app added to the home screen. One host, at
 * the app's root, shows one question at a time; the code that asks waits for
 * the answer as it waited for confirm().
 */

export interface AskYesNo {
  title: string;
  message?: string;
  /** the button that says yes: "Delete", "Throw it away" */
  yes: string;
  /** the button that says no; "Keep it" when not given */
  no?: string;
  /** the yes button in the red of something that cannot be undone */
  danger?: boolean;
}

export interface AskText {
  title: string;
  message?: string;
  label: string;
  value?: string;
  yes: string;
  /** names to choose from with a tap, which fill the field */
  choices?: string[];
  /** an empty answer is an answer (for "put it back where it was") */
  allowEmpty?: boolean;
}

type Question = ({ kind: 'yesno' } & AskYesNo & { resolve: (v: boolean) => void }) | ({ kind: 'text' } & AskText & { resolve: (v: string | null) => void });

let show: ((q: Question) => void) | null = null;
const waiting: Question[] = [];

function put(q: Question) {
  if (show) show(q);
  else waiting.push(q);
}

/** A yes-or-no question; resolves true for yes. */
export function ask(q: AskYesNo): Promise<boolean> {
  return new Promise((resolve) => put({ kind: 'yesno', ...q, resolve }));
}

/** A question answered in a line; resolves the text, or null when it was set aside. */
export function askText(q: AskText): Promise<string | null> {
  return new Promise((resolve) => put({ kind: 'text', ...q, resolve }));
}

/** Mounted once, at the app's root. */
export function DialogHost() {
  const [queue, setQueue] = useState<Question[]>([]);
  useEffect(() => {
    show = (q) => setQueue((list) => [...list, q]);
    if (waiting.length) setQueue(waiting.splice(0));
    return () => {
      show = null;
    };
  }, []);
  const q = queue[0];
  if (!q) return null;
  const done = () => setQueue((list) => list.slice(1));
  return q.kind === 'yesno' ? (
    <YesNo
      q={q}
      onAnswer={(v) => {
        q.resolve(v);
        done();
      }}
    />
  ) : (
    <TextQuestion
      q={q}
      onAnswer={(v) => {
        q.resolve(v);
        done();
      }}
    />
  );
}

function YesNo({ q, onAnswer }: { q: AskYesNo; onAnswer: (v: boolean) => void }) {
  return (
    <Modal
      title={q.title}
      onClose={() => onAnswer(false)}
      onConfirm={() => onAnswer(true)}
      footer={
        <div className="row dialog-actions">
          <button className="btn quiet" onClick={() => onAnswer(false)}>
            {q.no ?? 'Keep it'}
          </button>
          <button className={`btn ${q.danger ? 'danger' : 'primary'}`} onClick={() => onAnswer(true)} autoFocus>
            {q.yes}
          </button>
        </div>
      }
    >
      {q.message && <p className="dialog-message">{q.message}</p>}
    </Modal>
  );
}

function TextQuestion({ q, onAnswer }: { q: AskText; onAnswer: (v: string | null) => void }) {
  const [value, setValue] = useState(q.value ?? '');
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);
  const ready = q.allowEmpty || value.trim() !== '';
  const answer = () => ready && onAnswer(value.trim());
  return (
    <Modal
      title={q.title}
      onClose={() => onAnswer(null)}
      onConfirm={answer}
      footer={
        <div className="row dialog-actions">
          <button className="btn quiet" onClick={() => onAnswer(null)}>
            Not now
          </button>
          <button className="btn primary" disabled={!ready} onClick={answer}>
            {q.yes}
          </button>
        </div>
      }
    >
      {q.message && <p className="dialog-message">{q.message}</p>}
      <label className="field">
        {q.label}
        <input ref={field} type="text" value={value} maxLength={120} onChange={(e) => setValue(e.target.value)} />
      </label>
      {q.choices && q.choices.length > 0 && (
        <div className="chips dialog-choices">
          {q.choices.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={value === c} onClick={() => setValue(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
