import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Tokens } from '../../application/ports';

export const cryptoTokens: Tokens = {
  // 256 bits: not something to guess, and base64url so it needs no escaping in a cookie.
  secret: () => randomBytes(32).toString('base64url'),
  digest: (secret) => createHash('sha256').update(secret).digest('base64url'),
  id: () => randomUUID(),
};
