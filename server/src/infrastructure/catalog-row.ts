import type { CatalogKind, CatalogLicence } from '../../../shared/catalog';
import type { CatalogBookRecord, CatalogTextRecord } from '../application/ports';

export interface CatalogBookRow {
  id: string;
  title: string;
  title_zh: string;
  level: number;
  kind: string;
  blurb: string;
  source: string;
  licence: string;
  version: number;
  published_at: number;
  published_by: string;
  hidden_at: number | null;
  texts: number;
  chars: number;
}

export interface CatalogTextRow {
  id: string;
  position: number;
  document: string;
  chars: number;
}

/** A book row as either database gives it back, numbers as numbers. */
export const toCatalogBook = (r: CatalogBookRow): CatalogBookRecord => ({
  id: r.id,
  title: r.title,
  titleZh: r.title_zh,
  level: Number(r.level),
  kind: r.kind as CatalogKind,
  blurb: r.blurb,
  source: r.source,
  licence: r.licence as CatalogLicence,
  version: Number(r.version),
  publishedAt: Number(r.published_at),
  publishedBy: r.published_by,
  hiddenAt: r.hidden_at === null ? null : Number(r.hidden_at),
  texts: Number(r.texts),
  chars: Number(r.chars),
});

export const toCatalogText = (r: CatalogTextRow): CatalogTextRecord => ({
  id: r.id,
  position: Number(r.position),
  document: JSON.parse(r.document) as unknown,
  chars: Number(r.chars),
});

export const bookColumns = (b: CatalogBookRecord) => [b.id, b.title, b.titleZh, b.level, b.kind, b.blurb, b.source, b.licence, b.version, b.publishedAt, b.publishedBy, b.hiddenAt, b.texts, b.chars] as const;
