/**
 * Keeping the game's save on the server as well as on the device (prompt §7).
 *
 * - **Open:** the device's copy and the server's are read; the newer wins,
 *   and when the device has changes the server never took, the two are
 *   merged (core/merge.ts) — nothing found on either is lost. Offline, the
 *   device's copy is enough.
 * - **Save:** every change goes to the device at once. The server gets it
 *   soon after an important change (a dialogue, a map change, a ride, a
 *   find, a purchase) and at most every 30 s while walking, and right away
 *   when the tab is hidden or closed.
 * - **Conflict:** another device saved first → merge with its save and try
 *   again on its revision.
 * - **Offline:** the change stays marked on the device and is retried.
 *
 * No DOM here beyond what is handed in; timers and time are injectable.
 */

import { isLater, merge } from '../core/merge';
import { readSave } from '../core/migrate';
import { newSave } from '../core/save';
import type { WorldSave } from '../core/types';
import type { WorldGateway } from './gateway';
import type { LocalStore } from './local';

export type SyncPhase = 'saved' | 'pending' | 'saving' | 'offline' | 'outdated' | 'failing';

/** How soon a change reaches the server. */
export type Urgency = 'important' | 'walk';

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface SyncOptions {
  gateway: WorldGateway;
  local: LocalStore;
  deviceId: string;
  now?: () => number;
  timers?: Timers;
  /** ms after an important change, so a burst of actions goes as one save */
  settleMs?: number;
  /** ms between saves while only walking */
  walkMs?: number;
  /** ms before trying again when the server could not be reached */
  retryMs?: number;
}

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

const MAX_CONFLICT_ROUNDS = 3;

export class WorldSync {
  private save: WorldSave | null = null;
  private revision = 0;
  private dirty = false;
  /** bumped on every change, so a save that raced a change keeps it dirty */
  private edits = 0;
  private lastSent = -Infinity;
  private timer: unknown = null;
  private dueAt = Infinity;
  private inFlight: Promise<void> | null = null;
  private listeners = new Set<(p: SyncPhase) => void>();
  phase: SyncPhase = 'saved';

  private readonly now: () => number;
  private readonly timers: Timers;
  private readonly settleMs: number;
  private readonly walkMs: number;
  private readonly retryMs: number;

  constructor(private readonly o: SyncOptions) {
    this.now = o.now ?? Date.now;
    this.timers = o.timers ?? realTimers;
    this.settleMs = o.settleMs ?? 1500;
    this.walkMs = o.walkMs ?? 30_000;
    this.retryMs = o.retryMs ?? 15_000;
  }

