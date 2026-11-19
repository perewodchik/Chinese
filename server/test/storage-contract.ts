import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { TalkConversation } from '../../shared/talk';
import type { Stores } from '../src/composition';

/**
 * The storage's contract (R12): one set of tests that both stores pass — the
 * SQLite one on this machine and the Postgres one on Vercel — so the two
 * cannot drift apart in what they do. Run against SQLite in memory
 * (sqlite.test.ts) and against a real Postgres compiled to WebAssembly
 * (postgres.test.ts): the dialect, the unique constraints and the
 * compare-and-swap that decides who wins a save, tried in both.
 */

const T = Date.UTC(2026, 8, 11, 9);
const user = (id: string, key = id) => ({
  id,
  username: key.toUpperCase(),
  usernameKey: key,
  passwordHash: `hash-of-${id}`,
  createdAt: T,
  updatedAt: T,
  role: 'learner' as const,
  status: 'active' as const,
  flags: {},
});

/** A store to try, and how to put it away; `sessionsOf` counts an account's sessions in the database itself. */
export interface ContractStore {
  stores: Stores;
  close: () => Promise<void>;
  sessionsOf: (userId: string) => Promise<number>;
}

export function storageContract(name: string, make: () => Promise<ContractStore>): void {
  describe(name, () => {
    let made: ContractStore;
    let stores: Stores;

    before(async () => {
      made = await make();
      stores = made.stores;
    });

    after(async () => {
      await made.close();
    });

    it('keeps a user, and reads back the times as numbers', async () => {
      assert.equal(await stores.users.insert(user('u1', 'kirill')), true);
      const found = await stores.users.findByUsernameKey('kirill');
      assert.equal(found?.id, 'u1');
      assert.equal(found?.passwordHash, 'hash-of-u1');
      // A BIGINT arrives as a string unless it is asked to arrive as a number,
      // and a time that is a string compares wrongly against every deadline.
      assert.equal(typeof found?.createdAt, 'number');
      assert.equal(found?.createdAt, T);
    });

    it('refuses a second user with the same name, without throwing', async () => {
      assert.equal(await stores.users.insert(user('u2', 'kirill')), false);
      assert.equal(await stores.users.findById('u2'), null);
    });

    it('changes a password and lists in the order accounts were made', async () => {
      await stores.users.insert({ ...user('u3', 'other'), createdAt: T + 1 });
      await stores.users.updatePassword('u1', 'newer', T + 5);
      const again = await stores.users.findById('u1');
      assert.equal(again?.passwordHash, 'newer');
      assert.equal(again?.updatedAt, T + 5);
      assert.deepEqual((await stores.users.list()).map((u) => u.id), ['u1', 'u3']);
    });

    it('keeps a session, touches it, and forgets one', async () => {
      const s = { id: 's1', userId: 'u1', createdAt: T, lastSeenAt: T, expiresAt: T + 1000, userAgent: 'iPad', verifiedAt: T };
      await stores.sessions.insert(s);
      assert.equal((await stores.sessions.findById('s1'))?.userAgent, 'iPad');
      await stores.sessions.touch('s1', T + 10, T + 2000);
      assert.equal((await stores.sessions.findById('s1'))?.expiresAt, T + 2000);
      await stores.sessions.delete('s1');
      assert.equal(await stores.sessions.findById('s1'), null);
    });

    it('signs every other browser out, and sweeps what has expired', async () => {
      for (const id of ['a', 'b', 'c']) {
        await stores.sessions.insert({
          id, userId: 'u1', createdAt: T, lastSeenAt: T, expiresAt: T + 1000, userAgent: null, verifiedAt: T,
        });
      }
      await stores.sessions.insert({
        id: 'other', userId: 'u3', createdAt: T, lastSeenAt: T, expiresAt: T + 1000, userAgent: null, verifiedAt: T,
      });
      assert.equal(await stores.sessions.deleteForUser('u1', 'b'), 2);
      assert.equal((await stores.sessions.findById('b'))?.id, 'b');
      assert.equal((await stores.sessions.findById('other'))?.id, 'other');
      assert.equal(await stores.sessions.deleteExpired(T + 5000), 2);
    });

    it('takes a first workspace once, and refuses a second first save', async () => {
      const first = await stores.workspaces.save('u1', 0, { version: 6, hello: 'world' }, T);
      assert.deepEqual(first, { saved: true, revision: 1, updatedAt: T });
      assert.equal(await stores.workspaces.revisionOf('u1'), 1);

      const again = await stores.workspaces.save('u1', 0, { version: 6 }, T + 1);
      assert.equal(again.saved, false);
      assert.equal(again.saved === false && again.current?.revision, 1);
    });

    it('lets one of two saves built on the same revision win', async () => {
      const mine = await stores.workspaces.save('u1', 1, { version: 6, from: 'pc' }, T + 2);
      assert.deepEqual(mine, { saved: true, revision: 2, updatedAt: T + 2 });

      const stale = await stores.workspaces.save('u1', 1, { version: 6, from: 'ipad' }, T + 3);
      assert.equal(stale.saved, false);
      assert.equal(stale.saved === false && stale.current?.revision, 2);
      assert.deepEqual(stale.saved === false && stale.current?.document, { version: 6, from: 'pc' });
    });

    it('will not let a build older than the stored document write over it', async () => {
      const newer = await stores.workspaces.save('u1', 2, { version: 7, from: 'new build' }, T + 4);
      assert.deepEqual(newer, { saved: true, revision: 3, updatedAt: T + 4 });

      const older = await stores.workspaces.save('u1', 3, { version: 6, from: 'old tab' }, T + 5);
      assert.equal(older.saved, false);
      assert.equal(older.saved === false && older.current?.revision, 3);
      assert.deepEqual(older.saved === false && older.current?.document, { version: 7, from: 'new build' });
    });

    it('has nothing for an account that has saved nothing', async () => {
      assert.equal(await stores.workspaces.revisionOf('u3'), 0);
      assert.equal(await stores.workspaces.find('u3'), null);
    });

    it('takes a workspace away with the account that owned it', async () => {
      await stores.users.delete('u3');
      assert.equal(await stores.users.findById('u3'), null);
      // ON DELETE CASCADE, which SQLite only obeys with a pragma and Postgres
      // always does — the sessions and the saved work have to go with it.
      assert.equal(await made.sessionsOf('u3'), 0);
    });

    it('keeps a recording as bytes, once, and says which keys it has', async () => {
      const wang = { id: 'wang', name: 'Teacher Wang', gender: 'female' as const };
      const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x01]);
      await stores.recordings.save({ key: 'k1', voice: wang, text: '天空是蓝色的。', mp3, createdAt: T });
      // A second recording under the same key leaves the first as it was.
      await stores.recordings.save({ key: 'k1', voice: wang, text: '天空是蓝色的。', mp3: new Uint8Array([1]), createdAt: T + 1 });
      assert.deepEqual(await stores.recordings.find('k1'), mp3);
      assert.equal(await stores.recordings.find('k2'), null);
      assert.deepEqual([...(await stores.recordings.have(['k1', 'k2']))], ['k1']);
      assert.deepEqual([...(await stores.recordings.have([]))], []);
      assert.deepEqual(await stores.recordings.voices(), [wang]);
    });
    it('keeps a picture as bytes, once, with its owner', async () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x02]);
      await stores.pictures.save({ key: 'p1', userId: 'u1', mime: 'image/jpeg', bytes, createdAt: T });
      await stores.pictures.save({ key: 'p1', userId: 'u1', mime: 'image/png', bytes: new Uint8Array([1]), createdAt: T + 1 });
      assert.deepEqual(await stores.pictures.find('u1', 'p1'), { key: 'p1', userId: 'u1', mime: 'image/jpeg', bytes, createdAt: T });
      assert.equal(await stores.pictures.find('u1', 'p2'), null);
      // SEC13: the same picture under another account is that account's own.
      await stores.users.insert(user('pic-2', 'zzpic'));
      await stores.pictures.save({ key: 'p1', userId: 'pic-2', mime: 'image/jpeg', bytes, createdAt: T + 2 });
      assert.equal((await stores.pictures.find('pic-2', 'p1'))?.createdAt, T + 2);
      assert.equal((await stores.pictures.find('u1', 'p1'))?.createdAt, T);
    });

    it('adds a day’s use of a service to its row, and reads the counts back as numbers', async () => {
      await stores.usage.add('u1', '2026-09-11', 'minimax', 1, 40);
      await stores.usage.add('u1', '2026-09-11', 'minimax', 1, 2);
      await stores.usage.add('u1', '2026-09-10', 'speechsuper', 1, 3);
      assert.deepEqual(await stores.usage.since('u1', '2026-09-11'), [{ day: '2026-09-11', service: 'minimax', calls: 2, units: 42 }]);
      assert.equal((await stores.usage.since('u1', '2026-09-01')).length, 2);
    });

    it('lets an invitation be claimed once and only before it runs out, and given back', async () => {
      await stores.invites.insert({ digest: 'd1', note: 'Masha', createdAt: T, expiresAt: T + 1000, usedBy: null, usedAt: null });
      assert.equal(await stores.invites.claim('d1', 'u1', T + 2000), false);
      assert.equal(await stores.invites.claim('d1', 'u1', T + 10), true);
      assert.equal(await stores.invites.claim('d1', 'u2', T + 20), false);
      await stores.invites.release('d1', 'u2');
      assert.equal((await stores.invites.list())[0]!.usedBy, 'u1');
      await stores.invites.release('d1', 'u1');
      assert.deepEqual((await stores.invites.list())[0], { digest: 'd1', note: 'Masha', createdAt: T, expiresAt: T + 1000, usedBy: null, usedAt: null, revokedAt: null, createdBy: null, maxUses: 1, uses: 0, usedByAll: [] });
      // A8: one for a group takes as many as it was made for, and keeps who came.
      await stores.invites.insert({ digest: 'd2', note: 'Class', createdAt: T, expiresAt: null, usedBy: null, usedAt: null, maxUses: 2 });
      assert.equal(await stores.invites.claim('d2', 'u1', T + 1), true);
      assert.equal(await stores.invites.claim('d2', 'u2', T + 2), true);
      assert.equal(await stores.invites.claim('d2', 'u3', T + 3), false);
      const group = (await stores.invites.list()).find((i) => i.digest === 'd2')!;
      assert.deepEqual([group.uses, group.usedBy, group.usedByAll], [2, 'u1', [{ userId: 'u1', at: T + 1 }, { userId: 'u2', at: T + 2 }]]);
      assert.equal(await stores.invites.revoke('d2', T + 4), false);
    });

    it('counts attempts per key per window in one statement, and forgets a key or an old window', async () => {
      assert.equal(await stores.limits.hit('auth.perName:x', T), 1);
      assert.equal(await stores.limits.hit('auth.perName:x', T), 2);
      assert.equal(await stores.limits.hit('auth.perName:x', T + 60_000), 1);
      await stores.limits.reset('auth.perName:x');
      assert.equal(await stores.limits.hit('auth.perName:x', T), 1);
      await stores.limits.sweep(T + 1);
      assert.equal(await stores.limits.hit('auth.perName:x', T), 1);
    });

    it('keeps an answer the same for everyone, and gives it back only while it is fresh enough', async () => {
      await stores.lookups.put('youtube:video:x', '{"a":1}', T);
      await stores.lookups.put('youtube:video:x', '{"a":2}', T + 10);
      assert.equal(await stores.lookups.get('youtube:video:x', T), '{"a":2}');
      assert.equal(await stores.lookups.get('youtube:video:x', T + 11), null);
      assert.equal(await stores.lookups.get('youtube:video:y', 0), null);
    });

    it('lists a user’s sessions still good, the one used last first', async () => {
      await stores.users.insert(user('u9'));
      await stores.sessions.insert({ id: 's9a', userId: 'u9', createdAt: T, lastSeenAt: T + 5, expiresAt: T + 1000, userAgent: 'iPad', verifiedAt: T });
      await stores.sessions.insert({ id: 's9b', userId: 'u9', createdAt: T, lastSeenAt: T + 9, expiresAt: T + 1000, userAgent: 'iPhone', verifiedAt: T });
      await stores.sessions.insert({ id: 's9c', userId: 'u9', createdAt: T, lastSeenAt: T + 1, expiresAt: T + 10, userAgent: 'old', verifiedAt: T });
      assert.deepEqual((await stores.sessions.listForUser('u9', T + 100)).map((s) => s.id), ['s9b', 's9a']);
    });

    it('keeps recovery codes as digests, each used once, and replaces them all at once', async () => {
      await stores.recoveryCodes.replace('u9', ['a', 'b'], T);
      assert.deepEqual(await stores.recoveryCodes.status('u9'), { left: 2, createdAt: T });
      assert.equal(await stores.recoveryCodes.use('u9', 'a', T + 1), true);
      assert.equal(await stores.recoveryCodes.use('u9', 'a', T + 2), false);
      assert.equal(await stores.recoveryCodes.use('u1', 'b', T + 2), false);
      assert.deepEqual(await stores.recoveryCodes.status('u9'), { left: 1, createdAt: T });
      await stores.recoveryCodes.replace('u9', ['c'], T + 5);
      assert.equal(await stores.recoveryCodes.use('u9', 'b', T + 6), false);
      assert.deepEqual(await stores.recoveryCodes.status('u9'), { left: 1, createdAt: T + 5 });
    });

    it('sums what an account keeps across its tables, in bytes', async () => {
      await stores.users.insert(user('u7'));
      const before = await stores.storage.usedBy('u7');
      await stores.pictures.save({ key: 'p7', userId: 'u7', mime: 'image/jpeg', bytes: new Uint8Array(1000), createdAt: T });
      await stores.workspaces.save('u7', 0, { note: '你好' }, T);
      const after = await stores.storage.usedBy('u7');
      assert.equal(before, 0);
      assert.ok(after >= 1000 + JSON.stringify({ note: '你好' }).length, String(after));
      assert.equal(await stores.storage.usedBy('nobody'), 0);
    });

    it('keeps what happened to accounts, the latest first, and forgets what is old', async () => {
      await stores.audit.add({ at: T, kind: 'sign-up', username: 'masha', ip: '203.0.113.7', userAgent: null });
      await stores.audit.add({ at: T + 5, kind: 'sign-in-refused', username: 'masha', ip: '203.0.113.7', userAgent: 'iPhone' });
      assert.deepEqual((await stores.audit.recent(10)).map((e) => e.kind), ['sign-in-refused', 'sign-up']);
      await stores.audit.sweep(T + 1);
      assert.deepEqual((await stores.audit.recent(10)).map((e) => [e.kind, e.at]), [['sign-in-refused', T + 5]]);
    });

    it('keeps an access token as its digest, lists the live ones, and revokes one or all', async () => {
      const token = (id: string, at: number) => ({ id, userId: 'u1', name: `script ${id}`, digest: `d-${id}`, scopes: ['texts:write'], createdAt: at, lastUsedAt: null, expiresAt: at + 1000, revokedAt: null });
      await stores.apiTokens.insert(token('t1', T));
      await stores.apiTokens.insert(token('t2', T + 1));
      const found = await stores.apiTokens.findByDigest('d-t1');
      assert.deepEqual(found, token('t1', T));
      await stores.apiTokens.touch('t1', T + 50);
      assert.equal((await stores.apiTokens.findByDigest('d-t1'))?.lastUsedAt, T + 50);
      assert.deepEqual((await stores.apiTokens.listForUser('u1')).map((t) => t.id), ['t2', 't1']);
      assert.equal(await stores.apiTokens.revoke('u2', 't1', T + 60), false, 'not another account’s to revoke');
      assert.equal(await stores.apiTokens.revoke('u1', 't1', T + 60), true);
      assert.equal(await stores.apiTokens.revoke('u1', 't1', T + 61), false);
      assert.equal((await stores.apiTokens.findByDigest('d-t1'))?.revokedAt, T + 60);
      assert.equal(await stores.apiTokens.revokeForUser('u1', T + 70), 1);
      assert.deepEqual(await stores.apiTokens.listForUser('u1'), []);
    });

    it('keeps a role, a status and flags, and counts the accounts with a role', async () => {
      await stores.users.insert({ ...user('u-roles', 'zhang'), flags: { tutor: true } });
      const made = await stores.users.findById('u-roles');
      assert.equal(made?.role, 'learner');
      assert.equal(made?.status, 'active');
      assert.deepEqual(made?.flags, { tutor: true });
      const before = await stores.users.countByRole('admin');
      await stores.users.setRole('u-roles', 'admin', T + 1);
      await stores.users.setStatus('u-roles', 'blocked', T + 2);
      const changed = await stores.users.findById('u-roles');
      assert.equal(changed?.role, 'admin');
      assert.equal(changed?.status, 'blocked');
      assert.equal(await stores.users.countByRole('admin'), before + 1);
      assert.equal(typeof (await stores.users.countByRole('admin')), 'number');
    });

    it('keeps the admins’ log newest first, finds by action and by either name, and pages by id', async () => {
      const line = (at: number, action: string, target: string | null) => ({ at, actorId: null, actorName: 'Kirill', action, targetId: null, targetName: target, details: { note: `at ${at}` }, ip: '203.0.113.7' });
      await stores.adminLog.add(line(T, 'invite-made', null));
      await stores.adminLog.add(line(T + 1, 'blocked', 'Masha'));
      await stores.adminLog.add(line(T + 2, 'invite-made', null));
      const all = await stores.adminLog.list({ limit: 10 });
      assert.deepEqual(all.map((e) => e.at), [T + 2, T + 1, T]);
      assert.equal(typeof all[0]!.id, 'number');
      assert.deepEqual(all[0]!.details, { note: `at ${T + 2}` });
      assert.deepEqual((await stores.adminLog.list({ action: 'invite-made', limit: 10 })).map((e) => e.at), [T + 2, T]);
      assert.deepEqual((await stores.adminLog.list({ name: 'masha', limit: 10 })).map((e) => e.action), ['blocked']);
      assert.deepEqual((await stores.adminLog.list({ name: 'KIRILL', before: all[0]!.id, limit: 1 })).map((e) => e.at), [T + 1]);
      await stores.adminLog.sweep(T + 1);
      assert.equal((await stores.adminLog.list({ limit: 10 })).length, 2);
    });

    it('keeps a catalogue book with its texts in order, replaces them on a new version, hides it, and keeps its pictures', async () => {
      const book = { id: 'b1', title: 'Pikachu', titleZh: '皮卡丘', level: 2, kind: 'story' as const, blurb: 'x', source: 'y', licence: 'CC0' as const, version: 1, publishedAt: T, publishedBy: 'u1', hiddenAt: null, texts: 2, chars: 5 };
      await stores.catalog.save(book, [
        { id: 't2', position: 1, document: { id: 't2', lines: [{ zh: '二' }] }, chars: 1 },
        { id: 't1', position: 0, document: { id: 't1', lines: [{ zh: '一' }] }, chars: 1 },
      ]);
      assert.deepEqual(await stores.catalog.find('b1'), { ...book, position: T });
      assert.deepEqual((await stores.catalog.texts('b1')).map((t) => [t.id, t.position, t.document]), [['t1', 0, { id: 't1', lines: [{ zh: '一' }] }], ['t2', 1, { id: 't2', lines: [{ zh: '二' }] }]]);
      await stores.catalog.save({ ...book, version: 2, texts: 1 }, [{ id: 't3', position: 0, document: { id: 't3' }, chars: 0 }]);
      assert.deepEqual((await stores.catalog.texts('b1')).map((t) => t.id), ['t3']);
      assert.equal((await stores.catalog.find('b1'))?.version, 2);
      assert.equal(await stores.catalog.setHidden('b1', T + 5), true);
      assert.deepEqual(await stores.catalog.list(false), []);
      assert.equal((await stores.catalog.list(true))[0]?.hiddenAt, T + 5);
      assert.equal(await stores.catalog.setHidden('nope', null), false);
      const bytes = new Uint8Array([1, 2, 3]);
      await stores.catalog.savePicture({ key: 'k1', mime: 'image/png', bytes, createdAt: T });
      await stores.catalog.savePicture({ key: 'k1', mime: 'image/jpeg', bytes: new Uint8Array([9]), createdAt: T });
      assert.deepEqual(await stores.catalog.findPicture('k1'), { mime: 'image/png', bytes });
      assert.equal(await stores.catalog.findPicture('k2'), null);

      // A9: a newer book goes first, moves keep their place through a new version, the band changes, readers are counted once.
      await stores.catalog.save({ ...book, id: 'b2', publishedAt: T + 10, hiddenAt: null }, []);
      assert.deepEqual((await stores.catalog.list(true)).map((b) => b.id), ['b2', 'b1']);
      assert.equal(await stores.catalog.move('b1', 'earlier'), true);
      assert.equal(await stores.catalog.move('b1', 'earlier'), false);
      await stores.catalog.save({ ...(await stores.catalog.find('b1'))!, version: 3 }, []);
      assert.deepEqual((await stores.catalog.list(true)).map((b) => b.id), ['b1', 'b2']);
      assert.equal(await stores.catalog.setLevel('b2', 4), true);
      assert.equal((await stores.catalog.find('b2'))?.level, 4);
      await stores.users.insert(user('r1', 'reader1'));
      await stores.users.insert(user('r2', 'reader2'));
      await stores.catalog.markReader('b2', 'r1', T, false);
      await stores.catalog.markReader('b2', 'r1', T + 1, true);
      await stores.catalog.markReader('b2', 'r1', T + 2, false);
      await stores.catalog.markReader('b2', 'r2', T + 3, false);
      assert.deepEqual([...(await stores.catalog.readers())], [['b2', { took: 2, finished: 1 }]]);
    });

    it('keeps a reset link once, for a day, the newer one for an account replacing the older (A6)', async () => {
      await stores.users.insert(user('reset-1'));
      const at = T + 10;
      await stores.passwordResets.create({ digest: 'd1', userId: 'reset-1', createdAt: at, expiresAt: at + 1000, createdBy: 'admin' });
      await stores.passwordResets.create({ digest: 'd2', userId: 'reset-1', createdAt: at, expiresAt: at + 1000, createdBy: 'admin' });
      assert.equal(await stores.passwordResets.find('d1', at), null);
      assert.equal(await stores.passwordResets.find('d2', at), 'reset-1');
      assert.equal(await stores.passwordResets.find('d2', at + 1000), null);
      assert.equal(await stores.passwordResets.use('d2', at + 1), 'reset-1');
      assert.equal(await stores.passwordResets.use('d2', at + 2), null);
    });

    it('takes an invitation back once, and a taken-back one makes no account (A8)', async () => {
      await stores.users.insert(user('inv-1'));
      await stores.invites.insert({ digest: 'inv-d', note: 'n', createdAt: T, expiresAt: null, usedBy: null, usedAt: null, createdBy: 'inv-1' });
      assert.equal(await stores.invites.revoke('inv-d', T + 1), true);
      assert.equal(await stores.invites.revoke('inv-d', T + 2), false);
      assert.equal(await stores.invites.claim('inv-d', 'inv-1', T + 3), false);
      const kept = (await stores.invites.list()).find((i) => i.digest === 'inv-d')!;
      assert.deepEqual([kept.revokedAt, kept.createdBy], [T + 1, 'inv-1']);
    });

    it('keeps feedback newest first, by status, and marks it (A12)', async () => {
      await stores.users.insert(user('fb-1'));
      const item = (id: string, at: number) => ({ id, userId: 'fb-1', kind: 'wrong', message: `m ${id}`, page: '/read', createdAt: at, status: 'new', updatedAt: at });
      await stores.feedback.add(item('f1', T));
      await stores.feedback.add(item('f2', T + 5));
      assert.deepEqual((await stores.feedback.list({ limit: 10 })).map((f) => [f.id, f.createdAt]), [['f2', T + 5], ['f1', T]]);
      assert.equal(await stores.feedback.setStatus('f1', 'closed', T + 9), true);
      assert.equal(await stores.feedback.setStatus('nope', 'closed', T + 9), false);
      assert.deepEqual((await stores.feedback.list({ status: 'closed', limit: 10 })).map((f) => f.id), ['f1']);
    });

    it('sums the whole site’s use a day a service, and who used most (A10)', async () => {
      await stores.users.insert(user('cost-1', 'zzcost'));
      await stores.usage.add('cost-1', '2031-01-02', 'minimax', 2, 700);
      await stores.usage.add('u1', '2031-01-02', 'minimax', 1, 100);
      await stores.usage.add('u1', '2030-12-30', 'minimax', 9, 900);
      assert.deepEqual(await stores.usage.siteSince('2031-01-01'), [{ day: '2031-01-02', service: 'minimax', calls: 3, units: 800 }]);
      assert.deepEqual((await stores.usage.topSince('2031-01-01', 1))[0], { userId: 'cost-1', service: 'minimax', calls: 2, units: 700 });
    });

    it('keeps an account’s day in numbers, each count only growing (A7)', async () => {
      await stores.users.insert(user('act-1', 'zzact'));
      const c = (minutes: number, answers: number) => ({ minutes, textsRead: 1, answers, spoken: 0, videos: 0 });
      await stores.activity.record('act-1', '2031-02-01', c(10, 50), T);
      await stores.activity.record('act-1', '2031-02-01', c(4, 70), T + 1);
      await stores.activity.record('act-1', '2031-01-01', c(9, 9), T + 2);
      const rows = await stores.activity.since('2031-02-01');
      assert.deepEqual(rows.map((r) => [r.userId, r.day, r.minutes, r.answers]), [['act-1', '2031-02-01', 10, 70]]);
    });

    it('keeps what broke on screens, newest first, and lets the old go (R15)', async () => {
      await stores.clientErrors.add({ id: 'ce1', userId: 'act-1', at: T, message: 'old', page: '/', userAgent: null });
      await stores.clientErrors.add({ id: 'ce2', userId: 'act-1', at: T + 9, message: 'new', page: '/read', userAgent: 'iPad' });
      assert.deepEqual((await stores.clientErrors.recent(5)).map((e) => e.message), ['new', 'old']);
      await stores.clientErrors.sweep(T + 1);
      assert.deepEqual((await stores.clientErrors.recent(5)).map((e) => e.id), ['ce2']);
    });

    it('reads one account’s days, and its room by kind (A5)', async () => {
      assert.equal((await stores.activity.forUser('act-1', '2031-01-01')).length, 2);
      assert.deepEqual(await stores.activity.forUser('nobody', '2031-01-01'), []);
      const room = await stores.storage.byKind('act-1');
      assert.deepEqual(Object.keys(room).sort(), ['conversations', 'game', 'pictures', 'readings', 'tries', 'work']);
    });

    it('keeps the site’s settings, one value a key, the last write winning (A11)', async () => {
      await stores.siteSettings.set('registration', '"invite"', T, 'kirill');
      await stores.siteSettings.set('registration', '"closed"', T + 1, 'masha');
      await stores.siteSettings.set('announcement', '"Hi"', T + 2, 'kirill');
      const all = (await stores.siteSettings.all()).sort((a, b) => a.key.localeCompare(b.key));
      assert.deepEqual(all, [
        { key: 'announcement', value: '"Hi"', updatedAt: T + 2, updatedBy: 'kirill' },
        { key: 'registration', value: '"closed"', updatedAt: T + 1, updatedBy: 'masha' },
      ]);
    });

    it('reads the accounts’ log since a time, by kind, oldest first (SEC15)', async () => {
      const e = (at: number, kind: string) => ({ at, kind, username: 'w', ip: '1.2.3.4', userAgent: null });
      await stores.audit.add(e(T + 100, 'sign-in'));
      await stores.audit.add(e(T + 200, 'rate-limited'));
      await stores.audit.add(e(T + 300, 'sign-in-refused'));
      assert.deepEqual((await stores.audit.since(T + 150, ['sign-in-refused', 'rate-limited'], 10)).map((x) => [x.at, x.kind]), [
        [T + 200, 'rate-limited'],
        [T + 300, 'sign-in-refused'],
      ]);
      assert.deepEqual(await stores.audit.since(T, [], 10), []);
    });

    it('lists accounts with their room, browsers and month in one query, searched and paged (A4)', async () => {
      await stores.users.insert(user('dir-1', 'zzdir_anna'));
      await stores.users.insert(user('dir-2', 'zzdir_boris'));
      await stores.usage.add('dir-1', '2026-09-20', 'minimax', 1, 300);
      await stores.usage.add('dir-1', '2026-08-20', 'minimax', 1, 999);
      const found = await stores.accounts.page({ q: 'zzdir', sort: 'spent', offset: 0, limit: 10, now: T, monthStart: '2026-09-01' });
      assert.equal(found.total, 2);
      assert.deepEqual(found.rows.map((r) => [r.id, r.charactersReadThisMonth, r.devices, typeof r.storageBytes]), [
        ['dir-1', 300, 0, 'number'],
        ['dir-2', 0, 0, 'number'],
      ]);
      assert.equal((await stores.accounts.page({ q: 'zzdir', sort: 'joined', offset: 1, limit: 1, now: T, monthStart: '2026-09-01' })).rows.length, 1);
    });
    // R12: the stores the contract did not yet try in both databases.
    it('keeps 走走’s save under the same compare-and-swap, refusing an older build’s', async () => {
      await stores.users.insert(user('w1', 'walker'));
      assert.equal(await stores.worldSaves.revisionOf('w1'), 0);
      const first = await stores.worldSaves.save('w1', 0, { version: 2, at: 'gulou' }, T);
      assert.deepEqual(first, { saved: true, revision: 1, updatedAt: T });
      assert.equal((await stores.worldSaves.save('w1', 0, { version: 2 }, T + 1)).saved, false);
      assert.equal((await stores.worldSaves.save('w1', 1, { version: 1, at: 'old' }, T + 2)).saved, false);
      assert.equal((await stores.worldSaves.save('w1', 1, { version: 3, at: 'houhai' }, T + 3)).saved, true);
      assert.deepEqual(await stores.worldSaves.find('w1'), { userId: 'w1', revision: 2, save: { version: 3, at: 'houhai' }, updatedAt: T + 3 });
      assert.equal(await stores.worldSaves.find('nobody'), null);
    });

    it('keeps conversations for their owner only, newest first, and saves over and deletes only theirs', async () => {
      await stores.users.insert(user('c1', 'talker1'));
      await stores.users.insert(user('c2', 'talker2'));
      const options = { level: 'hsk1', length: 'short', explain: true, words: true, hints: false, topic: '' } as unknown as TalkConversation['options'];
      const talk = (id: string, at: number, turns: TalkConversation['turns'] = []): TalkConversation => ({ id, title: `Talk ${id}`, options, voice: null, turns, createdAt: at, updatedAt: at });
      await stores.conversations.create('c1', talk('t1', T));
      await stores.conversations.create('c1', talk('t2', T + 5, [{ who: 'tutor', hanzi: '你好', pinyin: 'nǐ hǎo', english: 'Hello' }]));
      assert.deepEqual((await stores.conversations.list('c1', 10)).map((c) => [c.id, c.turns]), [['t2', 1], ['t1', 0]]);
      assert.equal((await stores.conversations.list('c1', 1)).length, 1);
      assert.equal(await stores.conversations.find('c2', 't1'), null);
      assert.equal(await stores.conversations.save('c2', { ...talk('t1', T), title: 'taken' }), false);
      assert.equal(await stores.conversations.save('c1', { ...talk('t1', T), title: 'Renamed', updatedAt: T + 9 }), true);
      assert.equal((await stores.conversations.find('c1', 't1'))?.title, 'Renamed');
      assert.deepEqual((await stores.conversations.find('c1', 't2'))?.turns, [{ who: 'tutor', hanzi: '你好', pinyin: 'nǐ hǎo', english: 'Hello' }]);
      assert.equal(await stores.conversations.delete('c2', 't1'), false);
      assert.equal(await stores.conversations.delete('c1', 't1'), true);
      assert.equal(await stores.conversations.find('c1', 't1'), null);
    });

    it('keeps a learner’s secret by name, replaces it, and forgets it', async () => {
      await stores.users.insert(user('k1', 'keeper'));
      assert.equal(await stores.secrets.get('k1', 'minimax'), null);
      await stores.secrets.set('k1', 'minimax', 'one', T);
      await stores.secrets.set('k1', 'minimax', 'two', T + 1);
      await stores.secrets.set('k1', 'speech-eval', 'three', T + 2);
      assert.deepEqual([await stores.secrets.get('k1', 'minimax'), await stores.secrets.get('k1', 'speech-eval'), await stores.secrets.get('u1', 'minimax')], ['two', 'three', null]);
      await stores.secrets.delete('k1', 'minimax');
      assert.equal(await stores.secrets.get('k1', 'minimax'), null);
      assert.equal(await stores.secrets.get('k1', 'speech-eval'), 'three');
    });

    it('keeps each try once, oldest first, its answer only when asked for one, and only for its owner', async () => {
      await stores.users.insert(user('a1', 'sayer1'));
      await stores.users.insert(user('a2', 'sayer2'));
      const tryOf = (id: string, at: number, userId = 'a1') => ({ id, userId, at, kind: 'phrase' as const, sourceId: 's1', text: '你好', tally: null, good: true, summary: '{"total":80}', result: at > T ? '{"full":true}' : null });
      await stores.speechAttempts.add([tryOf('p2', T + 1), tryOf('p1', T)]);
      await stores.speechAttempts.add([{ ...tryOf('p1', T), text: 'again' }, tryOf('q1', T, 'a2')]);
      const list = await stores.speechAttempts.list('a1');
      assert.deepEqual(list.map((a) => [a.id, a.text, a.hasResult, a.good]), [['p1', '你好', false, true], ['p2', '你好', true, true]]);
      assert.equal('result' in list[0]!, false);
      assert.equal((await stores.speechAttempts.find('a1', 'p2'))?.result, '{"full":true}');
      assert.equal(await stores.speechAttempts.find('a2', 'p2'), null);
      assert.equal(await stores.speechAttempts.delete('a2', 'p2'), false);
      assert.equal(await stores.speechAttempts.delete('a1', 'p2'), true);
      assert.deepEqual((await stores.speechAttempts.list('a1')).map((a) => a.id), ['p1']);
    });

    it('keeps narrators, a whole text’s reading in place of the one before, and own texts, each for their owner', async () => {
      await stores.users.insert(user('n1', 'narrated1'));
      await stores.users.insert(user('n2', 'narrated2'));
      const narrator = { id: 'nr1', userId: 'n1', name: 'Grandma', kind: 'designed' as const, voiceId: 'v1', prompt: 'warm', previewText: '你好', speed: 1, pitch: 0, emotion: null, createdAt: T, updatedAt: T };
      await stores.narrators.save(narrator);
      await stores.narrators.save({ ...narrator, name: 'Granny', speed: 0.8, updatedAt: T + 1 });
      assert.deepEqual(await stores.narrators.find('n1', 'nr1'), { ...narrator, name: 'Granny', speed: 0.8, updatedAt: T + 1 });
      assert.equal(await stores.narrators.find('n2', 'nr1'), null);
      assert.deepEqual((await stores.narrators.list('n1')).map((n) => n.id), ['nr1']);

      const mp3 = new Uint8Array([0xff, 0xfb, 1, 2]);
      const reading = { key: 'rk1', userId: 'n1', narratorId: 'nr1', mp3, timings: [[0, 900], [900, 2100]] as Array<[number, number]>, durationMs: 2100, createdAt: T };
      await stores.narrations.save({ ...reading, durationMs: 1 });
      // Read again ("Read it again" after the voice changed): the newer reading takes its place.
      await stores.narrations.save(reading);
      assert.deepEqual(await stores.narrations.find('rk1'), reading);
      assert.deepEqual(await stores.narrations.have(['rk1', 'rk2']), [{ key: 'rk1', userId: 'n1', narratorId: 'nr1', timings: [[0, 900], [900, 2100]], durationMs: 2100, createdAt: T }]);

      const own = { id: 'o1', userId: 'n1', title: 'My day', lines: ['我起床。', '我吃饭。'], narratorId: 'nr1', narrationKey: 'rk1', textId: null, createdAt: T };
      await stores.ownTexts.save(own);
      await stores.ownTexts.save({ ...own, textId: 'text-9' });
      assert.deepEqual(await stores.ownTexts.find('n1', 'o1'), { ...own, textId: 'text-9' });
      assert.equal(await stores.ownTexts.find('n2', 'o1'), null);
      assert.deepEqual((await stores.ownTexts.list('n1')).map((t) => t.id), ['o1']);
      assert.equal(await stores.ownTexts.delete('n2', 'o1'), false);
      assert.equal(await stores.ownTexts.delete('n1', 'o1'), true);
      assert.equal(await stores.narrators.delete('n2', 'nr1'), false);
      assert.equal(await stores.narrators.delete('n1', 'nr1'), true);
      assert.deepEqual(await stores.narrators.list('n1'), []);
    });
  });
}
