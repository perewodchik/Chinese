import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { accountKey, setStorageAccount } from './accountStorage';

/** localStorage as a browser has it, enough for these. */
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    keys: () => [...m.keys()].sort(),
  };
}

describe('what a shared device keeps for each account', () => {
  let store: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    store = fakeStorage();
    (globalThis as { localStorage?: unknown }).localStorage = store;
  });

  it('keeps each account’s values apart, so the next learner on the iPad finds none of the last one’s', () => {
    setStorageAccount('a');
    localStorage.setItem(accountKey('hanzi.speech.outbox'), '[1]');
    setStorageAccount('b');
    assert.equal(localStorage.getItem(accountKey('hanzi.speech.outbox')), null);
    assert.deepEqual(store.keys(), ['hanzi/a/hanzi.speech.outbox']);
  });

  it('moves a value from before into the first account that opens it here, and to no other', () => {
    store.setItem('hanzi.speech.outbox', '[{"id":"x"}]');
    setStorageAccount('owner');
    assert.equal(localStorage.getItem(accountKey('hanzi.speech.outbox')), '[{"id":"x"}]');
    setStorageAccount('guest');
    assert.equal(localStorage.getItem(accountKey('hanzi.speech.outbox')), null);
    assert.deepEqual(store.keys(), ['hanzi/owner/hanzi.speech.outbox']);
  });

  it('does not let an old value overwrite one the account already has', () => {
    store.setItem('hanzi/owner/hanzi.reader.last', 'new');
    store.setItem('hanzi.reader.last', 'old');
    setStorageAccount('owner');
    assert.equal(localStorage.getItem(accountKey('hanzi.reader.last')), 'new');
    assert.equal(store.getItem('hanzi.reader.last'), null);
  });

  it('keeps nothing of an account under the plain name while nobody is signed in', () => {
    setStorageAccount(null);
    assert.equal(accountKey('hanzi.speak.sets'), 'hanzi/signed-out/hanzi.speak.sets');
  });
});
