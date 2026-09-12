import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WorkspaceSync,
  type Model,
  type RemoteWorkspace,
  type SaveOutcome,
  type Scheduler,
  type WorkspaceGateway,
} from './engine';
import { localOutbox } from './outbox';

interface ListDoc {
  version: 1;
  items: string[];
}

interface Add {
  add: string;
}

const lists: Model<ListDoc, Add> = {
  empty: () => ({ version: 1, items: [] }),
  hydrate: (document) => structuredClone(document as ListDoc),
  serialise: (state) => state,
  reduce: (state, action) => ({ ...state, items: [...state.items, action.add] }),
  coalesce: () => null,
};

/** A server in memory, with a switch to take it offline and a gate to hold a save halfway. */
class Server<D> implements WorkspaceGateway {
  revision = 0;
  document: D | null = null;
  received: D[] = [];
  down = false;
  gate: Promise<void> | null = null;

  async load(): Promise<RemoteWorkspace> {
    this.guard();
    return { revision: this.revision, document: structuredClone(this.document) };
  }

  async check(revision: number): Promise<RemoteWorkspace | null> {
    this.guard();
    return revision === this.revision ? null : this.load();
  }

  async save(baseRevision: number, document: unknown): Promise<SaveOutcome> {
    this.guard();
    if (this.gate) await this.gate;
    if (baseRevision !== this.revision) return { kind: 'conflict', current: await this.load() };
    this.revision++;
    const saved = structuredClone(document as D);
    this.document = saved;
    this.received.push(saved);
    return { kind: 'saved', revision: this.revision };
  }

  /** Another device saving in the meantime. */
  saveElsewhere(document: D) {
    this.revision++;
    this.document = document;
  }

  private guard() {
    if (this.down) throw new Error('offline');
  }
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, String(value)),
  } as Storage;
}

/** Timers that go off only when the test says so. */
function manualTimers() {
  const due = new Map<number, () => void>();
  let next = 0;
  const scheduler: Scheduler = {
    set: (run) => {
      due.set(++next, run);
      return next;
    },
    clear: (handle) => void due.delete(handle as number),
  };
  return {
    scheduler,
    fire() {
      const runs = [...due.values()];
      due.clear();
      runs.forEach((run) => run());
    },
  };
}

