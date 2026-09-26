import { useState } from 'react';
import { Link } from 'react-router';
import { readPack } from '../../domain/videoPack';
import { answerPrompt, packPrompt } from '../../domain/videoPrompt';
import type { PackSentence } from '../../domain/video';
import { paths } from '../../navigation/paths';
import { saveAsk, saveVideoPack } from '../../store/videoCommands';
import { Say } from '../../ui/Say';
import { useToast } from '../../ui/toast';
import { ClaudeBox } from './ClaudeBox';
import { useLearner } from './hooks';
import { useVideoCtx } from './context';

/**
 * What Claude made of the part: grammar, notes, the lines to listen hardest
 * to, questions, sentences to use it in.
 *
 * Claude reads the transcript — it cannot watch the video — with the
 * learner's words and weak sounds beside it, and answers once per part in a
 * block the app reads back (see videoPrompt.ts). The pack also corrects the
 * pinyin the notebook is checked against, so it is worth asking for before
 * the first check.
 */
export function StudyStep() {
  const { video: v, part, lines, pack, go } = useVideoCtx();
  const learner = useLearner();
  const toast = useToast();
  const [again, setAgain] = useState(false);

  const box = (
    <ClaudeBox
      kind="video"
      primary={!pack}
      label={pack ? 'Prepare it again' : 'Prepare with Claude'}
      what="the study pack"
      prompt={() => packPrompt(v, part, learner)}
      onAnswer={(text) => {
        const { pack: read, problems } = readPack(text, lines, Date.now());
        if (!read) return problems.join(' ');
        saveVideoPack(v.id, part, read);
        setAgain(false);
        if (problems.length) toast(problems[0]!);
        return null;
      }}
    />
  );

  if (!pack) {
    return (
      <div className="video-step">
        <div className="card">
          <header>
            <h2>A study pack for {v.parts.length > 1 ? `part ${part + 1}` : 'this video'}</h2>
          </header>
          <div className="body">
            <p className="small" style={{ marginTop: 0 }}>
              Claude reads the part’s text (it cannot watch the video) with your words and the sounds you mix up, and
              writes: corrected pinyin and English for every line, the tone changes you will hear, the new words worth
              learning now, grammar, notes, the lines hardest to write down, questions, and sentences to use it in.
            </p>
            {box}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-step study-step">
      {pack.level && (
        <p className="small study-level">
          <b>Claude’s view:</b> {pack.level.verdict}. {pack.level.why}
        </p>
      )}

      {pack.grammar.length > 0 && (
        <Card title="Grammar">
          {pack.grammar.map((g, i) => (
            <div key={i} className="study-item">
              <p className="small" style={{ margin: 0 }}>
                <b>{g.pattern}</b> <Lines n={g.lines} /> — {g.explain}
              </p>
              {g.example && <Sentence s={g.example} />}
            </div>
          ))}
        </Card>
      )}

      {pack.notes.length > 0 && (
        <Card title="Good to know">
          {pack.notes.map((n, i) => (
            <p key={i} className="small study-item" style={{ margin: 0 }}>
              {n.text} <Lines n={n.lines} />
            </p>
          ))}
        </Card>
      )}

      {pack.sandhi.length > 0 && (
        <Card title="Tones that change when said">
          {pack.sandhi.map((s, i) => (
            <p key={i} className="small study-item" style={{ margin: 0 }}>
              <Lines n={[s.n]} /> you will hear <b className="study-py">{s.heard}</b> — {s.why}
            </p>
          ))}
        </Card>
      )}

      {pack.questions.length > 0 && (
        <Card title="Questions">
          {pack.questions.map((q, i) => (
            <Question key={i} n={i + 1} q={q.q} answer={q.answer} lines={q.lines} ask={(mine) => answerPrompt(v, part, q.q.zh, mine, learner)} onAnswer={(mine, a) => saveAsk(v.id, part, `${q.q.zh} — my answer: ${mine}`, a)} />
          ))}
          {pack.retell && (
            <div className="study-item">
              <p className="small" style={{ margin: 0 }}>
                <b>Tell it back</b> in 3–4 sentences{pack.retell.words.length ? `, using ${pack.retell.words.join('、')}` : ''}. Out
                loud or in the notebook.
              </p>
              <details className="small">
                <summary>One way to say it</summary>
                <Sentence s={{ zh: pack.retell.zh, py: '', en: pack.retell.en }} />
              </details>
            </div>
          )}
        </Card>
      )}

      {(pack.extra.sentences.length > 0 || pack.extra.topic) && (
        <Card title="Use it">
          {pack.extra.sentences.map((s, i) => (
            <Sentence key={i} s={s} />
          ))}
          {pack.extra.topic && (
            <p className="small" style={{ marginBottom: 0 }}>
              Talk about it: <i>{pack.extra.topic}</i> —{' '}
              <Link to={paths.speakingNew()}>start a conversation</Link>
            </p>
          )}
        </Card>
      )}

      <p className="small">
        The new words from the pack are on <button className="line-ref" onClick={() => go('words')}>Words</button>
        {pack.listening.length ? (
          <>
            ; the lines to listen hardest to are on <button className="line-ref" onClick={() => go('watch')}>Watch</button>
          </>
        ) : null}
        .
      </p>

      <div className="study-again">
        {again ? (
          box
        ) : (
          <button className="btn sm ghost" onClick={() => setAgain(true)}>
            Ask Claude for a new pack
          </button>
        )}
        <span className="tiny muted">Made {new Date(pack.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.</span>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card study-card">
      <header>
        <h2>{title}</h2>
      </header>
      <div className="body">{children}</div>
    </div>
  );
}

function Lines({ n }: { n: number[] }) {
  if (!n.length) return null;
  return <span className="tiny muted">(line {n.join(', ')})</span>;
}

function Sentence({ s }: { s: PackSentence }) {
  return (
    <div className="study-sentence">
      <span className="hanzi">{s.zh}</span> <Say text={s.zh} />
      {s.py && <span className="tiny study-py">{s.py}</span>}
      {s.en && <span className="tiny muted">{s.en}</span>}
    </div>
  );
}

function Question({
  n,
  q,
  answer,
  lines,
  ask,
  onAnswer,
}: {
  n: number;
  q: PackSentence;
  answer: PackSentence;
  lines: number[];
  ask: (mine: string) => string;
  onAnswer: (mine: string, a: string) => void;
}) {
  const [shown, setShown] = useState(false);
  const [mine, setMine] = useState('');
  const [checking, setChecking] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  return (
    <div className="study-item study-question">
      <p className="small" style={{ margin: 0 }}>
        <b>{n}.</b> <span className="hanzi">{q.zh}</span> <Say text={q.zh} />
      </p>
      <details className="tiny muted">
        <summary>pinyin and English</summary>
        {q.py} — {q.en}
      </details>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => setShown(!shown)}>
          {shown ? 'Hide the answer' : 'Show the answer'}
        </button>
        <button className="btn sm ghost" onClick={() => setChecking(!checking)}>
          Check my answer
        </button>
      </div>
      {shown && (
        <p className="small study-answer">
          <span className="hanzi">{answer.zh}</span> <span className="tiny study-py">{answer.py}</span>{' '}
          <span className="tiny muted">{answer.en}</span> <Lines n={lines} />
        </p>
      )}
      {checking && (
        <div className="study-check">
          <input type="text" placeholder="Your answer, in Chinese or pinyin" value={mine} onChange={(e) => setMine(e.target.value)} />
          <ClaudeBox
            kind="check"
            label="Check it"
            what="an answer"
            disabled={!mine.trim()}
            prompt={() => ask(mine.trim())}
            onAnswer={(a) => {
              setReply(a.trim());
              onAnswer(mine.trim(), a.trim());
              return null;
            }}
          />
          {reply && <p className="small study-reply">{reply}</p>}
        </div>
      )}
    </div>
  );
}
