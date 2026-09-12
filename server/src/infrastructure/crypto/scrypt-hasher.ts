import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from '../../application/ports';

export interface ScryptCost {
  log2N: number;
  r: number;
  p: number;
}

/**
 * N = 2^15, r = 8, p = 3: one of OWASP's equivalent minimums for scrypt.
 * 32 MiB per hash, with the rest of the cost bought as three passes rather than
 * as more memory — kinder to a home PC that may be building a PDF at the time.
 */
export const DEFAULT_COST: ScryptCost = { log2N: 15, r: 8, p: 3 };

const SALT_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Passwords, hashed with scrypt from Node itself: memory-hard, and no native
 * module to compile. The cost is written into each hash, so raising it later
 * does not lock anyone out of an account made under the old one.
 */
export class ScryptHasher implements PasswordHasher {
  constructor(private readonly cost: ScryptCost = DEFAULT_COST) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await derive(password, salt, this.cost, KEY_BYTES);
    const { log2N, r, p } = this.cost;
    return ['scrypt', log2N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [log2N, r, p] = parts.slice(1, 4).map(Number);
    if (![log2N, r, p].every((n) => Number.isInteger(n) && n > 0) || log2N > 20) return false;

    const expected = Buffer.from(parts[5], 'base64');
    if (expected.length === 0) return false;
    const actual = await derive(password, Buffer.from(parts[4], 'base64'), { log2N, r, p }, expected.length);
    return timingSafeEqual(actual, expected);
  }
}

function derive(password: string, salt: Buffer, cost: ScryptCost, length: number): Promise<Buffer> {
  const N = 2 ** cost.log2N;
  return new Promise((resolve, reject) => {
    // NFKC, so a password typed on an iPad keyboard matches the same password
    // typed on a PC even where the two produce different Unicode for it.
    scrypt(
      password.normalize('NFKC'),
      salt,
      length,
      { N, r: cost.r, p: cost.p, maxmem: 256 * N * cost.r },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}
