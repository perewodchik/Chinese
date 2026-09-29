import { itemForToken } from '../../domain/words';
import { useLibrary } from '../../features/shared/library';
import { useWordKnowledge } from '../../features/words/useWordKnowledge';
import { useOpenItem } from '../../navigation/itemDrawer';
import { gameWords } from './content';
import { readLine } from './pinyin';

/**
 * Chinese in the game's overlay: every word a button that opens the app's
 * word drawer, its reading above it when 拼 is on, and words you do not know
 * yet marked as in the reader (once anything is known about words at all).
 */
export function ZhText({ zh, pinyin, className = 'wd-zh' }: { zh: string; pinyin: boolean; className?: string }) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const known = useWordKnowledge();
  return (
    <span className={className} data-py={pinyin ? '' : undefined}>
      {readLine(zh, lib, gameWords()).map((p, i) => {
        if (!p.word) {
          return (
            <span key={i} className="wd-p han">
              {p.text}
            </span>
          );
        }
        const standing = known.any ? known.status(p.text) : 'known';
        return (
          <button
            key={i}
            type="button"
            className="wd-w"
            data-unknown={standing === 'known' ? undefined : standing}
            onClick={() => openItem(itemForToken(lib, p.text))}
          >
            {pinyin && <span className="wd-py">{p.py}</span>}
            <span className="han">{p.text}</span>
          </button>
        );
      })}
    </span>
  );
}
