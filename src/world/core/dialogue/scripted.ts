/**
 * The conversations as written: a small graph per scene (prompt §4).
 *
 * At each node the player's line is tried, in order, as
 *   1. a request — 再说一遍, 慢一点, X是什么意思, 听不懂;
 *   2. one of the node's `expect` intents;
 *   3. a polite word — 你好, 谢谢, 再见, 对不起;
 *   4. not Chinese at all → 「听不懂……」 and the companion offers the Chinese;
 *   5. otherwise a miss: 「你说什么？」, and from the second miss in a row the
 *      companion offers the node's hint, one step further each time, the
 *      third step always a whole sentence that works. Never a dead end.
 */

import type { SaveAction } from '../save';
import type { Action, DialogueNode, NpcCard, Scene, WorldSave } from '../types';
import type { Lexicon } from './lexicon';
import { heardNote, matchIntent, normalize } from './match';
import type { CompanionCue, DialogueSource, DialogueState, Line, Turn, Utterance } from './source';
import { askIntent, explainWord, POLITE_REPLY, politeIntent } from './universal';
import { hintWithName, NAME_SLOT, withName } from '../voice';

export const DEFAULT_MISSES = ['你说什么？', '什么？请再说一遍。'];
export const NOT_CHINESE = { zh: '对不起，我听不懂……', en: "Sorry, I don't understand…" };
export const DONT_KNOW = { zh: '这个……我不知道怎么说。', en: "Hmm… I don't know how to say it." };

export interface ScriptContent {
  scenes: readonly Scene[];
  npcs: readonly NpcCard[];
}

/**
 * The name in 「我叫大卫。」 / 「我是小白」 / 「我的名字是 Anna」 (X2), or null. Only
 * the first word-like run after the marker, at most twelve characters.
 */
export function nameFrom(text: string): string | null {
  const m = /(?:我的名字是|我的名字叫|名字是|名字叫|我叫|叫我|我是)\s*([^\s，。！？、,.!?~～]+)/.exec(text.trim());
  if (!m) return null;
  const name = m[1]!.replace(/(吧|啊|呀|哦|呢)$/, '').slice(0, 12);
  return name || null;
}

/** 「“附近”就是不远的地方。」 from the word and its HSK 1 explanation. */
export function explanationLine(word: string, explain: string): string {
  const body = /^(就是|是|意思是)/.test(explain) ? explain : `就是${explain}`;
  return /[。！？.!?]$/.test(body) ? `“${word}”${body}` : `“${word}”${body}。`;
}

export class ScriptedDialogue implements DialogueSource {
  private scenes = new Map<string, Scene>();
  private npcs = new Map<string, NpcCard>();

  constructor(content: ScriptContent, private lex: Lexicon) {
    for (const s of content.scenes) this.scenes.set(s.id, s);
    for (const n of content.npcs) this.npcs.set(n.id, n);
  }

  private scene(id: string): Scene {
    const s = this.scenes.get(id);
    if (!s) throw new Error(`unknown scene ${id}`);
    return s;
  }

  private node(scene: Scene, id: string): DialogueNode {
    const n = scene.nodes.find((x) => x.id === id);
    if (!n) throw new Error(`scene ${scene.id} has no node ${id}`);
    return n;
  }

  private line(scene: Scene, n: DialogueNode, variant: 'say' | 'simpler' = 'say', slow = false, name = ''): Line {
    const simpler = variant === 'simpler' && n.simpler;
    const tpl = simpler ? n.simpler! : n.say;
    return {
      speaker: n.speaker ?? scene.npc ?? 'companion',
      zh: withName(tpl, name),
      ...(tpl.includes(NAME_SLOT) ? { tpl } : {}),
      // A manual reading belongs to `say`; the simpler line gets the build's.
      ...(n.pinyin && !simpler ? { pinyin: n.pinyin } : {}),
      en: withName(n.translate, name),
      ...(n.key ? { key: true } : {}),
      ...(n.listen && !simpler ? { listen: true } : {}),
      node: n.id,
      ...(slow ? { slow: true } : {}),
    };
  }

