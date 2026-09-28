import { playBytes, playBytesAtPace, say } from '../../platform/audio/voiceOut';
import type { Line } from '../core/dialogue/source';
import type { NpcCard } from '../core/types';
import { voiceKey, voiceOf } from '../core/voice';

/**
 * Plays an NPC's line in their voice (prompt G2): the clip rendered for it
 * by `scripts/world/build-voices.ts` when there is one, else the system
 * voice. The hero and signs are silent. Slower (after 慢一点, or a second
 * 🔁) keeps the pitch and stretches the time.
 */

let index: Promise<Set<string>> | null = null;
const loadIndex = () =>
  (index ??= fetch('/world/voice/index.json')
    .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
    .then((keys) => new Set(keys))
    .catch(() => new Set<string>()));

let cards: ReadonlyMap<string, NpcCard> = new Map();

/** The page tells it who is who once the content has loaded. */
export function setVoiceCards(npcs: readonly NpcCard[]) {
  cards = new Map(npcs.map((n) => [n.id, n]));
}

export async function playLine(line: Line, slower = false): Promise<void> {
  const voice = voiceOf(line.speaker, cards);
  if (line.speaker === 'hero' || line.speaker === 'sign') return;
  const slow = slower || !!line.slow;
  try {
    const keys = await loadIndex();
    const key = voice ? voiceKey(voice, line.zh) : null;
    if (key && keys.has(key)) {
      const bytes = await (await fetch(`/world/voice/${key}.mp3`)).arrayBuffer();
      await (slow ? playBytesAtPace(bytes, 0.75) : playBytes(bytes));
      return;
    }
    await say(line.zh, slow ? { pace: 0.75 } : {});
  } catch {
    /* no sound is fine */
  }
}
