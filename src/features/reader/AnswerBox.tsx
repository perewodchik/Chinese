import { useState } from 'react';
import type { GeneratedText, TextLine } from '../../domain/text';
import { studyText } from '../../store/commands';

/**
 * Somewhere to answer a question, kept with the text.
 *
 * Saving the answer is answering the question: it counts towards the part,
 * and the answer is there again next time the text is opened, on any device.
 * There is no marking. Asking Claude to grade it meant a copy into a chat and
 * a paste back on the phone, for one line of feedback; the writer's own
 * answer is a tap away instead, to compare with what you wrote.
 */
export function AnswerBox({
  text,
  index,
  question,
}: {
  text: GeneratedText;
  /** the question's place in the text, which is how its answer is kept */
  index: number;
  question: TextLine;
}) {
  const saved = text.study?.answers?.[String(index)] ?? '';
  const [answer, setAnswer] = useState(saved);
  const [showModel, setShowModel] = useState(false);

  const changed = answer.trim() !== saved;
  const empty = !answer.trim();

  function save() {
    studyText(text.id, { answered: [index], answers: { [String(index)]: answer.trim() } });
  }

  return (
    <div className="answer">
      <textarea
        className="answer-input"
        value={answer}
        rows={2}
        placeholder="Your answer, in Chinese if you can. English is fine."
        aria-label={`Your answer to: ${question.zh}`}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <div className="answer-actions">
        <button className="btn sm tonal save-btn" disabled={empty || !changed} onClick={save}>
          {saved && !changed ? 'Saved' : 'Save answer'}
        </button>
        {question.a && (
          <button className="btn quiet sm" onClick={() => setShowModel((s) => !s)} aria-pressed={showModel}>
            Model answer
          </button>
        )}
      </div>

      {showModel && question.a && (
        <p className="answer-model">
          <span className="tiny muted">The writer’s answer</span>
          <span className="hanzi">{question.a}</span>
        </p>
      )}
    </div>
  );
}