  /** A line of the NPC's own that is not in the graph. */
  private aside(scene: Scene, zh: string, en: string): Line {
    return { speaker: scene.npc ?? 'companion', zh, en, node: '' };
  }

  /** Arriving at a node: its onEnter, and a key line pins itself to 📜. */
  private enter(scene: Scene, n: DialogueNode): Action[] {
    return [...(n.onEnter ?? []), ...(n.key ? [{ do: 'pin' as const, riddle: `${scene.id}/${n.id}` }] : [])];
  }

  /** The talk is over by the script: the scene is done, its stamp given, and a talk with someone warms the friendship (once a day). */
  private finish(scene: Scene): SaveAction[] {
    return [
      { do: 'scene_done', scene: scene.id },
      ...(scene.stamp ? [{ do: 'stamp' as const, stamp: scene.stamp }] : []),
      ...(scene.npc && !scene.id.startsWith('line-') ? [{ do: 'talked' as const, npc: scene.npc }] : []),
    ];
  }

  start(scene: Scene, save?: WorldSave): Turn {
    this.scenes.set(scene.id, scene);
    const n = this.node(scene, scene.start);
    const meet: SaveAction[] = scene.npc ? [{ do: 'meet', npc: scene.npc }] : [];
    const state: DialogueState = { scene: scene.id, node: n.id, misses: 0, hint: 0, ended: false, ...(save?.name ? { name: save.name } : {}) };
    return { kind: 'start', say: this.line(scene, n, 'say', false, state.name), actions: [...meet, ...this.enter(scene, n)], state };
  }

  /** Leave `from` for `to` (or end), with the actions on the way. */
  private move(scene: Scene, from: DialogueNode, to: string | undefined, end: boolean, via: readonly SaveAction[], state: DialogueState): Omit<Turn, 'kind'> {
    const actions: SaveAction[] = [...via, ...(from.onExit ?? [])];
    if (!to || end) {
      const last = to ? this.node(scene, to) : null;
      if (last) actions.push(...this.enter(scene, last), ...(last.onExit ?? []));
      actions.push(...this.finish(scene));
      return { say: last ? this.line(scene, last, 'say', false, state.name) : null, actions, end: true, state: { ...state, node: to ?? state.node, misses: 0, hint: 0, ended: true } };
    }
    const next = this.node(scene, to);
    actions.push(...this.enter(scene, next));
    // A node that expects nothing and leads nowhere is the last word.
    const final = !next.expect?.length && !next.next;
    if (final) actions.push(...(next.onExit ?? []), ...this.finish(scene));
    return {
      say: this.line(scene, next, 'say', false, state.name),
      actions,
      ...(final ? { end: true } : {}),
      state: { ...state, node: next.id, misses: 0, hint: 0, ended: final },
    };
  }

  proceed(state: DialogueState): Turn {
    const scene = this.scene(state.scene);
    const n = this.node(scene, state.node);
    if (state.ended) return { kind: 'continue', say: null, actions: [], end: true, state };
    return { kind: 'continue', ...this.move(scene, n, n.next, false, [], state) };
  }

  private hintCue(n: DialogueNode, step: number, name = ''): CompanionCue | undefined {
    if (!n.hint || step < 1) return undefined;
    const s = Math.min(3, step) as 1 | 2 | 3;
    const h = hintWithName(n.hint, name);
    return { kind: 'hint', step: s, text: s === 1 ? h.word : s === 2 ? h.frame : h.full };
  }

