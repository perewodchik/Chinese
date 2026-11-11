import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { base32Decode, base32Encode, codeAt, matchingStep, newTotpSecret, otpauthLink, stepOf } from '../src/application/totp';

// RFC 6238, appendix B: the SHA-1 secret is the ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

describe('one-time codes', () => {
  it('gives the RFC 6238 test vectors (their last six digits)', () => {
    const vectors: Array<[number, string]> = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
      [20000000000, '65353130'],
    ];
    for (const [seconds, eight] of vectors) {
      assert.equal(codeAt(RFC_SECRET, stepOf(seconds * 1000)), eight.slice(2), `at ${seconds}`);
    }
  });

  it('reads base32 back to the same bytes, in any case and with spaces', () => {
    const secret = newTotpSecret();
    assert.match(secret, /^[A-Z2-7]{32}$/);
    assert.deepEqual(base32Decode(secret.toLowerCase().replace(/(.{4})/g, '$1 ')), base32Decode(secret));
    assert.equal(base32Encode(base32Decode(secret)), secret);
  });

  it('takes the code for now and the step either side, and nothing further off', () => {
    const at = 1_794_400_000_000;
    const now = stepOf(at);
    assert.equal(matchingStep(RFC_SECRET, codeAt(RFC_SECRET, now), at), now);
    assert.equal(matchingStep(RFC_SECRET, codeAt(RFC_SECRET, now - 1), at), now - 1);
    assert.equal(matchingStep(RFC_SECRET, codeAt(RFC_SECRET, now + 1).replace(/(\d{3})/, '$1 '), at), now + 1);
    assert.equal(matchingStep(RFC_SECRET, codeAt(RFC_SECRET, now - 2), at), null);
    assert.equal(matchingStep(RFC_SECRET, '12345', at), null);
    assert.equal(matchingStep(RFC_SECRET, 'abcdef', at), null);
  });

  it('makes the link an authenticator app opens', () => {
    assert.equal(
      otpauthLink('ABCD', 'kirill', 'Hanzi Workshop'),
      'otpauth://totp/Hanzi%20Workshop%3Akirill?secret=ABCD&issuer=Hanzi%20Workshop&algorithm=SHA1&digits=6&period=30',
    );
  });
});
