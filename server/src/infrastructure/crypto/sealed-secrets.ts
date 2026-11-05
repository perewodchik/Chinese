import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { SecretRepository } from '../../application/ports';

const PREFIX = 'v1:';

/**
 * The learner's keys for outside services (SpeechSuper, MiniMax), sealed
 * before they reach the database: AES-256-GCM with a key the database never
 * sees (HANZI_SECRETS_KEY), so a copy of the database is not a copy of the
 * keys — they cost their owners money.
 *
 * Each value is bound to its account and name (the GCM additional data), so
 * a sealed value moved onto another row does not open there. A value kept
 * before sealing was switched on is read as it is and sealed on the way out;
 * one that will not open (the setting changed, or lost) reads as no key at
 * all, and the learner is asked for it again rather than shown an error.
 */
export class SealedSecrets implements SecretRepository {
  private readonly key: Buffer;

  constructor(
    private readonly inner: SecretRepository,
    secret: string,
    private readonly log: (line: string) => void = () => undefined,
  ) {
    // Any long random string will do: the AES key is its SHA-256.
    this.key = createHash('sha256').update(secret, 'utf8').digest();
  }

  async get(userId: string, name: string): Promise<string | null> {
    const stored = await this.inner.get(userId, name);
    if (stored === null) return null;
    if (!stored.startsWith(PREFIX)) {
      // Kept before sealing: sealed now, so the plain copy does not stay.
      await this.inner.set(userId, name, this.seal(userId, name, stored), Date.now()).catch(() => undefined);
      return stored;
    }
    try {
      return this.open(userId, name, stored);
    } catch {
      this.log(`secrets: a ${name} key would not open — HANZI_SECRETS_KEY is not the one it was sealed with.`);
      return null;
    }
  }

  set(userId: string, name: string, value: string, at: number): Promise<void> {
    return this.inner.set(userId, name, this.seal(userId, name, value), at);
  }

  delete(userId: string, name: string): Promise<void> {
    return this.inner.delete(userId, name);
  }

  private seal(userId: string, name: string, value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(`${userId}\n${name}`, 'utf8'));
    const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
  }

  private open(userId: string, name: string, stored: string): string {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(`${userId}\n${name}`, 'utf8'));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  }
}

/**
 * The secrets as the services should see them: sealed when HANZI_SECRETS_KEY
 * is set (at least 32 characters), as they are otherwise — with a word in the
 * log, once, so a site running without it is not a surprise.
 */
export function secretsFor(inner: SecretRepository, secret: string | undefined, log: (line: string) => void): SecretRepository {
  const s = secret?.trim();
  if (!s) {
    log('secrets: HANZI_SECRETS_KEY is not set, so learners’ keys are kept in the database as they were typed.');
    // A key sealed elsewhere (the site, with the setting) is not a key here:
    // sent to MiniMax as it is, it would only be refused.
    return {
      get: async (userId, name) => {
        const v = await inner.get(userId, name);
        if (v?.startsWith(PREFIX)) {
          log(`secrets: a ${name} key is sealed and HANZI_SECRETS_KEY is not set here, so it reads as none.`);
          return null;
        }
        return v;
      },
      set: (userId, name, value, at) => inner.set(userId, name, value, at),
      delete: (userId, name) => inner.delete(userId, name),
    };
  }
  if (s.length < 32) throw new Error('HANZI_SECRETS_KEY has to be at least 32 characters: a long random string, kept out of the database.');
  return new SealedSecrets(inner, s, log);
}
