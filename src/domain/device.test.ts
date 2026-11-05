import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deviceName } from './device';

describe('a device’s name, from what its browser said', () => {
  it('names the learner’s iPad and iPhone', () => {
    assert.equal(deviceName('Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'), 'Safari on an iPad');
    assert.equal(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'), 'Safari on an iPhone');
    assert.equal(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1'), 'Chrome on an iPhone');
  });

  it('names a computer, Chrome before the Safari its string also mentions', () => {
    assert.equal(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'), 'Chrome on a Mac');
    assert.equal(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0'), 'Edge on a Windows computer');
  });

  it('says so when the browser said nothing, or nothing it knows', () => {
    assert.equal(deviceName(null), 'A browser that did not say what it was');
    assert.equal(deviceName('curl/8.5.0'), 'A browser');
  });
});
