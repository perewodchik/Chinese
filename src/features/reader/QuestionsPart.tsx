import { type GeneratedText } from '../../domain/text';
import { AnswerBox } from './AnswerBox';
import { Section } from './PartSection';

export function QuestionsPart({ text, partId, showPinyin }: { text: GeneratedText; partId: string; showPinyin: boolean }) {
  const answered = new Set(text.study?.answered ?? []);
  return (
    <Section id={partId} han="问" title="Questions" aside={`${answered.size} of ${text.questions.length} answered`}>
      <ol className="rd-questions">
        {text.questions.map((q, i) => (
          <li key={i} data-done={answered.has(i) || undefined}>
            {showPinyin && <p className="rd-q-py">{q.py}</p>}
            <p className="hanzi rd-q-zh">{q.zh}</p>
            {q.en && <p className="rd-q-en">{q.en}</p>}
            <AnswerBox text={text} index={i} question={q} />
          </li>
        ))}
      </ol>
    </Section>
  );
}
