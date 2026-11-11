import type { CatalogBook, CatalogBookWithTexts, CatalogText, PublishCatalogResponse } from '../../../shared/catalog';
import { NotFoundError } from '../domain/errors';
import type { catalogBookSchema, CatalogTextInput } from './catalog-schema';
import type { Actor, AdminLogRepository, CatalogBookRecord, CatalogRepository, Clock, PictureRepository, Tokens } from './ports';
import type { z } from 'zod';

/** Every distinct Chinese character in the strings given. */
function hanzi(strings: Iterable<string>): Set<string> {
  const found = new Set<string>();
  for (const s of strings) for (const ch of s) if (/\p{Script=Han}/u.test(ch)) found.add(ch);
  return found;
}

const linesOf = (t: CatalogTextInput) => t.lines.map((l) => l.zh);

const toDto = (b: CatalogBookRecord, admin: boolean): CatalogBook => ({
  id: b.id,
  title: b.title,
  titleZh: b.titleZh,
  level: b.level,
  kind: b.kind,
  blurb: b.blurb,
  source: b.source,
  licence: b.licence,
  version: b.version,
  publishedAt: b.publishedAt,
  texts: b.texts,
  chars: b.chars,
  ...(admin && { hidden: b.hiddenAt !== null }),
});

/**
 * The shared catalogue (T1): an admin publishes a shelf as a book, and every
 * learner can take it onto their own.
 *
 * Publishing copies: the texts as they are now, without the admin's
 * progress, and their pictures out of the admin's account into the
 * catalogue's own, so anyone signed in can see them and the admin can go on
 * changing their shelf without changing the book. Publishing again makes a
 * new version of the same book.
 */
export class CatalogService {
  constructor(
    private readonly deps: { catalog: CatalogRepository; pictures: PictureRepository; adminLog: AdminLogRepository; clock: Clock; tokens: Tokens },
  ) {}

  async publish(actor: Actor & { id: string }, book: z.infer<typeof catalogBookSchema>, texts: CatalogTextInput[], bookId?: string): Promise<PublishCatalogResponse> {
    const { catalog, pictures, adminLog, clock, tokens } = this.deps;
    const before = bookId ? await catalog.find(bookId) : null;
    if (bookId && !before) throw new NotFoundError('That book');
    const now = clock.now();

    // Each picture moves into the catalogue's keeping, or is left out when the
    // admin's account does not have it (never drawn, or drawn elsewhere).
    const missing = new Set<string>();
    const kept = new Set<string>();
    for (const text of texts) {
      for (const picture of text.pictures ?? []) {
        if (!picture.key || kept.has(picture.key)) continue;
        const found = missing.has(picture.key) ? null : await pictures.find(picture.key);
        if (!found || found.userId !== actor.id) {
          missing.add(picture.key);
          delete picture.key;
          continue;
        }
        await catalog.savePicture({ key: found.key, mime: found.mime, bytes: found.bytes, createdAt: now });
        kept.add(found.key);
      }
    }

    const record: CatalogBookRecord = {
      ...book,
      id: before?.id ?? tokens.id(),
      version: (before?.version ?? 0) + 1,
      publishedAt: now,
      publishedBy: actor.id,
      hiddenAt: before?.hiddenAt ?? null,
      texts: texts.length,
      chars: hanzi(texts.flatMap(linesOf)).size,
    };
    await catalog.save(
      record,
      texts.map((t, position) => ({ id: t.id, position, document: t, chars: hanzi(linesOf(t)).size })),
    );
    await adminLog.add({
      at: now,
      actorId: actor.id,
      actorName: actor.name,
      action: before ? 'catalog-updated' : 'catalog-published',
      targetId: null,
      targetName: null,
      details: { book: record.title, version: record.version, texts: record.texts },
      ip: actor.ip,
    });
    return { id: record.id, version: record.version, missingPictures: missing.size };
  }

  async setHidden(actor: Actor, id: string, hidden: boolean): Promise<void> {
    const book = await this.deps.catalog.find(id);
    if (!book) throw new NotFoundError('That book');
    const now = this.deps.clock.now();
    await this.deps.catalog.setHidden(id, hidden ? (book.hiddenAt ?? now) : null);
    await this.deps.adminLog.add({ at: now, actorId: actor.id, actorName: actor.name, action: hidden ? 'catalog-hidden' : 'catalog-shown', targetId: null, targetName: null, details: { book: book.title }, ip: actor.ip });
  }

  /** The books on offer; an admin sees the hidden ones too. */
  async list(admin: boolean): Promise<CatalogBook[]> {
    return (await this.deps.catalog.list(admin)).map((b) => toDto(b, admin));
  }

  /** A book with its texts, unless it is hidden (an admin still sees it). */
  async get(id: string, admin: boolean): Promise<CatalogBookWithTexts> {
    const book = await this.deps.catalog.find(id);
    if (!book || (book.hiddenAt !== null && !admin)) throw new NotFoundError('That book');
    const texts = await this.deps.catalog.texts(id);
    return { ...toDto(book, admin), textList: texts.map((t) => t.document as CatalogText) };
  }

  /** A picture of the catalogue's, for anyone signed in; null when it is not one. */
  picture(key: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
    return /^[0-9a-f]{64}$/.test(key) ? this.deps.catalog.findPicture(key) : Promise.resolve(null);
  }
}
