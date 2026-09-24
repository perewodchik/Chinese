import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RevisionConflictError } from '../src/domain/errors';
import { makeServices } from './support';

async function withAccount(name = 'kirill') {
  const made = makeServices();
  const { user } = await made.services.auth.register({ username: name, password: 'correct horse', userAgent: null });
  return { ...made, user };
}

describe('WorkspaceService', () => {
  it('starts empty, at revision 0', async () => {
    const { services, user } = await withAccount();
    assert.deepEqual(await services.workspaces.get(user.id), { revision: 0, document: null, updatedAt: null });
  });

  it('saves on the revision it was built on, and refuses a stale one with what is there now', async () => {
    const { services, user } = await withAccount();
    assert.equal((await services.workspaces.save(user.id, 0, { version: 5, from: 'pc' })).revision, 1);
    assert.equal((await services.workspaces.save(user.id, 1, { version: 5, from: 'pc again' })).revision, 2);

    await assert.rejects(services.workspaces.save(user.id, 1, { version: 5, from: 'ipad' }), (err: RevisionConflictError) => {
      assert.equal(err.code, 'conflict');
      assert.equal(err.current.revision, 2);
      assert.deepEqual(err.current.document, { version: 5, from: 'pc again' });
      return true;
    });
    assert.equal(await services.workspaces.revision(user.id), 2);
  });

  it('refuses a save from a build older than the document it would replace', async () => {
    const { services, user } = await withAccount();
    await services.workspaces.save(user.id, 0, { version: 7, words: ['东西'] });
    await assert.rejects(services.workspaces.save(user.id, 1, { version: 6 }), { code: 'outdated_app' });
    assert.deepEqual((await services.workspaces.get(user.id)).document, { version: 7, words: ['东西'] });
    // The same build or a newer one saves as before.
    assert.equal((await services.workspaces.save(user.id, 1, { version: 7 })).revision, 2);
    assert.equal((await services.workspaces.save(user.id, 2, { version: 8 })).revision, 3);
  });

  it('still reports a stale revision as a conflict, whatever the version', async () => {
    const { services, user } = await withAccount();
    await services.workspaces.save(user.id, 0, { version: 7 });
    await services.workspaces.save(user.id, 1, { version: 7 });
    await assert.rejects(services.workspaces.save(user.id, 1, { version: 6 }), { code: 'conflict' });
  });

  it('refuses a first save once there is already a document', async () => {
    const { services, user } = await withAccount();
    await services.workspaces.save(user.id, 0, { version: 5 });
    await assert.rejects(services.workspaces.save(user.id, 0, { version: 5 }), { code: 'conflict' });
  });

  it('refuses something that is not a workspace', async () => {
    const { services, user } = await withAccount();
    await assert.rejects(services.workspaces.save(user.id, 0, [1, 2, 3]), { code: 'validation' });
    await assert.rejects(services.workspaces.save(user.id, 0, { collections: [] }), { code: 'validation' });
    await assert.rejects(services.workspaces.save(user.id, -1, { version: 5 }), { code: 'validation' });
  });

  it('keeps each account to its own document', async () => {
    const { services, user } = await withAccount('kirill');
    const other = await services.auth.register({ username: 'vlad', password: 'correct horse', userAgent: null });
    await services.workspaces.save(user.id, 0, { version: 5, owner: 'kirill' });
    assert.equal((await services.workspaces.get(other.user.id)).document, null);
  });
});
