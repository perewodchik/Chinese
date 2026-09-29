import { itemForToken } from '../../domain/words';
import { useLibrary } from '../../features/shared/library';
import { useOpenItem } from '../../navigation/itemDrawer';
import { Say } from '../../ui/Say';
import type { Recap } from '../core/recap';
import { pinyinOf } from './pinyin';
import { Portrait } from './Portrait';
import { useEscape } from './useEscape';
import './cutscene.css';

/**
 * "Last time…" (§13 Q3): a small card over the world after a day away —
 * 兔儿爷's lines on the story, and last session's words as chips: tap one
 * for its card in the word drawer, 🔊 to hear it. One button: Let's go.
 */
export function RecapCard({ recap, onClose }: { recap: Recap; onClose: () => void }) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  useEscape(onClose);
  return (
    <div className="cs-recap-scrim">
      <section className="cs-recap" role="dialog" aria-label="Last time">
        <header className="cs-recap-head">
          <Portrait sprite="rabbit" scale={2} />
          <b className="han">上次</b>
          <span className="small muted">Last time</span>
        </header>
        {recap.lines.map((l, i) => (
          <p key={i} className="small cs-recap-line">
            {l}
          </p>
        ))}
        {recap.words.length > 0 && (
          <ul className="cs-recap-words">
            {recap.words.map((w) => (
              <li key={w}>
                <button type="button" className="chip cs-recap-word" onClick={() => openItem(itemForToken(lib, w))}>
                  <span className="han">{w}</span>
                  <span className="tiny muted">{pinyinOf(w, lib)}</span>
                </button>
                <span className="cs-recap-say">
                  <Say text={w} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn primary sm cs-recap-go" onClick={onClose} autoFocus>
          Let’s go
        </button>
      </section>
    </div>
  );
}
