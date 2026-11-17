import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { usernameProblem } from '../../shared/credentials';
import { SERVER_COMMAND } from '../src/application/auth-service';
import { makeServices } from './support';

describe('names that read as another’s (SEC10)', () => {
  it('takes a name of one alphabet, and refuses one that mixes them', () => {
    for (const ok of ['boss', 'Кирилл', '王小明', 'すずき太郎', 'masha_2', 'ivan.petrov']) assert.equal(usernameProblem(ok), null, ok);
    assert.match(usernameProblem('bоss')!, /one alphabet/); // a Cyrillic о
    assert.match(usernameProblem('Kиrill')!, /one alphabet/);
    assert.match(usernameProblem('ming明')!, /one alphabet/);
  });

  it('says the site’s own names are taken at sign-up, but lets the server make them', async () => {
    const { services } = makeServices();
    await assert.rejects(services.auth.register({ username: 'Support', password: 'correct horse', userAgent: null }), { code: 'username_taken' });
    await assert.rejects(services.auth.register({ username: 'ADMIN', password: 'correct horse', userAgent: null }), { code: 'username_taken' });
    assert.equal((await services.auth.addUser('admin', 'correct horse', SERVER_COMMAND)).username, 'admin');
  });
});