  onPhase(fn: (p: SyncPhase) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setPhase(p: SyncPhase) {
    if (p === this.phase) return;
    this.phase = p;
    for (const fn of this.listeners) fn(p);
  }

  get current(): WorldSave {
    if (!this.save) throw new Error('WorldSync: open() first');
    return this.save;
  }

  private remember() {
    this.o.local.write({ save: this.save, revision: this.revision, dirty: this.dirty });
  }

  /** Loads the save to play: the newer of the device's and the server's, merged if both changed. */
  async open(): Promise<WorldSave> {
    const copy = this.o.local.read();
    const mine = copy ? readSave(copy.save) : null;
    const local = mine?.ok ? mine.save : null;
    let remote: { save: WorldSave | null; revision: number } | null = null;
    try {
      const dto = await this.o.gateway.load();
      if (dto.save === null) remote = { save: null, revision: dto.revision };
      else {
        const read = readSave(dto.save);
        if (read.ok) remote = { save: read.save, revision: dto.revision };
        else if (read.reason === 'newer') {
          // A newer build saved this game: play the device's copy but never write over the server's.
          this.setPhase('outdated');
          remote = null;
        }
      }
    } catch {
      this.setPhase('offline');
    }

    if (local && copy && remote?.save) {
      if (copy.dirty) {
        this.save = copy.revision === remote.revision ? local : merge(local, remote.save);
        this.dirty = true;
      } else if (copy.revision >= remote.revision && !isLater(remote.save, local)) {
        this.save = local;
      } else {
        this.save = remote.save;
      }
      this.revision = remote.revision;
    } else if (remote?.save) {
      this.save = remote.save;
      this.revision = remote.revision;
    } else if (local && copy) {
      this.save = local;
      // The server has nothing (or could not be asked): keep what the copy knew.
      this.revision = remote ? remote.revision : copy.revision;
      this.dirty = copy.dirty || (remote !== null && remote.revision === 0);
    } else {
      this.save = newSave(this.o.deviceId, this.now());
      this.revision = remote?.revision ?? 0;
      this.dirty = true;
    }
    this.remember();
    if (this.dirty && this.phase !== 'outdated') {
      this.setPhase(this.phase === 'offline' ? 'offline' : 'pending');
      this.schedule(this.settleMs);
    }
    return this.save;
  }

  /** The game changed the save. */
  update(save: WorldSave, urgency: Urgency = 'important') {
    if (save === this.save) return;
    this.save = save;
    this.dirty = true;
    this.edits++;
    this.remember();
    if (this.phase === 'outdated') return;
    if (this.phase === 'saved') this.setPhase('pending');
    if (urgency === 'important') this.schedule(this.settleMs);
    else this.schedule(Math.max(this.settleMs, this.lastSent + this.walkMs - this.now()));
  }

  private schedule(ms: number) {
    const due = this.now() + Math.max(0, ms);
    // A save already planned sooner stays; a later one never pushes it back.
    if (this.timer !== null && this.dueAt <= due) return;
    if (this.timer !== null) this.timers.clear(this.timer);
    this.dueAt = due;
    this.timer = this.timers.set(() => {
      this.timer = null;
      void this.flush();
    }, Math.max(0, ms));
  }

  /** Sends the save now if it has changes (the tab is being hidden or closed, or a timer fired). */
  flush(): Promise<void> {
    if (this.inFlight) return this.inFlight.then(() => (this.dirty ? this.flush() : undefined));
    if (!this.dirty || !this.save || this.phase === 'outdated') return Promise.resolve();
    if (this.timer !== null) {
      this.timers.clear(this.timer);
      this.timer = null;
    }
    this.inFlight = this.send().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async send(): Promise<void> {
    this.setPhase('saving');
    for (let round = 0; round < MAX_CONFLICT_ROUNDS; round++) {
      const edits = this.edits;
      const sending = this.save!;
      let out;
      try {
        out = await this.o.gateway.save(this.revision, sending);
      } catch {
        this.setPhase('offline');
        this.schedule(this.retryMs);
        return;
      }
      this.lastSent = this.now();
      if (out.kind === 'outdated') {
        this.setPhase('outdated');
        return;
      }
      if (out.kind === 'saved') {
        this.revision = out.revision;
        this.dirty = this.edits !== edits;
        this.remember();
        this.setPhase(this.dirty ? 'pending' : 'saved');
        if (this.dirty) this.schedule(this.settleMs);
        return;
      }
      // Someone else saved first: take in what they have and try on their revision.
      const theirs = out.current.save === null ? null : readSave(out.current.save);
      if (theirs && !theirs.ok && theirs.reason === 'newer') {
        this.setPhase('outdated');
        return;
      }
      this.save = theirs?.ok ? merge(this.save!, theirs.save) : this.save;
      this.revision = out.current.revision;
      this.remember();
    }
    this.setPhase('failing');
    this.schedule(this.retryMs);
  }

  /** Save when the tab goes to the background or away. Returns a way to stop listening. */
  attach(target: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>, win?: Pick<Window, 'addEventListener' | 'removeEventListener'>): () => void {
    const onVisibility = () => {
      if (target.visibilityState === 'hidden') void this.flush();
    };
    const onHide = () => void this.flush();
    target.addEventListener('visibilitychange', onVisibility);
    win?.addEventListener('pagehide', onHide);
    win?.addEventListener('online', onHide);
    return () => {
      target.removeEventListener('visibilitychange', onVisibility);
      win?.removeEventListener('pagehide', onHide);
      win?.removeEventListener('online', onHide);
    };
  }

  dispose() {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
  }
}
