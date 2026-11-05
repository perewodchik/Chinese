import { AppError } from '../domain/errors';
import type { StorageMeter } from './ports';

const MB = 1024 * 1024;

/** How much an account keeps on the server, out of how much it may. */
export interface StorageUse {
  usedBytes: number;
  /** null: no ceiling on this server */
  limitBytes: number | null;
}

/**
 * The ceiling on what one account keeps: pictures, readings, tries, the
 * workspace and the rest together. Every account shares one database, and a
 * page in a loop (or a learner illustrating every shelf) could otherwise
 * fill it for everyone.
 *
 * Checked before the things that grow by megabytes — a picture, a text read
 * aloud, a batch of tries — not before every save of the workspace, which
 * has a ceiling of its own and is saved after every change.
 */
export class StorageQuota {
  constructor(private readonly deps: { meter: StorageMeter; limitMb: number | null }) {}

  async use(userId: string): Promise<StorageUse> {
    return { usedBytes: await this.deps.meter.usedBy(userId), limitBytes: this.deps.limitMb ? this.deps.limitMb * MB : null };
  }

  /** Throws when `adding` more bytes would take the account past its ceiling. */
  async check(userId: string, adding: number): Promise<void> {
    if (!this.deps.limitMb) return;
    const { usedBytes, limitBytes } = await this.use(userId);
    if (limitBytes !== null && usedBytes + adding > limitBytes) {
      throw new AppError(
        'payload_too_large',
        `Your account is full: ${Math.round(usedBytes / MB)} MB of ${Math.round(limitBytes / MB)} MB. Delete readings or pictures you no longer need, or ask whoever runs the site for more room.`,
      );
    }
  }
}
