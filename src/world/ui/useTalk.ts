import { useCallback, useMemo, useRef, useState } from 'react';
import type { Lexicon } from '../core/dialogue/lexicon';
import { ScriptedDialogue } from '../core/dialogue/scripted';
import type { CompanionCue, DialogueState, Line, Turn } from '../core/dialogue/source';
import type { SaveAction } from '../core/save';
import type { TalkWho } from './useWorldSave';
import type { NpcCard, Scene, WorldSave } from '../core/types';
import type { WorldContent } from './content';

export interface Said {
  who: 'npc' | 'you';
  /** the NPC's line; for your lines, the text you sent */
  line?: Line;
  text?: string;
  /** a sticker you sent (X6) */
  sticker?: string;
  kind?: Turn['kind'];
  /** your line: whether they understood it (a small ✓ or ? on it) */
  got?: boolean;
}

export interface TalkView {
  scene: Scene;
  npc: NpcCard | null;
  /** the prototype maps have people without cards: their sprite and id */
  sprite: string;
  /** a heading instead of a person's name (a sign) */
  title?: string;
  history: Said[];
  state: DialogueState;
  /** what the player does now: answer, pick, write, tap to go on, or it is over */
  mode: 'reply' | 'choose' | 'trace' | 'tap' | 'over';
  cue?: CompanionCue;
  /** misunderstood lines in a row (for the companion, E4) */
  misses: number;
}

/** What the player does after this turn: answer, tap to go on, or nothing (over). */
export function modeOf(scene: Scene, t: Turn): TalkView['mode'] {
  if (t.end || t.state.ended) return 'over';
  const node = scene.nodes.find((n) => n.id === t.state.node);
  if (node?.choose) return 'choose';
  if (node?.order || node?.sell || node?.bargain || node?.rack || node?.bikes) return 'reply';
  if (node?.trace) return 'trace';
  if (node?.expect?.length) return 'reply';
  // A first line that expects nothing and leads nowhere is all there is.
  return node?.next ? 'tap' : 'over';
}

/** The view after a turn: your line and the NPC's added, misses counted for the companion. */
export function afterTurn(v: TalkView, t: Turn, you?: string, sticker?: string): TalkView {
  const history = [...v.history];
  const missed = t.kind === 'miss' || t.kind === 'not_chinese' || t.kind === 'wrong';
  if (you !== undefined) history.push({ who: 'you', text: you, ...(sticker ? { sticker } : {}), got: !missed });
  // the speaker box's 「支付宝到账」 comes before the seller's thanks (Y2)
  if (t.chime) history.push({ who: 'npc', line: t.chime, kind: t.kind });
  if (t.say) history.push({ who: 'npc', line: t.say, kind: t.kind });
  const misses = missed ? v.misses + 1 : t.kind === 'match' ? 0 : v.misses;
  return { ...v, history, state: t.state, mode: modeOf(v.scene, t), cue: t.companion, misses };
}

/**
 * 再说一遍 / 慢一点 repeat what they said last — the running total of an
 * order, the price on the table — not the script's line for the node, which
 * may be the greeting from three turns ago. The script's own easier line is
 * kept for 慢一点 when their last line was the node's own.
 */
export function againOf(t: Turn, history: readonly Said[]): Turn {
  if ((t.kind !== 'repeat' && t.kind !== 'slower') || !t.say) return t;
  const last = [...history].reverse().find((s) => s.who === 'npc' && s.line && s.line.speaker !== 'speaker-box')?.line;
  if (!last || last.node === t.say.node) return t;
  return { ...t, say: { ...last, ...(t.kind === 'slower' ? { slow: true } : {}) } };
}

/** One line said by someone, outside any script (a gift's thanks, "not this one"). */
export function lineScene(id: string, speaker: string, zh: string, en: string, npc?: string): Scene {
  return { id: `line-${id}`, map: '', ...(npc ? { npc } : {}), trigger: 'talk', start: 'a', nodes: [{ id: 'a', speaker, say: zh, translate: en }] };
}

/** A sign read in the bubble, so its words can be tapped (concept §4): one line, its English as the translation. */
export function signScene(o: { id: string; text: string; en?: string }): Scene {
  return { id: `sign-${o.id}`, map: '', trigger: 'look', start: 'text', nodes: [{ id: 'text', speaker: 'sign', say: o.text, translate: o.en ?? '' }] };
}

/** A card-less or scene-less person still says something: hello, and goodbye. */
export function smallTalk(npcId: string, _card: NpcCard | null): Scene {
  return {
    id: `smalltalk-${npcId}`,
    map: '',
    npc: npcId,
    trigger: 'talk',
    start: 'hi',
    nodes: [{ id: 'hi', say: '你好！', translate: 'Hello!' }],
  };
}

