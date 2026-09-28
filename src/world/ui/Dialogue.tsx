import { useEffect, useRef, useState, type ReactNode } from 'react';
import { playLine } from './lineVoice';
import type { Line } from '../core/dialogue/source';
import type { NpcCard } from '../core/types';
import { Portrait } from './Portrait';
import type { Said, TalkView } from './useTalk';
import { ZhText } from './ZhText';

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

/** Plays a line in its speaker's voice: slowly after 慢一点; it never throws (no voice is fine). */
export function voice(line: Line, slower = false) {
  void playLine(line, slower);
}

/**
 * One NPC line, words tappable. A line with a reading written in the script
 * shows that reading whole, under the line (the build's cut could split a
 * polyphone wrongly).
 */
function SaidLine({ line, pinyin }: { line: Line; pinyin: boolean }) {
  const manual = pinyin && !!line.pinyin;
  const [shown, setShown] = useState(!line.listen);
  if (!shown) {
    return (
      <span className="wd-said wd-listen">
        <span aria-hidden>👂</span>
        <span className="small muted">Listen first — 🔁 to hear it again.</span>
        <button type="button" className="wd-tool wd-show" onClick={() => setShown(true)}>
          Show
        </button>
      </span>
    );
  }
  return (
    <span className="wd-said">
      {line.key && (
        <span className="wd-key" title="A key line: pinned to your tasks">
          📌
        </span>
      )}
      <ZhText zh={line.zh} pinyin={pinyin && !manual} />
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
  names = {},
  pinyin,
  setPinyin,
  onProceed,
  onClose,
  children,
}: {
  view: TalkView;
  /** npc id → name, for other people who speak in a scene */
  names?: Record<string, string>;
  pinyin: boolean;
  setPinyin: (on: boolean) => void;
  onProceed: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const list = useRef<HTMLOListElement>(null);
  const last = [...view.history].reverse().find((s): s is Said & { line: Line } => s.who === 'npc' && !!s.line)?.line;
  const name = view.title ?? nameOf(view.npc, view.sprite);

  // On an iPad the on-screen keyboard covers the bottom of the page without
  // resizing it: lift the bubble by what the visual viewport has lost.
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => setLift(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
    };
  }, []);

  // Each new line is heard as it arrives.
  const heard = useRef({ scene: '', n: 0 });
  useEffect(() => {
    const n = view.history.length;
    if (heard.current.scene !== view.scene.id) heard.current = { scene: view.scene.id, n: 0 };
    if (n > heard.current.n) {
      const s = view.history[n - 1];
      if (s?.who === 'npc' && s.line) voice(s.line);
    }
    heard.current.n = n;
  }, [view.history, view.scene.id]);

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

  const speakerName = (id: string) => (id === 'hero' ? '我' : id === 'companion' ? '兔儿爷' : id === view.npc?.id || id === view.scene.npc ? name : (names[id] ?? id));

  return (
    <section className="wd" aria-label={`Talking with ${name}`} style={lift ? { bottom: lift + 8, maxHeight: `calc(100% - ${lift + 60}px)` } : undefined}>
      <header className="wd-head">
        {view.sprite !== 'sign' && <Portrait sprite={view.sprite} scale={2} />}
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
              {s.line.speaker !== (view.scene.npc ?? '') && s.line.speaker !== view.npc?.id && s.line.speaker !== 'sign' && (
                <span className="wd-who tiny han">{speakerName(s.line.speaker)}</span>
              )}
              <SaidLine line={s.line} pinyin={pinyin} />
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