function connect<D, A>(model: Model<D, A>, server: Server<D>, storage: Storage, tab: string) {
  const timers = manualTimers();
  const outbox = localOutbox<A>('user-1', storage, { tab });
  const sync = new WorkspaceSync<D, A>(
    {
      model,
      gateway: server,
      outbox,
      classify: (err) => (err instanceof Error && err.message === 'offline' ? 'offline' : 'failing'),
      scheduler: timers.scheduler,
    },
    { revision: server.revision, document: structuredClone(server.document) },
  );
  sync.open();
  return { sync, outbox, timers };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('WorkspaceSync', () => {
  it('saves a burst of changes as one request, after a pause', async () => {
    const server = new Server<ListDoc>();
    const { sync, timers } = connect(lists, server, memoryStorage(), 'a');

    sync.dispatch({ add: '好' });
    sync.dispatch({ add: '人' });
    sync.dispatch({ add: '大' });
    assert.equal(server.received.length, 0);
    assert.equal(sync.getStatus().phase, 'pending');

    timers.fire();
    await sync.flush();
    assert.equal(server.received.length, 1);
    assert.deepEqual(server.document?.items, ['好', '人', '大']);
    assert.equal(sync.getStatus().phase, 'saved');
  });

  it('replays its own changes on top of what another device saved first', async () => {
    const server = new Server<ListDoc>();
    server.saveElsewhere({ version: 1, items: ['一'] });
    const { sync } = connect(lists, server, memoryStorage(), 'a');

    server.saveElsewhere({ version: 1, items: ['一', '二'] });
    sync.dispatch({ add: '三' });
    await sync.flush();

    assert.deepEqual(server.document?.items, ['一', '二', '三']);
    assert.deepEqual(sync.getState().items, ['一', '二', '三']);
    assert.equal(sync.getStatus().phase, 'saved');
  });

  it('keeps changes while the server cannot be reached, and saves them once it can', async () => {
    const server = new Server<ListDoc>();
    const { sync, timers } = connect(lists, server, memoryStorage(), 'a');

    server.down = true;
    sync.dispatch({ add: '水' });
    await sync.flush();
    assert.equal(sync.getStatus().phase, 'offline');
    assert.equal(sync.getStatus().unsaved, 1);

    server.down = false;
    timers.fire();
    await sync.flush();
    assert.deepEqual(server.document?.items, ['水']);
    assert.equal(sync.getStatus().phase, 'saved');
  });

  it('saves what a closed tab left unsaved when the next page opens', async () => {
    const server = new Server<ListDoc>();
    const storage = memoryStorage();
    const first = connect(lists, server, storage, 'tab-1');

    server.down = true;
    first.sync.dispatch({ add: '火' });
    await first.sync.flush();
    first.sync.close();
    first.outbox.release();

    server.down = false;
    const second = connect(lists, server, storage, 'tab-2');
    await second.sync.flush();
    assert.deepEqual(server.document?.items, ['火']);
    assert.equal(storage.length, 0, 'nothing left queued once it is saved');
  });

  it('does not save twice what another tab has taken over', async () => {
    const server = new Server<ListDoc>();
    const storage = memoryStorage();
    const first = connect(lists, server, storage, 'tab-1');

    server.down = true;
    first.sync.dispatch({ add: '木' });
    await first.sync.flush();
    // The page went into the back/forward cache, so it looked closed...
    first.outbox.release();

    server.down = false;
    const second = connect(lists, server, storage, 'tab-2');
    await second.sync.flush();
    assert.deepEqual(server.document?.items, ['木']);

    // ...and then came back, and carried on.
    first.sync.dispatch({ add: '金' });
    await first.sync.flush();
    assert.deepEqual(server.document?.items, ['木', '金']);
    assert.deepEqual(first.sync.getState().items, ['木', '金']);
  });

  it('brings in what another device saved when asked to look, and re-renders only then', async () => {
    const server = new Server<ListDoc>();
    const { sync } = connect(lists, server, memoryStorage(), 'a');
    let renders = 0;
    sync.onState(() => renders++);

    await sync.refresh();
    assert.equal(renders, 0);

    server.saveElsewhere({ version: 1, items: ['山'] });
    await sync.refresh();
    assert.deepEqual(sync.getState().items, ['山']);
    assert.equal(renders, 1);
  });

  it('folds typing into one change, but never into a change already on its way', async () => {
    interface TitleDoc {
      version: 1;
      title: string;
    }
    const titles: Model<TitleDoc, { title: string }> = {
      empty: () => ({ version: 1, title: '' }),
      hydrate: (document) => structuredClone(document as TitleDoc),
      serialise: (state) => state,
      reduce: (state, action) => ({ ...state, title: action.title }),
      coalesce: (_last, next) => next,
    };
    const server = new Server<TitleDoc>();
    const { sync } = connect(titles, server, memoryStorage(), 'a');

    sync.dispatch({ title: '你' });
    sync.dispatch({ title: '你好' });
    assert.equal(sync.getStatus().unsaved, 1, 'two keystrokes, one change');

    let open = () => undefined as void;
    server.gate = new Promise<void>((resolve) => (open = resolve));
    const saving = sync.flush();
    await tick();

    sync.dispatch({ title: '你好吗' });
    assert.equal(sync.getStatus().unsaved, 2, 'not folded into the one being sent');

    server.gate = null;
    open();
    await saving;
    await sync.flush();
    assert.deepEqual(
      server.received.map((d) => d.title),
      ['你好', '你好吗'],
    );
  });
});