/**
 * One conversation at a time, through `ScriptedDialogue` (core/dialogue),
 * with the history kept for the bubble and the actions handed to the save.
 */
export function useTalk(
  content: WorldContent,
  lex: Lexicon | null,
  dispatch: (a: readonly SaveAction[], who: TalkWho) => WorldSave | null,
  /** 「给你糖葫芦」 said in a talk: hand it over (Y4) */
  onGift?: (item: string, npc: string) => void,
) {
  const gift = useRef(onGift);
  gift.current = onGift;
  const [view, setView] = useState<TalkView | null>(null);
  const cur = useRef<TalkView | null>(null);
  const source = useMemo(() => (lex ? new ScriptedDialogue({ scenes: content.scenes, npcs: content.npcs, shops: content.shops, items: content.items, clothes: content.clothes }, lex) : null), [content, lex]);

  const take = useCallback(
    (t: Turn, you?: string, sticker?: string) => {
      const v = cur.current;
      if (!v) return;
      if (t.actions.length) dispatch(t.actions, { npc: v.scene.npc, scene: v.scene.id });
      if (t.gift && v.scene.npc) {
        // the talk closes and the present (or the use) plays out as if the item had been tapped on them
        cur.current = null;
        setView(null);
        gift.current?.(t.gift, v.scene.npc);
        return;
      }
      const next = afterTurn(v, t, you, sticker);
      cur.current = next;
      setView(next);
    },
    [dispatch],
  );

  const start = useCallback(
    (scene: Scene, npc: NpcCard | null, sprite: string, save: WorldSave, title?: string) => {
      if (!source) return;
      const t = source.start(scene, save);
      const v: TalkView = { scene, npc, sprite, history: [], state: t.state, mode: 'reply', misses: 0, ...(title ? { title } : {}) };
      cur.current = v;
      take(t);
    },
    [source, take],
  );

  const reply = useCallback(
    (text: string, via: 'voice' | 'keyboard', sticker?: string) => {
      const v = cur.current;
      if (!v || !source || v.mode !== 'reply') return;
      take(againOf(source.reply(v.state, { text, via, ...(sticker ? { sticker } : {}) }), v.history), text, sticker);
    },
    [source, take],
  );

  /** a picture picked, or the characters written (X8) */
  const pick = useCallback(
    (id: string) => {
      const v = cur.current;
      if (!v || !source || v.mode !== 'choose') return;
      const node = v.scene.nodes.find((n) => n.id === v.state.node);
      const label = node?.choose?.options.find((o) => o.id === id)?.label ?? id;
      take(source.reply(v.state, { text: '', via: 'keyboard', choice: id }), label);
    },
    [source, take],
  );
  const traced = useCallback(() => {
    const v = cur.current;
    if (!v || !source || v.mode !== 'trace') return;
    const node = v.scene.nodes.find((n) => n.id === v.state.node);
    take(source.reply(v.state, { text: '', via: 'keyboard', traced: true }), `✍ ${node?.trace?.chars ?? ''}`);
  }, [source, take]);

  const proceed = useCallback(() => {
    const v = cur.current;
    if (!v || !source) return;
    if (v.mode === 'over') {
      // A one-line talk has not been finished by the script yet: do so, so the scene counts as done.
      if (!v.state.ended) {
        const t = source.proceed(v.state);
        if (t.actions.length) dispatch(t.actions, { npc: v.scene.npc, scene: v.scene.id });
      }
      cur.current = null;
      setView(null);
      return;
    }
    take(source.proceed(v.state));
  }, [source, take, dispatch]);

  const close = useCallback(() => {
    cur.current = null;
    setView(null);
  }, []);

  /** paying on the phone (Y2): an amount typed or a charge accepted, or 不对 at a wrong charge */
  const pay = useCallback(
    (amount: number) => {
      const v = cur.current;
      if (!v || !source || !v.state.due) return;
      take(source.reply(v.state, { text: '', via: 'keyboard', paid: amount }), `支付宝 ¥${amount.toFixed(2)}`);
    },
    [source, take],
  );
  const dispute = useCallback(() => {
    const v = cur.current;
    if (!v || !source || !v.state.due) return;
    take(source.reply(v.state, { text: '不对', via: 'keyboard' }), '不对！');
  }, [source, take]);

  /** what 💡 offers now (a shop's order line makes its own) */
  const hint = useCallback(() => (cur.current && source ? source.hintAt(cur.current.state) : undefined), [source]);

  return { view, start, reply, pick, traced, proceed, close, hint, pay, dispute };
}
