/**
 * Keeping one account's workspace in step with the server.
 *
 * The screen never waits for the network. A change is applied here at once and
 * queued; a moment later, once a burst of typing has settled, the whole
 * document goes to the server together with the revision it was built on. If
 * another device saved first, the server says so and hands back what it has,
 * and the queued changes are replayed on top of that — which is why they are
 * kept as actions rather than as a finished state. Two devices' work ends up
 * in one place instead of one of them silently winning.
 *
 * The queue is written to the browser as it grows, so a closed tab, a tablet
 * put to sleep or a server switched off halfway through a session loses
 * nothing: the next visit finds the queue and saves it.
 *
 * Nothing here knows about React, the DOM or what the document means. The
 * model, the server and the browser's storage are all handed in, which is also
 * what lets the tests drive every one of those situations directly.
 */

export interface Model<S, A> {
  empty(): S;
  hydrate(document: unknown): S;
  serialise(state: S): unknown;
  reduce(state: S, action: A): S;
  /** One action that does what `last` then `next` would, or null when they have to stay two. */
  coalesce(last: A, next: A): A | null;
}

export interface RemoteWorkspace {
  revision: number;
  /** null until something has been saved */
  document: unknown;
}

export type SaveOutcome =
  | { kind: 'saved'; revision: number }
  | { kind: 'conflict'; current: RemoteWorkspace };

/** The server, as far as saving goes. */
export interface WorkspaceGateway {
  load(): Promise<RemoteWorkspace>;
  /** What the server has, or null if it is still at `revision`. */
  check(revision: number): Promise<RemoteWorkspace | null>;
  save(baseRevision: number, document: unknown): Promise<SaveOutcome>;
}

/** Where queued actions wait between visits. */
export interface Outbox<A> {
  /** Claims this tab's queue and any a closed tab left behind, oldest first. */
  takeOver(): A[];
  write(actions: A[]): void;
  /** False once another tab has claimed this tab's queue: saving it is that tab's job now. */
  owns(): boolean;
  heartbeat(): void;
  release(): void;
}

export type SyncPhase = 'saved' | 'pending' | 'saving' | 'offline' | 'failing' | 'signed-out';

export interface SyncStatus {
  phase: SyncPhase;
  /** changes the server does not have yet */
  unsaved: number;
  lastSavedAt: number | null;
  message: string | null;
}

export type FailureKind = 'signed-out' | 'offline' | 'failing';

