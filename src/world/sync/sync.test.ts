import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apply, newSave } from '../core/save';
import type { WorldSave } from '../core/types';
import type { WorldSaveDto } from '../../../shared/world';
import type { PutOutcome, WorldGateway } from './gateway';
import { browserLocal, memoryLocal } from './local';
import { WorldSync, type Timers } from './sync';

/** A server holding one save, with the revision rule; can be switched off. */
class FakeServer implements WorldGateway {
  revision = 0;
  stored: unknown = null;
  up = true;
  puts: Array<{ base: number; save: WorldSave }> = [];
  newerBuild = false;

  async load(): Promise<WorldSaveDto> {
    if (!this.up) throw new Error('offline');
    return { revision: this.revision, save: this.stored, updatedAt: this.revision ? 1 : null };
  }
  async save(base: number, save: unknown): Promise<PutOutcome> {
    if (!this.up) throw new Error('offline');
    this.puts.push({ base, save: save as WorldSave });
    if (this.newerBuild) return { kind: 'outdated' };
    if (base !== this.revision) return { kind: 'conflict', current: { revision: this.revision, save: this.stored, updatedAt: 1 } };
    this.revision++;
    this.stored = JSON.parse(JSON.stringify(save));
    return { kind: 'saved', revision: this.revision };
  }
}

/** Timers that fire only when told, and a clock that moves with them. */
class FakeTimers implements Timers {
  t = 1_000_000;
  queue: Array<{ at: number; fn: () => void; id: number }> = [];
  private id = 0;
  set(fn: () => void, ms: number) {
    const id = ++this.id;
    this.queue.push({ at: this.t + ms, fn, id });
    return id;
  }
  clear(h: unknown) {
    this.queue = this.queue.filter((x) => x.id !== h);
  }
  /** Moves time on, firing what falls due, and lets the promises settle. */
  async advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at);
      const next = this.queue[0];
      if (!next || next.at > end) break;
      this.queue.shift();
      this.t = next.at;
      next.fn();
      await settle();
    }
    this.t = end;
    await settle();
  }
}
const settle = () => new Promise((r) => setTimeout(r, 0));

function rig(server = new FakeServer(), local = memoryLocal()) {
  const timers = new FakeTimers();
  const sync = new WorldSync({ gateway: server, local, deviceId: 'ipad', now: () => timers.t, timers });
  return { server, local, timers, sync };
}
const ctx = (now: number, deviceId = 'ipad') => ({ now, deviceId });

describe('opening a game', () => {
  it('a new game on a new account: starts at home and saves it', async () => {
    const { sync, server, timers } = rig();
    const s = await sync.open();
    assert.equal(s.place.map, 'siheyuan-room');
    await timers.advance(2000);
    assert.equal(server.revision, 1);
    assert.equal(sync.phase, 'saved');
  });

  it('takes the server save on a fresh device', async () => {
    const server = new FakeServer();
    const theirs = apply(newSave('mac', 5), { do: 'spirit', spirit: 'lion' }, ctx(10, 'mac'));
    server.revision = 4;
    server.stored = theirs;
    const { sync } = rig(server);
    const s = await sync.open();
    assert.ok('lion' in s.spirits);
  });

  it('offline, plays the device copy', async () => {
    const server = new FakeServer();
    server.up = false;
    const mine = apply(newSave('ipad', 5), { do: 'stamp', stamp: 'breakfast' }, ctx(10));
    const { sync } = rig(server, memoryLocal({ save: mine, revision: 3, dirty: false }));
    const s = await sync.open();
    assert.ok('breakfast' in s.stamps);
    assert.equal(sync.phase, 'offline');
  });

  it('device changes the server never took are merged with the server save, then sent', async () => {
    const server = new FakeServer();
    server.revision = 2;
    server.stored = apply(newSave('mac', 0), { do: 'spirit', spirit: 'fox' }, ctx(20, 'mac'));
    const mine = apply(newSave('ipad', 0), { do: 'spirit', spirit: 'lion' }, ctx(30));
    const { sync, timers } = rig(server, memoryLocal({ save: mine, revision: 1, dirty: true }));
    const s = await sync.open();
    assert.deepEqual(Object.keys(s.spirits).sort(), ['fox', 'lion']);
    await timers.advance(2000);
    assert.equal(server.revision, 3);
    assert.deepEqual(Object.keys((server.stored as WorldSave).spirits).sort(), ['fox', 'lion']);
  });

  it('a clean device copy older than the server gives way to it', async () => {
    const server = new FakeServer();
    server.revision = 5;
    server.stored = apply(newSave('mac', 0), { do: 'move', tile: [9, 9], facing: 'up' }, ctx(50, 'mac'));
    const { sync } = rig(server, memoryLocal({ save: newSave('ipad', 10), revision: 4, dirty: false }));
    assert.deepEqual((await sync.open()).place.tile, [9, 9]);
  });

  it('a save from a newer build: play on, never write over it', async () => {
    const server = new FakeServer();
    server.revision = 1;
    server.stored = { version: 99 };
    const { sync, timers } = rig(server, memoryLocal({ save: newSave('ipad', 0), revision: 1, dirty: true }));
    await sync.open();
    assert.equal(sync.phase, 'outdated');
    sync.update(apply(sync.current, { do: 'flag', flag: 'x' }, ctx(5)));
    await timers.advance(60_000);
    assert.equal(server.puts.length, 0);
  });
});

