import { itemForToken } from '../../domain/words';
import { useLibrary } from '../../features/shared/library';
import { useWordKnowledge } from '../../features/words/useWordKnowledge';
import { useOpenItem } from '../../navigation/itemDrawer';
import { gameWords } from './content';
import { readLine } from './pinyin';

/** Punctuation that must not begin a line (closing marks, commas, stops). */
const NO_START = /^[，。、；：？！…）》」』”’,.;:?!)\]]+$/;

/** The parts in line-break groups: a part, and any closing punctuation straight after it. */
function groups<T extends { text: string; word?: unknown }>(parts: T[]): { p: T; i: number }[][] {
  const out: { p: T; i: number }[][] = [];
  parts.forEach((p, i) => {
    const last = out[out.length - 1];
    if (last && !p.word && NO_START.test(p.text.trim())) last.push({ p, i });
    else out.push([{ p, i }]);
  });
  return out;
}

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
      {groups(readLine(zh, lib, gameWords())).map((g, gi) => {
        const parts = g.map(({ p, i }) => {
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
        });
        // punctuation never starts a line: it wraps together with the word before it
        return g.length > 1 ? (
          <span key={`g${gi}`} className="wd-g">
            {parts}
          </span>
        ) : (
          parts[0]
        );
      })}
    </span>
  );
}