  reply(state: DialogueState, u: Utterance): Turn {
    const scene = this.scene(state.scene);
    const n = this.node(scene, state.node);
    const npc = scene.npc ? this.npcs.get(scene.npc) : undefined;
    const input = normalize(u.text, this.lex);
    const stay = (kind: Turn['kind'], say: Line, extra: Partial<Turn> = {}): Turn => ({ kind, say, actions: [], state, ...extra });

    if (state.ended) return { kind: 'continue', say: null, actions: [], end: true, state };
    const nm = state.name;
    if (input.kind === 'empty') return stay('repeat', this.line(scene, n, 'say', false, nm));

    // A node with nothing to expect: whatever is said, go on.
    if (!n.expect?.length) {
      const polite = politeIntent(input, this.lex);
      if (polite === 'bye') return { kind: 'polite', intent: 'bye', say: this.aside(scene, POLITE_REPLY.bye.zh, POLITE_REPLY.bye.en), actions: [], end: true, state: { ...state, ended: true } };
      return this.proceed(state);
    }

    // 1. Requests.
    const known = [...Object.keys(npc?.explains ?? {}), ...(scene.words ?? []).map((w) => w.w)];
    const word = explainWord(input, this.lex, known);
    if (word) {
      const own = npc?.explains[word];
      const sit = scene.words?.find((w) => w.w === word);
      const explain = own ?? sit?.explain;
      if (explain) {
        return stay('explain', this.aside(scene, explanationLine(word, explain), sit?.en ? `"${word}" means ${sit.en}.` : `An explanation of ${word}.`), { intent: 'explain' });
      }
      const g = this.lex.gloss(word);
      return stay('explain', this.aside(scene, DONT_KNOW.zh, DONT_KNOW.en), {
        intent: 'explain',
        companion: { kind: 'explain', word, ...(g ? { py: g.py, en: g.en } : {}) },
      });
    }
    const ask = askIntent(input, this.lex);
    if (ask === 'repeat') return stay('repeat', this.line(scene, n, 'say', false, nm), { intent: 'repeat' });
    if (ask === 'slower') return stay('slower', this.line(scene, n, 'simpler', true, nm), { intent: 'slower' });
    if (ask === 'simpler') return stay('simpler', this.line(scene, n, 'simpler', false, nm), { intent: 'simpler' });

    // 2. The scene's own intents.
    const m = matchIntent(n.expect, input, this.lex);
    // A homophone picked by mistake from a keyboard is kept too, with the same note.
    if (m) {
      const note = m.heard.length ? m.heard.map((h) => heardNote(h, this.lex)).join(' ') : undefined;
      // 「我叫大卫。」: the name is kept, and the lines from here on say it.
      const told = m.expect.capture === 'name' ? nameFrom(u.text) : null;
      const via: SaveAction[] = [...(told ? [{ do: 'name' as const, name: told }] : []), ...(m.expect.actions ?? [])];
      const moved = this.move(scene, n, m.expect.go, !!m.expect.end, via, told ? { ...state, name: told } : state);
      return {
        kind: 'match',
        intent: m.expect.intent,
        ...moved,
        ...(note ? { note, companion: { kind: 'heard' as const, text: note } } : {}),
      };
    }

    // 3. Polite words.
    const polite = politeIntent(input, this.lex);
    if (polite) {
      const r = POLITE_REPLY[polite];
      return {
        kind: 'polite',
        intent: polite,
        say: this.aside(scene, r.zh, r.en),
        actions: [],
        ...(r.end ? { end: true } : {}),
        state: r.end ? { ...state, ended: true } : state,
      };
    }

    // 4. Not Chinese.
    if (input.kind === 'other') {
      return stay('not_chinese', this.aside(scene, NOT_CHINESE.zh, NOT_CHINESE.en), {
        intent: 'not_chinese',
        ...(n.hint ? { companion: { kind: 'not_chinese' as const, text: hintWithName(n.hint, nm ?? '').full } } : {}),
      });
    }

    // 5. A miss.
    const misses = state.misses + 1;
    const hint = misses >= 2 ? Math.min(3, Math.max(state.hint, 0) + 1) : state.hint;
    const lines = npc?.misses?.length ? npc.misses : DEFAULT_MISSES;
    const zh = lines[(misses - 1) % lines.length]!;
    const cue = misses >= 2 ? this.hintCue(n, hint, nm) : undefined;
    return {
      kind: 'miss',
      say: this.aside(scene, zh, 'What did you say?'),
      actions: [],
      ...(cue ? { companion: cue } : {}),
      state: { ...state, misses, hint },
    };
  }
}