describe('saving while playing', () => {
  it('an important change goes after a moment; the device copy at once', async () => {
    const { sync, server, local, timers } = rig();
    await sync.open();
    await timers.advance(2000);
    sync.update(apply(sync.current, { do: 'stamp', stamp: 'map' }, ctx(timers.t)));
    assert.equal(local.copy?.dirty, true);
    assert.ok('map' in (local.copy!.save as WorldSave).stamps);
    assert.equal(server.revision, 1);
    await timers.advance(1600);
    assert.equal(server.revision, 2);
    assert.equal(local.copy?.dirty, false);
  });

  it('walking saves at most every 30 s', async () => {
    const { sync, server, timers } = rig();
    await sync.open();
    await timers.advance(2000);
    const puts = server.puts.length;
    for (let i = 0; i < 20; i++) {
      sync.update(apply(sync.current, { do: 'move', tile: [i, 1], facing: 'right' }, ctx(timers.t)), 'walk');
      await timers.advance(1000);
    }
    // 20 s of walking right after a save: nothing yet.
    assert.equal(server.puts.length, puts);
    await timers.advance(15_000);
    assert.equal(server.puts.length, puts + 1);
  });

  it('an important change during a walk does not wait for the 30 s', async () => {
    const { sync, server, timers } = rig();
    await sync.open();
    await timers.advance(2000);
    sync.update(apply(sync.current, { do: 'move', tile: [2, 1], facing: 'right' }, ctx(timers.t)), 'walk');
    sync.update(apply(sync.current, { do: 'give', item: 'baozi' }, ctx(timers.t)));
    await timers.advance(2000);
    assert.equal(server.revision, 2);
  });

  it('hiding the tab sends at once', async () => {
    const { sync, server, timers } = rig();
    await sync.open();
    await timers.advance(2000);
    sync.update(apply(sync.current, { do: 'move', tile: [3, 1], facing: 'right' }, ctx(timers.t)), 'walk');
    const handlers: Record<string, () => void> = {};
    const doc = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: (n: string, f: () => void) => (handlers[n] = f),
      removeEventListener: () => undefined,
    };
    sync.attach(doc as unknown as Document);
    doc.visibilityState = 'hidden';
    handlers.visibilitychange!();
    await settle();
    assert.equal(server.revision, 2);
  });

  it('a conflict: merges with the other device and saves on its revision', async () => {
    const { sync, server, timers } = rig();
    await sync.open();
    await timers.advance(2000);
    // The Mac saves in between.
    server.revision = 2;
    server.stored = apply(server.stored as WorldSave, { do: 'idiom', idiom: '马马虎虎' }, ctx(timers.t, 'mac'));
    sync.update(apply(sync.current, { do: 'spirit', spirit: 'lion' }, ctx(timers.t)));
    await timers.advance(2000);
    assert.equal(server.revision, 3);
    const stored = server.stored as WorldSave;
    assert.ok('马马虎虎' in stored.idioms);
    assert.ok('lion' in stored.spirits);
    assert.ok('马马虎虎' in sync.current.idioms);
    assert.equal(sync.phase, 'saved');
  });

  it('offline: keeps the change, tries again, and sends it when the server is back', async () => {
    const { sync, server, local, timers } = rig();
    await sync.open();
    await timers.advance(2000);
    server.up = false;
    sync.update(apply(sync.current, { do: 'stamp', stamp: 'subway' }, ctx(timers.t)));
    await timers.advance(2000);
    assert.equal(sync.phase, 'offline');
    assert.equal(local.copy?.dirty, true);
    server.up = true;
    await timers.advance(16_000);
    assert.equal(sync.phase, 'saved');
    assert.ok('subway' in (server.stored as WorldSave).stamps);
  });

  it('a change made while a save is on its way is not lost', async () => {
    const server = new FakeServer();
    const { sync, timers } = rig(server);
    await sync.open();
    await timers.advance(2000);
    sync.update(apply(sync.current, { do: 'flag', flag: 'a' }, ctx(timers.t)));
    const sending = sync.flush();
    sync.update(apply(sync.current, { do: 'flag', flag: 'b' }, ctx(timers.t)));
    await sending;
    await timers.advance(2000);
    assert.deepEqual((server.stored as WorldSave).flags, ['a', 'b']);
    assert.equal(sync.phase, 'saved');
  });
});

describe('the device copy', () => {
  it('survives a full or broken storage without throwing', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    const store = browserLocal('u1', broken);
    assert.equal(store.read(), null);
    store.write({ save: {}, revision: 1, dirty: true });
  });

  it('round-trips through storage, one key per account', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    browserLocal('u1', storage).write({ save: { version: 1 }, revision: 2, dirty: true });
    assert.deepEqual(browserLocal('u1', storage).read(), { save: { version: 1 }, revision: 2, dirty: true });
    assert.equal(browserLocal('u2', storage).read(), null);
  });
});
