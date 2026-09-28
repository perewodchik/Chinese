import { useEffect, useRef, type ReactNode } from 'react';
import type { Library } from '../../data/types';
import { itemForToken } from '../../domain/words';
import { useLibrary } from '../../features/shared/library';
import { useOpenItem } from '../../navigation/itemDrawer';
import { say } from '../../platform/audio/voiceOut';
import type { Line } from '../core/dialogue/source';
import type { NpcCard } from '../core/types';
import { Portrait } from './Portrait';
import { readLine } from './pinyin';
import type { Said, TalkView } from './useTalk';

/** People on the prototype maps have no cards yet: a name by their look. */
const BY_LOOK: Record<string, string> = {
  auntie: '阿姨',
  grandpa: '爷爷',
  kid: '小朋友',
  rider: '外卖小哥',
  tourist: '游客',
  uncle: '大叔',
  woman: '姐姐',
  rabbit: '兔儿爷',
  hero: '我',
};

export const lookOf = (card: NpcCard | null, fallback: string) =>
  card ? (card.look.palette ? `${card.look.sprite}-${card.look.palette}` : card.look.sprite) : fallback;

export function nameOf(card: NpcCard | null, sprite: string): string {
  return card?.name ?? BY_LOOK[sprite.split('-')[0] ?? ''] ?? '路人';
}

/** Plays a line: slowly after 慢一点, and it never throws (no voice is fine). */
export function voice(line: Line, slower = false) {
  void say(line.zh, line.slow || slower ? { pace: 0.75 } : {}).catch(() => undefined);
}

/**
 * One NPC line: every word a button that opens the app's word drawer, the
 * reading over it when 拼 is on. A line with a reading written in the
 * script shows that reading whole, under the line (the build's cut could
 * split a polyphone wrongly).
 */
function SaidLine({ line, lib, pinyin, open }: { line: Line; lib: Library; pinyin: boolean; open: (w: string) => void }) {
  const pieces = readLine(line.zh, lib);
  const manual = pinyin && line.pinyin;
  return (
    <span className="wd-zh" data-py={pinyin && !manual ? '' : undefined}>
      {line.key && (
        <span className="wd-key" title="A key line: pinned to your tasks">
          📌
        </span>
      )}
      {pieces.map((p, i) =>
        p.word ? (
          <button key={i} type="button" className="wd-w" onClick={() => open(p.text)}>
            {pinyin && !manual && <span className="wd-py">{p.py}</span>}
            <span className="han">{p.text}</span>
          </button>
        ) : (
          <span key={i} className="wd-p han">
            {p.text}
          </span>
        ),
      )}
      {manual && <span className="wd-py-line">{line.pinyin}</span>}
    </span>
  );
}

/**
 * The conversation bubble over the bottom of the world (the world does not
 * move): who you talk to, their lines with tappable words, 拼, 🔁, and the
 * talk so far, scrolled to the latest. What you answer with sits in its
 * foot (`children`); a line that expects nothing goes on with a tap.
 */
export function Dialogue({
  view,
  pinyin,
  setPinyin,
  onProceed,
  onClose,
  children,
}: {
  view: TalkView;
  pinyin: boolean;
  setPinyin: (on: boolean) => void;
  onProceed: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const open = (w: string) => openItem(itemForToken(lib, w));
  const list = useRef<HTMLOListElement>(null);
  const last = [...view.history].reverse().find((s): s is Said & { line: Line } => s.who === 'npc' && !!s.line)?.line;
  const name = nameOf(view.npc, view.sprite);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view.history.length, pinyin]);

  // Space / Enter go on at a line that expects nothing; Escape leaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.key === ' ' || e.key === 'Enter') && view.mode !== 'reply') {
        e.preventDefault();
        onProceed();
      } else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.mode, onProceed, onClose]);

  const speakerName = (id: string) => (id === 'hero' ? '我' : id === 'companion' ? '兔儿爷' : id === view.npc?.id || id === view.scene.npc ? name : id);

  return (
    <section className="wd" aria-label={`Talking with ${name}`}>
      <header className="wd-head">
        <Portrait sprite={view.sprite} scale={2} />
        <span className="wd-name han">{name}</span>
        {view.npc && <span className="wd-role tiny">{view.npc.role}</span>}
        <span className="spacer" />
        <button
          type="button"
          className="wd-tool"
          aria-pressed={pinyin}
          onClick={() => setPinyin(!pinyin)}
          aria-label="Show pinyin"
        >
          拼
        </button>
        <button type="button" className="wd-tool" disabled={!last} onClick={() => last && voice(last)} aria-label="Say it again">
          🔁
        </button>
        <button type="button" className="wd-tool" onClick={onClose} aria-label="Leave the conversation">
          ×
        </button>
      </header>
      <ol className="wd-list" ref={list}>
        {view.history.map((s, i) =>
          s.who === 'you' ? (
            <li key={i} className="wd-you han">
              {s.text}
            </li>
          ) : s.line ? (
            <li key={i} className="wd-npc" data-latest={i === view.history.length - 1 ? '' : undefined}>
              {s.line.speaker !== (view.scene.npc ?? '') && s.line.speaker !== view.npc?.id && (
                <span className="wd-who tiny han">{speakerName(s.line.speaker)}</span>
              )}
              <SaidLine line={s.line} lib={lib} pinyin={pinyin} open={open} />
            </li>
          ) : null,
        )}
      </ol>
      <footer className="wd-foot">
        {view.mode === 'reply' ? (
          children
        ) : (
          <button type="button" className="wd-go" onClick={onProceed} autoFocus>
            {view.mode === 'over' ? 'Done' : 'Go on ›'}
          </button>
        )}
      </footer>
    </section>
  );
}
