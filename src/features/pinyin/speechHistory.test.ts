import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AttemptIn } from '../../../shared/speechEval';
import { ApiError } from '../../api/http';
import { flush, pendingTries, pendingTry, sendOutbox } from './speechHistory';

const tryOf = (id: string): AttemptIn => ({ id, at: 1, kind: 'phrase', text: '你好', good: true, summary: { total: 90 } });

describe('sending the tries that wait', () => {
  it('sends them all when the server takes them', async () => {
    const sent: string[][] = [];
    const r = await sendOutbox([tryOf('a'), tryOf('b')], async (b) => void sent.push(b.map((x) => x.id)));
    assert.deepEqual([...r.done], ['a', 'b']);
    assert.equal(r.trouble, null);
    assert.deepEqual(sent, [['a', 'b']]);
  });

  it('does not let one try the server refuses hold back the others', async () => {
    // The batch fails because of b; sent one by one, a and c go and b waits.
    const r = await sendOutbox([tryOf('a'), tryOf('b'), tryOf('c')], async (batch) => {
      if (batch.some((x) => x.id === 'b')) throw new ApiError(500, 'internal', 'boom');
    });
    assert.deepEqual([...r.done].sort(), ['a', 'c']);
    assert.match(r.trouble ?? '', /did not take them/);
  });

  it('lets go of a try the server will never take, and says nothing is wrong', async () => {
    const r = await sendOutbox([tryOf('a'), tryOf('bad')], async (batch) => {
      if (batch.some((x) => x.id === 'bad')) throw new ApiError(400, 'validation', 'too large');
    });
    assert.deepEqual([...r.done].sort(), ['a', 'bad']);
    assert.equal(r.trouble, null);
  });

  it('stops and waits without a connection', async () => {
    let calls = 0;
    const r = await sendOutbox([tryOf('a'), tryOf('b')], async () => {
      calls++;
      throw new ApiError(0, 'network', 'offline');
    });
    assert.equal(r.done.size, 0);
    assert.equal(calls, 1);
    assert.match(r.trouble ?? '', /No connection/);
  });

  it('keeps a try this visit when the device will not store it', async () => {
    // No localStorage here, as on a full one: the try is still held, and found again by its id.
    const { keepTry } = await import('./speechHistory');
    keepTry(tryOf('held-1'));
    assert.equal(pendingTry('held-1')?.id, 'held-1');
  });

  it('still sends a try said after a send that found nothing to do', async () => {
    // The bug: an empty outbox left a finished send in place, and nothing was sent again that visit.
    const sent: string[] = [];
    const fake = async (b: AttemptIn[]) => void sent.push(...b.map((x) => x.id));
    await flush(fake);
    await flush(fake);
    const { keepTry } = await import('./speechHistory');
    keepTry(tryOf('after-empty'));
    // keepTry's own send has no server here; the next one, with the fake, must go.
    await new Promise((r) => setTimeout(r, 0));
    await flush(fake);
    assert.ok(sent.includes('after-empty'), `sent: ${sent.join(', ')}`);
    assert.equal(pendingTries().some((a) => a.id === 'after-empty'), false);
  });
});
