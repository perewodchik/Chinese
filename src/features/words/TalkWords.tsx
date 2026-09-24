import { useState } from 'react';
import type { TalkWord } from '../../../shared/talk';
import { wordId } from '../../domain/ids';
import { segment } from '../../domain/segment';
import { wordInfo } from '../../domain/words';
import { useStore } from '../../store/store';
import { keepTalkWord } from '../../store/wordCommands';
import { useToast } from '../../ui/toast';
import { useLibrary } from '../shared/library';
import { useWordKnowledge } from './useWordKnowledge';

/** Enough to learn from a turn without the chips outgrowing the line they are about. */
const MAX_CHIPS = 4;

interface Chip {
  hanzi: string;
  pinyin: string;
  english: string;
}

/**
 * The new words in the partner's turn, each one tap from being learned.
 *
 * Which words are new is worked out here, from what you actually know,
 * rather than taken on trust from the partner's guess at "probably new at
 * this level" — the guess is used only for what a word means in this
 * sentence, and, until anything is known about your words at all, for the
 * list itself. The chips are settled when the turn first shows: keeping one
 * marks it, it does not take it off the line.
 */
export function TalkWords({
  hanzi,
  guessed,
  onSay,
}: {
  hanzi: string;
  guessed?: TalkWord[];
  onSay: (text: string) => void;
}) {
  const lib = useLibrary();
  const toast = useToast();
  const knowledge = useWordKnowledge();
  const collections = useStore((s) => s.collections);

  const [chips] = useState<Chip[]>(() => {
    if (!knowledge.any) return (guessed ?? []).slice(0, MAX_CHIPS);
    const out: Chip[] = [];
    const seen = new Set<string>();
    for (const t of segment(hanzi, lib)) {
      if (!t.word || seen.has(t.text) || knowledge.status(t.text) !== 'new') continue;
      const info = wordInfo(lib, t.text);
      if (!info) continue;
      seen.add(t.text);
      const said = guessed?.find((g) => g.hanzi === t.text);
      out.push({ hanzi: t.text, pinyin: info.py, english: said?.english || info.d });
      if (out.length === MAX_CHIPS) break;
    }
    return out;
  });

  if (!chips.length) return null;
  const kept = (w: string) => collections.some((c) => c.items.includes(wordId(w)));

  return (
    <div className="talk-words">
      {chips.map((w) => {
        const isKept = kept(w.hanzi);
        return (
          <span key={w.hanzi} className="talk-word-kept" data-kept={isKept || undefined}>
            <button className="talk-word" onClick={() => onSay(w.hanzi)} title="Hear it">
              <span className="talk-word-han hanzi" lang="zh-CN">
                {w.hanzi}
              </span>
              <span className="talk-word-py">{w.pinyin}</span>
              <span className="talk-word-en tiny muted">{w.english}</span>
            </button>
            <button
              className="talk-word-add"
              disabled={isKept}
              aria-label={isKept ? `${w.hanzi} is kept to learn` : `Keep ${w.hanzi} to learn`}
              title={isKept ? 'Kept — the Words drill will bring it in' : 'Keep this word to learn'}
              onClick={() => {
                keepTalkWord(wordId(w.hanzi));
                toast(`${w.hanzi} kept — it will come up in Words`);
              }}
            >
              {isKept ? '✓' : '+'}
            </button>
          </span>
        );
      })}
    </div>
  );
}
