import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceQuests } from '../core/quests';
import { applyAll, type SaveAction } from '../core/save';
import type { Quest, WorldSave } from '../core/types';
import { worldApi } from '../sync/gateway';
import { browserLocal } from '../sync/local';
import { WorldSync, type SyncPhase, type Urgency } from '../sync/sync';

const DEVICE_KEY = 'zouzou:device';

/** This browser's id, kept so merges can tell two devices apart. */
function deviceId(): string {
  try {
    const known = localStorage.getItem(DEVICE_KEY);
    if (known) return known;
    const made = `d-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, made);
    return made;
  } catch {
    return 'd-anonymous';
  }
}

export interface WorldSaveApi {
  save: WorldSave | null;
  phase: SyncPhase;
  /** Applies actions to the save (then lets quests move on) and schedules a sync. */
  dispatch(actions: readonly SaveAction[], urgency?: Urgency): WorldSave | null;
  /** the latest save, for callbacks that must not wait for a render */
  current(): WorldSave | null;
  /** sends the save to the server now (before a reload) */
  flush(): Promise<void>;
}

/**
 * The game's save for one account: opened from the device and the server
 * (world/sync), changed only through core/save.ts actions, synced as the
 * brief's §7.2 says.
 */
export function useWorldSave(userId: string, quests: readonly Quest[] = []): WorldSaveApi {
  const [save, setSave] = useState<WorldSave | null>(null);
  const [phase, setPhase] = useState<SyncPhase>('saved');
  const sync = useRef<WorldSync | null>(null);
  const latest = useRef<WorldSave | null>(null);
  const questMap = useRef(new Map<string, Quest>());
  questMap.current = new Map(quests.map((q) => [q.id, q]));

  useEffect(() => {
    const device = deviceId();
    const s = new WorldSync({ gateway: worldApi, local: browserLocal(userId), deviceId: device });
    sync.current = s;
    const off = s.onPhase(setPhase);
    const detach = s.attach(document, window);
    let gone = false;
    void s.open().then((opened) => {
      if (gone) return;
      latest.current = opened;
      setSave(opened);
      setPhase(s.phase);
    });
    return () => {
      gone = true;
      void s.flush();
      off();
      detach();
      s.dispose();
      sync.current = null;
    };
  }, [userId]);

  const dispatch = useCallback(
    (actions: readonly SaveAction[], urgency: Urgency = 'important') => {
      const cur = latest.current;
      const s = sync.current;
      if (!cur || !s) return null;
      const ctx = { now: Date.now(), quests: questMap.current };
      const next = advanceQuests(applyAll(cur, actions, ctx), [...questMap.current.values()], ctx);
      if (next === cur) return cur;
      latest.current = next;
      setSave(next);
      s.update(next, urgency);
      return next;
    },
    [],
  );

  return { save, phase, dispatch, current: () => latest.current, flush: () => sync.current?.flush() ?? Promise.resolve() };
}
