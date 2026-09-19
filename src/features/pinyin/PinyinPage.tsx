import { useMemo } from 'react';
import { Link } from 'react-router';
import { TONE_NAME } from '../../domain/pinyin/contour';
import { singleTones, tonePairs } from '../../domain/pinyin/practice';
import { SOUND_LESSONS } from '../../domain/pinyin/sounds';
import { paths } from '../../navigation/paths';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { hearKey, pairKey, recentScore, sayKey, toneKey, usePinyinMemory, type Tally } from './voice';
import './pinyin.css';

const TONES: Array<{ tone: number; mark: string; shape: string; like: string }> = [
  { tone: 1, mark: 'ā', shape: 'High and level', like: 'A held note — singing “laaa” at the top of your voice.' },
  { tone: 2, mark: 'á', shape: 'Rising', like: 'The “What?” of not having heard somebody.' },
  { tone: 3, mark: 'ǎ', shape: 'Low, dipping', like: 'A tired, slightly creaky “uh-huh”.' },
  { tone: 4, mark: 'à', shape: 'Falling, fast', like: 'A firm “No!” — high, then straight down.' },
];

/** How a recent score reads, as a state the cards and cells can colour by. */
function standing(t: Tally | undefined): { state?: 'right' | 'close' | 'wrong'; text: string } {
  const s = recentScore(t);
  if (s === null) return { text: t?.tries ? `${t.tries} tried` : 'not tried yet' };
  const pct = `${Math.round(s * 100)}%`;
  if (s >= 0.8) return { state: 'right', text: `${pct} lately` };
  if (s >= 0.5) return { state: 'close', text: `${pct} lately` };
  return { state: 'wrong', text: `${pct} lately` };
}

/**
 * The front of the pronunciation section.
 *
 * Tones first, and in pairs, because that is where Mandarin is won or lost: a
 * learner can hit all four tones one at a time and still be hard to follow,
 * since real speech is two- and three-syllable words where each tone starts
 * from wherever the last one left the voice. The map of twenty pairs is the
 * whole curriculum on one screen, and shows at a glance which junctions are
 * holding and which are not.
 */
export function PinyinPage() {
  useTitle('Pronunciation');
  const lib = useLibrary();
  const memory = usePinyinMemory();
  const pairs = useMemo(() => tonePairs(lib), [lib]);
  const singles = useMemo(() => singleTones(lib), [lib]);

  return (
    <section className="pinyin">
      <div className="row" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0 }}>Pronunciation</h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            Say a word and see the shape of your voice against the shape it should have.
          </p>
        </div>
        <div className="spacer" />
        <Link className="btn sm" to={paths.pinyinVoice()}>
          {memory.range ? 'Your voice' : 'Set up your voice'}
        </Link>
      </div>

      {!memory.range && (
        <Link className="voice-invite" to={paths.pinyinVoice()}>
          <span className="voice-invite-mark hanzi" aria-hidden>
            声
          </span>
          <span>
            <b>First, twenty seconds to measure your voice.</b>
            <span className="small muted">
              Say mā má mǎ mà once. Everyone's high and low are different, and the tones are judged against yours.
            </span>
          </span>
          <span className="go">Start →</span>
        </Link>
      )}

      <h2 className="pinyin-label">The four tones, one at a time</h2>
      <div className="tone-cards">
        {TONES.map((t) => {
          const st = standing(memory.tallies[toneKey(t.tone)]);
          const example = singles[t.tone]?.[0];
          return (
            <Link key={t.tone} className="tone-card" to={paths.pinyinPractice(`tone-${t.tone}`)}>
              <span className="tone-card-mark">{t.mark}</span>
              <span className="tone-card-name">
                {TONE_NAME[t.tone]!.replace(/^./, (c) => c.toUpperCase())} tone
                <i>{t.shape}</i>
              </span>
              <span className="tone-card-like">{t.like}</span>
              <span className="tone-card-foot">
                {example && (
                  <span className="tiny muted">
                    <span className="hanzi">{example.word}</span> {example.reading}
                  </span>
                )}
                <span className="tiny standing" data-state={st.state}>
                  {st.text}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <h2 className="pinyin-label">Tone pairs</h2>
      <p className="small muted pinyin-lede">
        Every way two tones meet, with the commonest words that have it. Most of what you will ever say is
        two-syllable words, and this is where tones go wrong.
      </p>
      <div className="pair-map" role="table" aria-label="Tone pairs">
        <div className="pair-row pair-head" role="row">
          <span role="columnheader" className="pair-corner tiny muted">
            then →
          </span>
          {[1, 2, 3, 4, 5].map((b) => (
            <span key={b} role="columnheader" className="pair-axis tiny">
              {b === 5 ? 'neutral' : TONE_NAME[b]}
            </span>
          ))}
        </div>
        {[1, 2, 3, 4].map((a) => (
          <div key={a} className="pair-row" role="row">
            <span role="rowheader" className="pair-axis pair-axis-row tiny">
              {TONE_NAME[a]}
            </span>
            {[1, 2, 3, 4, 5].map((b) => {
              const pair = pairs.find((p) => p.first === a && p.second === b)!;
              const w = pair.words[0];
              const st = standing(memory.tallies[pairKey(pair.id)]);
              if (!w) return <span key={b} role="cell" className="pair-cell" data-empty />;
              return (
                <Link
                  key={b}
                  role="cell"
                  className="pair-cell"
                  data-state={st.state}
                  to={paths.pinyinPractice(`pair-${pair.id}`)}
                  title={`${TONE_NAME[a]} + ${TONE_NAME[b]}: ${pair.words.length} words — ${st.text}`}
                >
                  <span className="pair-word hanzi">{w.word}</span>
                  <span className="pair-py">{w.reading}</span>
                  <span className="pair-meter" aria-hidden>
                    <i style={{ width: `${(recentScore(memory.tallies[pairKey(pair.id)]) ?? 0) * 100}%` }} />
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <h2 className="pinyin-label">Sounds English does not have</h2>
      <p className="small muted pinyin-lede">
        The seven places an English speaker's Mandarin gives itself away. Each one: how the mouth makes it, telling
        it apart by ear, then saying it.
      </p>
      <div className="lesson-cards">
        {SOUND_LESSONS.map((l) => {
          const ear = standing(memory.tallies[hearKey(l.id)]);
          const mouth = standing(memory.tallies[sayKey(l.id)]);
          return (
            <Link key={l.id} className="lesson-card" to={paths.pinyinSounds(l.id)}>
              <span className="lesson-card-mark">{l.mark}</span>
              <span className="lesson-card-name">{l.title}</span>
              <span className="lesson-card-blurb">{l.blurb}</span>
              <span className="lesson-card-foot tiny">
                <span>
                  <span className="muted">Ear </span>
                  <span className="standing" data-state={ear.state}>
                    {ear.state ? ear.text.replace(' lately', '') : '—'}
                  </span>
                </span>
                <span>
                  <span className="muted">Mouth </span>
                  <span className="standing" data-state={mouth.state}>
                    {mouth.state ? mouth.text.replace(' lately', '') : '—'}
                  </span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