export interface Scheduler {
  set(run: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface SyncDeps<S, A> {
  model: Model<S, A>;
  gateway: WorkspaceGateway;
  outbox: Outbox<A>;
  classify(err: unknown): FailureKind;
  scheduler?: Scheduler;
  now?: () => number;
}

/** Long enough for a burst of typing to become one save, short enough to feel immediate. */
const SAVE_DELAY_MS = 800;
/** How often in a row another device may save first before this one backs off. */
const MAX_REBASES = 5;
const RETRY_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

const timers: Scheduler = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class WorkspaceSync<S, A> {
  private revision: number;
  /** what the server confirmed at `revision` */
  private base: S;
  /** `base` with every pending action applied: what the screen shows */
  private state: S;
  private pending: A[] = [];
  /** actions at the front of `pending` on their way to the server, which nothing may be folded into */
  private sealed = 0;
  /** one request at a time: saving and checking queue up behind each other */
  private lane: Promise<void> = Promise.resolve();
  private flushQueued = false;
  private timer: unknown = null;
  private failures = 0;
  private closed = false;
  private status: SyncStatus = { phase: 'saved', unsaved: 0, lastSavedAt: null, message: null };
  private readonly stateListeners = new Set<(state: S) => void>();
  private readonly statusListeners = new Set<(status: SyncStatus) => void>();
  private readonly scheduler: Scheduler;
  private readonly now: () => number;

  constructor(
    private readonly deps: SyncDeps<S, A>,
    remote: RemoteWorkspace,
  ) {
    this.scheduler = deps.scheduler ?? timers;
    this.now = deps.now ?? Date.now;
    this.revision = remote.revision;
    this.base = this.decode(remote.document);
    this.state = this.base;
  }

  /** Picks up whatever an earlier visit left unsaved, and starts saving it. */
  open(): S {
    const carried = this.deps.outbox.takeOver();
    if (carried.length) {
      this.pending = carried;
      this.state = this.replay();
      this.setStatus({ phase: 'pending' });
      void this.flush();
    }
    return this.state;
  }

  /**
   * Stops scheduling saves and telling anyone about changes. A save already on
   * its way still finishes, and still clears what it saved from the queue —
   * otherwise the next visit would save it a second time.
   */
  close(): void {
    this.closed = true;
    this.clearTimer();
    this.stateListeners.clear();
    this.statusListeners.clear();
  }

  getState(): S {
    return this.state;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  onState(listener: (state: S) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onStatus(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  dispatch(action: A): S {
    if (this.pending.length && !this.deps.outbox.owns()) this.forgetTakenOver();

    this.state = this.deps.model.reduce(this.state, action);
    const last = this.pending.length > this.sealed ? this.pending[this.pending.length - 1] : undefined;
    const merged = last === undefined ? null : this.deps.model.coalesce(last, action);
    if (merged === null) this.pending.push(action);
    else this.pending[this.pending.length - 1] = merged;
    this.deps.outbox.write(this.pending);

    // While waiting out a failure the retry is already booked; a change made
    // meanwhile joins the queue rather than hammering a server that is not there.
    const waiting = this.status.phase === 'offline' || this.status.phase === 'failing' || this.status.phase === 'signed-out';
    this.setStatus(waiting || this.status.phase === 'saving' ? {} : { phase: 'pending' });
    if (!waiting) this.schedule(SAVE_DELAY_MS, 'flush');
    return this.state;
  }

  /** Saves now, rather than after the pause that turns a burst of typing into one request. */
  flush(): Promise<void> {
    this.clearTimer();
    if (!this.flushQueued) {
      this.flushQueued = true;
      this.lane = this.lane.then(() => {
        this.flushQueued = false;
        return this.push();
      });
    }
    return this.lane;
  }

  /** Saves if there is anything to save, and otherwise asks whether another device saved something. */
  refresh(): Promise<void> {
    this.lane = this.lane.then(() => (this.pending.length ? this.push() : this.pull()));
    return this.lane;
  }

  private async push(): Promise<void> {
    if (this.pending.length && !this.deps.outbox.owns()) {
      this.forgetTakenOver();
      return this.pull();
    }

    for (let rebases = 0; this.pending.length > 0; rebases++) {
      const sent = this.pending.length;
      const snapshot = this.state;
      this.sealed = sent;
      this.deps.outbox.heartbeat();
      this.setStatus({ phase: 'saving' });

      let outcome: SaveOutcome;
      try {
        outcome = await this.deps.gateway.save(this.revision, this.deps.model.serialise(snapshot));
      } catch (err) {
        return this.failed(err);
      } finally {
        this.sealed = 0;
      }

      if (outcome.kind === 'saved') {
        this.failures = 0;
        this.revision = outcome.revision;
        this.base = snapshot;
        this.pending = this.pending.slice(sent);
        this.deps.outbox.write(this.pending);
        this.setStatus({
          phase: this.pending.length ? 'pending' : 'saved',
          lastSavedAt: this.now(),
          message: null,
        });
        if (this.pending.length) this.schedule(SAVE_DELAY_MS, 'flush');
        return;
      }

      if (rebases >= MAX_REBASES) {
        return this.failed(new Error('Another device kept saving at the same moment.'));
      }
      // Somewhere else saved first: theirs becomes the base, ours goes on top.
      this.adopt(outcome.current);
    }
  }

  private async pull(): Promise<void> {
    let remote: RemoteWorkspace | null;
    try {
      remote = await this.deps.gateway.check(this.revision);
    } catch (err) {
      return this.failed(err);
    }
    this.failures = 0;
    if (remote && remote.revision !== this.revision) this.adopt(remote);

    const { phase } = this.status;
    if (phase === 'offline' || phase === 'failing' || phase === 'signed-out') {
      this.setStatus({ phase: this.pending.length ? 'pending' : 'saved', message: null });
    }
    if (this.pending.length) this.schedule(SAVE_DELAY_MS, 'flush');
  }

  /** What the server has becomes the base, with whatever is still queued replayed on top. */
  private adopt(remote: RemoteWorkspace) {
    this.revision = remote.revision;
    this.base = this.decode(remote.document);
    this.state = this.replay();
    this.emitState();
  }

  /**
   * Another tab claimed this tab's queue — this tab looked closed, the way a
   * page kept in the back/forward cache does — and is saving it. Saving it here
   * too would apply every change twice, so this tab lets its copy go and
   * returns to what the server last confirmed.
   */
  private forgetTakenOver() {
    this.pending = [];
    this.sealed = 0;
    this.state = this.base;
    this.emitState();
    this.setStatus({});
  }

  private failed(err: unknown): void {
    const kind = this.deps.classify(err);
    if (kind === 'signed-out') {
      this.setStatus({ phase: 'signed-out', message: 'Signed out. Sign in again and this will be saved.' });
      return;
    }
    const delay = RETRY_MS[Math.min(this.failures, RETRY_MS.length - 1)];
    this.failures++;
    this.setStatus({
      phase: kind,
      message:
        kind === 'offline'
          ? 'Not connected. Kept on this device until the server can be reached.'
          : err instanceof Error
            ? err.message
            : 'Could not save.',
    });
    this.schedule(delay, 'refresh');
  }

  private schedule(ms: number, then: 'flush' | 'refresh') {
    if (this.closed) return;
    this.clearTimer();
    this.timer = this.scheduler.set(() => {
      this.timer = null;
      void (then === 'flush' ? this.flush() : this.refresh());
    }, ms);
  }

  private clearTimer() {
    if (this.timer === null) return;
    this.scheduler.clear(this.timer);
    this.timer = null;
  }

  private replay(): S {
    return this.pending.reduce((state, action) => this.deps.model.reduce(state, action), this.base);
  }

  private decode(document: unknown): S {
    return document === null || document === undefined
      ? this.deps.model.empty()
      : this.deps.model.hydrate(document);
  }

  private setStatus(patch: Partial<SyncStatus>) {
    const next: SyncStatus = { ...this.status, ...patch, unsaved: this.pending.length };
    const same =
      next.phase === this.status.phase &&
      next.unsaved === this.status.unsaved &&
      next.lastSavedAt === this.status.lastSavedAt &&
      next.message === this.status.message;
    if (same) return;
    this.status = next;
    this.statusListeners.forEach((l) => l(next));
  }

  private emitState() {
    this.stateListeners.forEach((l) => l(this.state));
  }
}
