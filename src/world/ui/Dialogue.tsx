import { useEffect, useRef, useState, type ReactNode } from 'react';
import { playLine } from './lineVoice';
import type { Line } from '../core/dialogue/source';
import type { NpcCard } from '../core/types';
import { Hearts } from './Hearts';
import { ChoiceRow, DishuPad } from './Doing';
import { PhonePay } from './PhonePay';
import { PixelIcon } from './PixelIcon';
import { Portrait } from './Portrait';
import { PropSprite } from './PropSprite';
import { STICKERS } from '../core/photo';
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
        <span className="small muted">Listen first — the speaker plays it again.</span>
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
 * The conversation box over the bottom of the world (the world does not
 * move), in the game's pixel frame: who you talk to and what they want from
 * you now (`want`, else their role), 拼, and the talk so far, scrolled to the
 * latest — each of their lines with its own speaker to hear it again (no
 * cost: asking *them* again is said, 「再说一遍」), each of yours with a ✓ or
 * a ? for whether they understood. What you answer with sits in its foot
 * (`children`); a line that expects nothing goes on with a tap. Paying, the
 * phone comes out beside the box (under it on a phone), never inside it.
 */
export function Dialogue({
  view,
  names = {},
  hearts,
  want,
  pinyin,
  setPinyin,
  onProceed,
  onClose,
  onPick,
  onTraced,
  balance,
  onPay,
  onDispute,
  children,
}: {
  view: TalkView;
  /** npc id → name, for other people who speak in a scene */
  names?: Record<string, string>;
  /** friendship with the person talked to, when they have been met (X2) */
  hearts?: number;
  /** what they want from you now (`talkWant`), in place of their role */
  want?: string | null;
  pinyin: boolean;
  setPinyin: (on: boolean) => void;
  onProceed: () => void;
  onClose: () => void;
  /** a picture picked, the characters written (X8) */
  onPick: (id: string) => void;
  onTraced: () => void;
  /** paying at a counter (Y2) */
  balance?: number;
  onPay?: (amount: number) => void;
  onDispute?: () => void;
  children?: ReactNode;
}) {
  const list = useRef<HTMLOListElement>(null);
  const last = [...view.history].reverse().find((s): s is Said & { line: Line } => s.who === 'npc' && !!s.line)?.line;
  const paying = view.mode === 'reply' && !!view.state.due && !!onPay && !!onDispute;
  const name = view.title ?? nameOf(view.npc, view.sprite);
  const node = view.scene.nodes.find((n) => n.id === view.state.node);

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

  // Space / Enter go on at a line that expects nothing; R hears the latest line again; Escape leaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.key === ' ' || e.key === 'Enter') && (view.mode === 'tap' || view.mode === 'over')) {
        e.preventDefault();
        onProceed();
      } else if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey && last) {
        e.preventDefault();
        voice(last);
      } else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.mode, onProceed, onClose, last]);

  // The tap that opened the talk ends on the world; its click lands on whatever the box put
  // under the finger ("Done" on a one-line talk) and closed it before it was seen — and a
  // Space that opened it let go on the focused "Go on". A press must begin in the box.
  const armed = useRef(false);
  const arm = () => {
    armed.current = true;
  };

  const speakerName = (id: string) => (id === 'hero' ? '我' : id === 'companion' ? '兔儿爷' : id === 'speaker-box' ? '支付宝' : id === view.npc?.id || id === view.scene.npc ? name : (names[id] ?? id));

  return (
    <div
      className="wd-stage"
      data-phone={paying ? '' : undefined}
      style={lift ? { bottom: lift + 8, maxHeight: `calc(100% - ${lift + 60}px)` } : undefined}
      onPointerDownCapture={arm}
      onKeyDownCapture={arm}
      onClickCapture={(e) => {
        if (armed.current) return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <section className="wd" aria-label={`Talking with ${name}`}>
        <header className="wd-head">
          {view.sprite !== 'sign' && (
            <span className="wd-face">
              <Portrait sprite={view.sprite} scale={2} />
            </span>
          )}
          <span className="wd-plate">
            <span className="wd-name-row">
              <span className="wd-name han">{name}</span>
              {hearts !== undefined && <Hearts n={hearts} />}
            </span>
            {(want || view.npc) && (
              <span className="wd-role tiny" data-want={want ? '' : undefined} title={want ?? view.npc?.role}>
                {want ?? view.npc?.role}
              </span>
            )}
          </span>
          <button type="button" className="wd-tool" aria-pressed={pinyin} onClick={() => setPinyin(!pinyin)} aria-label="Show pinyin" title="Pinyin">
            拼
          </button>
          <button type="button" className="wd-tool" onClick={onClose} aria-label="Leave the conversation" title="Leave (Esc)">
            <PixelIcon name="close" size={14} />
          </button>
        </header>
        <ol className="wd-list" ref={list}>
          {view.history.map((s, i) =>
            s.who === 'you' ? (
              <li key={i} className="wd-you" data-got={s.got === undefined ? undefined : s.got ? 'yes' : 'no'}>
                <span className="han">
                  {s.sticker ? <PropSprite frame={`sticker/${s.sticker}`} scale={3} label={STICKERS.find((x) => x.id === s.sticker)?.en ?? 'a sticker'} /> : s.text}
                </span>
                {s.got !== undefined && (
                  <span className="wd-got" title={s.got ? 'They understood' : 'They did not understand'} aria-label={s.got ? 'understood' : 'not understood'}>
                    <PixelIcon name={s.got ? 'check' : 'huh'} size={10} />
                  </span>
                )}
              </li>
            ) : s.line ? (
              <li key={i} className="wd-npc" data-latest={i === view.history.length - 1 ? '' : undefined}>
                {s.line.speaker !== (view.scene.npc ?? '') && s.line.speaker !== view.npc?.id && s.line.speaker !== 'sign' && (
                  <span className="wd-who tiny han">{speakerName(s.line.speaker)}</span>
                )}
                <span className="wd-line">
                  <SaidLine line={s.line} pinyin={pinyin} />
                  {s.line.speaker !== 'sign' && s.line.speaker !== 'hero' && (
                    <button type="button" className="wd-hear" onClick={() => voice(s.line!)} aria-label="Hear it again" title="Hear it again (R)">
                      <PixelIcon name="speaker" size={14} />
                    </button>
                  )}
                </span>
              </li>
            ) : null,
          )}
        </ol>
        <footer className="wd-foot">
          {view.mode === 'reply' ? (
            // paying: only its row of things to say shows (再说一遍 to hear the amount again), the phone does the rest
            children
          ) : view.mode === 'choose' && node?.choose ? (
            <ChoiceRow choose={node.choose} showRight={view.state.hint >= 3} onPick={onPick} />
          ) : view.mode === 'trace' && node?.trace ? (
            <DishuPad key={`${view.scene.id}/${node.id}`} chars={node.trace.chars} onDone={onTraced} />
          ) : (
            <button type="button" className="wd-go" onClick={onProceed} autoFocus>
              {view.mode === 'over' ? 'Done' : 'Go on'}
              {view.mode !== 'over' && <span className="wd-go-more" aria-hidden />}
            </button>
          )}
        </footer>
      </section>
      {paying && view.state.due && onPay && onDispute && (
        <PhonePay due={view.state.due} balance={balance ?? 0} fill={view.state.hint >= 3} onPay={onPay} onDispute={onDispute} />
      )}
    </div>
  );
}
