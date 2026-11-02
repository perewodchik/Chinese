import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useTitle } from '../../ui/useTitle';
import { ConversationBlock } from './PartnerPicker';
import './pinyin.css';

/** Talking with Claude: who to talk with, and the conversations kept. */
export function TalkFrontPage() {
  useTitle('Talk with Claude');
  const { hash } = useLocation();

  // Arriving from the conversation's "hear them first": the partners are further down.
  useEffect(() => {
    if (hash === '#partners') document.getElementById('partners')?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <section className="pinyin">
      <div className="page-head">
        <h1>Talk with Claude</h1>
      </div>
      <ConversationBlock />
    </section>
  );
}
