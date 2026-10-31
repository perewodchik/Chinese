import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { NarratorDto } from '../../../shared/narration';
import { listNarrators } from '../../api/narration';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { ConversationBlock } from './PartnerPicker';
import { usePinyinMemory } from './voice';
import './pinyin.css';

/**
 * The front of the speaking section: the voices that read texts aloud, then
 * talking with Claude, then the way to the tone and sound drills — which have
 * a page of their own, so this one is not a wall of cards.
 */
export function PinyinPage() {
  useTitle('Speaking');
  const memory = usePinyinMemory();
  const { hash } = useLocation();

  // Arriving from the conversation's "hear them first": the partners are
  // further down the page.
  useEffect(() => {
    if (hash === '#partners') document.getElementById('partners')?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <section className="pinyin">
      <div className="row" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0 }}>Speaking</h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            The voices that read your texts, talking with Claude, and your own tones.
          </p>
        </div>
        <div className="spacer" />
        <Link className="btn sm" to={paths.speakingVoice()}>
          {memory.range ? 'Your voice' : 'Set up your voice'}
        </Link>
      </div>

      <VoicesBlock />

      {!memory.range && (
        <Link className="voice-invite" to={paths.speakingVoice()}>
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

      <ConversationBlock />

      <Link className="voice-invite" to={paths.speakingTones()} style={{ marginTop: 16 }}>
        <span className="voice-invite-mark hanzi" aria-hidden>
          调
        </span>
        <span>
          <b>Tones and sounds</b>
          <span className="small muted">The four tones, the twenty tone pairs, and the sounds English does not have.</span>
        </span>
        <span className="go">Practise →</span>
      </Link>
    </section>
  );
}

/**
 * Voices, at the top: the learner's narrators as rows, each opening Voices,
 * and a way to make one. Before there are any, one invitation.
 */
function VoicesBlock() {
  const [narrators, setNarrators] = useState<NarratorDto[] | null>(null);
  useEffect(() => {
    void listNarrators().then(setNarrators, () => setNarrators([]));
  }, []);

  return (
    <div className="block speaking-voices">
      <div className="block-head">
        <h2 className="block-title">Voices</h2>
        <span className="spacer" />
        <Link className="btn quiet sm" to={paths.speakingNarrators()}>
          {narrators?.length ? 'Manage' : 'Make one'}
        </Link>
      </div>
      {narrators === null ? (
        <div className="speaking-voices-empty" aria-hidden />
      ) : narrators.length === 0 ? (
        <Link className="voice-invite" to={paths.speakingNarrators()}>
          <span className="voice-invite-mark hanzi" aria-hidden>
            读
          </span>
          <span>
            <b>A voice that reads your texts</b>
            <span className="small muted">Describe the voice you want to hear; it reads your texts aloud in Listen.</span>
          </span>
          <span className="go">Voices →</span>
        </Link>
      ) : (
        <ul className="list">
          {narrators.map((n) => (
            <li key={n.id}>
              <Link className="speaking-voice-row" to={paths.speakingNarrators()}>
                <span className="narrator-mark hanzi" aria-hidden>
                  声
                </span>
                <span className="grow">
                  <b>{n.name}</b>
                  <span className="small muted">
                    {n.kind === 'designed' ? 'Made from a description' : 'A MiniMax voice'} · {n.speed}×{n.emotion ? ` · ${n.emotion}` : ''}
                  </span>
                </span>
                <Icon name="chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
