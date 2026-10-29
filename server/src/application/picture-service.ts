import { createHash } from 'node:crypto';
import { PICTURE_MAX_BYTES, PICTURE_TYPES } from '../../../shared/api';
import { NotFoundError, ValidationError } from '../domain/errors';
import type { Clock, Picture, PictureRepository } from './ports';

/** What a picture is filed under: the digest of its bytes. */
export const pictureKey = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/**
 * The pictures beside a text's paragraphs.
 *
 * They are drawn away from the app (`npm run texts -- illustrate` asks Gemini)
 * and sent here, so a text on the iPhone shows the same pictures as it does at
 * home. Each is filed under the digest of its bytes, which makes the address
 * of a picture the picture itself: it can be cached for ever, sending it twice
 * keeps one copy, and a key in the workspace cannot point at the wrong file.
 */
export class PictureService {
  constructor(private readonly deps: { pictures: PictureRepository; clock: Clock }) {}

  async put(userId: string, key: string, mime: string, bytes: Uint8Array): Promise<void> {
    if (!(PICTURE_TYPES as readonly string[]).includes(mime)) {
      throw new ValidationError(`A picture is one of ${PICTURE_TYPES.join(', ')}.`);
    }
    if (!bytes.length) throw new ValidationError('The picture is empty.');
    if (bytes.length > PICTURE_MAX_BYTES) {
      throw new ValidationError(`A picture is at most ${Math.round(PICTURE_MAX_BYTES / 1024)} KB.`);
    }
    if (pictureKey(bytes) !== key) throw new ValidationError('The key is not the digest of this picture.');
    const kept = await this.deps.pictures.find(key);
    // Somebody else's identical picture stays theirs; this one could not be
    // told apart from it, so there is nothing to keep twice — but nor may the
    // key be read through this account, so it is refused rather than shared.
    if (kept && kept.userId !== userId) throw new ValidationError('That picture is kept under another account.');
    if (kept) return;
    await this.deps.pictures.save({ key, userId, mime, bytes, createdAt: this.deps.clock.now() });
  }

  async get(userId: string, key: string): Promise<Pick<Picture, 'mime' | 'bytes'>> {
    const kept = /^[0-9a-f]{64}$/.test(key) ? await this.deps.pictures.find(key) : null;
    if (!kept || kept.userId !== userId) throw new NotFoundError('That picture');
    return { mime: kept.mime, bytes: kept.bytes };
  }
}
