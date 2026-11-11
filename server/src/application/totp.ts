import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time codes (RFC 6238, the six digits an authenticator app
 * shows), on node:crypto alone: HMAC-SHA1 over the 30-second step, as every
 * authenticator app expects by default.
 */

const STEP_MS = 30_000;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** A new secret: 20 random bytes, as base32 (32 characters), the form an app is given. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('Not base32.');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** The code for one 30-second step (RFC 4226's HOTP with the step as its counter). */
export function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 15;
  const n = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(n).padStart(DIGITS, '0');
}

export const stepOf = (at: number) => Math.floor(at / STEP_MS);

/**
 * The step a typed code belongs to, if it is the code for now or for the
 * step either side of it (a phone's clock a little off, a code typed as it
 * turned over); null otherwise. Spaces in the code are ignored.
 */
export function matchingStep(secret: string, typed: string, at: number): number | null {
  const code = typed.replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return null;
  const now = stepOf(at);
  for (const step of [now, now - 1, now + 1]) {
    const expected = codeAt(secret, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return step;
  }
  return null;
}

/** What an authenticator app is given to add the account: the otpauth:// link (RFC 6238 key URI). */
export function otpauthLink(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_MS / 1000}`;
}
