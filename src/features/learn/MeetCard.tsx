import { useEffect, useState } from 'react';
import { itemInfo, sentenceFor } from '../../domain/exercises/items';
import type { ItemId } from '../../domain/ids';
import { partGloss } from '../../domain/library';
import { say } from '../../platform/audio/voiceOut';
import { Glyph } from '../../ui/Glyph';
import { Say } from '../../ui/Say';
import { useLibrary } from '../shared/library';
import { WordPicture } from '../words/WordPicture';

/**
 * Meeting something for the first time: everything worth knowing about it on
 * one card, before a single question is asked.
 *
 * A word: its photo (and for a compound, the sum — 火 fire + 车 car = 火车),
 * the sound, the reading, the meaning, the measure word it takes, and a
 * sentence to meet it in. A character: its strokes drawn once in order, the
 * sound, the meaning, what it is built from and why, the words it is in, and
 * a sentence. The sound plays on its own when the card opens.
 *
 * `known` is what may appear unglossed in the sentence.
 */
export function MeetCard({ id, known, compact }: { id: ItemId; known: ReadonlySet<string>; compact?: boolean }) {
  const lib = useLibrary();
  const info = itemInfo(lib, id);
  const [showPy, setShowPy] = useState(false);

  useEffect(() => {
    if (info) void say(info.text);
    setShowPy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!info) return null;
  const sentence = sentenceFor(lib, info, known) ?? info.ex[0] ?? null;
  const entry = info.kind === 'char' ? lib.byChar.get(info.text) : null;

  return (
    <article className="meet" data-kind={info.kind} data-compact={compact || undefined}>
      <div className="meet-head">
        {info.kind === 'char' ? (
          <StrokePlay char={info.text} />
        ) : (
          <span className="meet-han hanzi" lang="zh-CN" data-len={Math.min(5, info.chars.length)}>
            {info.text}
          </span>
        )}
        <div className="meet-reading">
          <span className="meet-py">
            {info.py} <Say text={info.text} size="lg" />
          </span>
          <span className="meet-gloss">{info.def}</span>
          {info.cl.length > 0 && <span className="tiny muted">counted with {info.cl.slice(0, 2).join('、')}</span>}
          <span className="tiny muted">{info.band ? `HSK ${info.band === 7 ? '7–9' : info.band}` : 'off the HSK lists'}</span>
        </div>
      </div>

      {info.kind === 'word' && <WordPicture word={info.text} compact />}

      {entry && (entry.parts.length > 1 || entry.ety?.hint) && (
        <div className="meet-built">
          <span className="meet-label">How it is built</span>
          {entry.parts.length > 1 && (
            <span className="meet-parts">
              {entry.parts.map((p, i) => (
                <span key={p} className="meet-part">
                  {i > 0 && <span className="meet-plus">+</span>}
                  <Glyph char={p} strokes={lib.strokes} size={34} />
                  <span className="tiny muted">{partGloss(lib.components, entry, p) || lib.byChar.get(p)?.def.split(/[;,]/)[0]}</span>
                </span>
              ))}
            </span>
          )}
          {entry.ety && (
            <span className="small meet-why">
              {entry.ety.type === 'pictophonetic' && entry.ety.semantic && entry.ety.phonetic ? (
                <>
                  <span className="hanzi">{entry.ety.semantic}</span> gives the meaning{entry.ety.hint ? ` (${entry.ety.hint})` : ''} ·{' '}
                  <span className="hanzi">{entry.ety.phonetic}</span> gives the sound
                </>
              ) : (
                entry.ety.hint
              )}
            </span>
          )}
        </div>
      )}

      {entry && entry.words.length > 0 && !compact && (
        <div className="meet-words">
          <span className="meet-label">In words</span>
          {entry.words
            .slice()
            .sort((a, b) => Number([...a.w].every((c) => known.has(c) || c === info.text)) * -1 + Number([...b.w].every((c) => known.has(c) || c === info.text)))
            .slice(0, 3)
            .map((w) => (
              <span key={w.w} className="meet-word">
                <b className="hanzi">{w.w}</b>
                <i>{w.p}</i>
                <span className="tiny muted">{w.d.split(/[;]/)[0]}</span>
              </span>
            ))}
        </div>
      )}

      {sentence && (
        <div
          className="meet-sentence"
          role="button"
          tabIndex={0}
          onClick={() => setShowPy((v) => !v)}
          onKeyDown={(e) => e.key === ' ' && setShowPy((v) => !v)}
          title="Tap for the pinyin"
        >
          <span className="hanzi" lang="zh-CN">
            {sentence.zh}
          </span>
          <span className="meet-sentence-py">{showPy ? sentence.py || ' ' : 'tap for pinyin'}</span>
          <span className="small muted">{sentence.en}</span>
          <span className="meet-sentence-say" onClick={(e) => e.stopPropagation()}>
            <Say text={sentence.zh} />
          </span>
        </div>
      )}
    </article>
  );
}

/** A character drawn once, stroke by stroke, then left standing; tap to draw it again. */
function StrokePlay({ char }: { char: string }) {
  const lib = useLibrary();
  const total = lib.strokes[char]?.s.length ?? 0;
  const [upto, setUpto] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!total) return;
    setUpto(0);
    let n = 0;
    const id = window.setInterval(() => {
      n++;
      setUpto(n);
      if (n >= total) window.clearInterval(id);
    }, 420);
    return () => window.clearInterval(id);
  }, [char, total, run]);

  return (
    <button type="button" className="meet-glyph" onClick={() => setRun((r) => r + 1)} title="Draw it again">
      <Glyph
        char={char}
        strokes={lib.strokes}
        size={132}
        upto={total ? Math.max(1, upto) : undefined}
        color="var(--ink)"
        highlight={upto < total ? 'var(--accent)' : undefined}
      />
    </button>
  );
}
