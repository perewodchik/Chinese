/**
 * The shared catalogue: books of texts an admin published from their own
 * shelf, for every learner to take onto theirs (T1).
 *
 *   GET   /api/catalog                 → CatalogBook[]: the books on offer (signed in)
 *   GET   /api/catalog/:id             → CatalogBookWithTexts
 *   GET   /api/admin/catalog           → CatalogBook[], hidden ones too
 *   POST  /api/admin/catalog           PublishCatalogRequest → PublishCatalogResponse
 *   PUT   /api/admin/catalog/:id       PublishCatalogRequest → PublishCatalogResponse (a new version)
 *   PATCH /api/admin/catalog/:id       { hidden } → 204
 *
 * A text in the catalogue is a text as the reader shows it, without anyone's
 * progress: no reads, no study, no endings reached.
 */

/** What can be published, and what licence says it may be. Pages of real books stay in a learner's own workspace. */
export const CATALOG_LICENCES = ['written for this site', 'public domain', 'CC BY', 'CC BY-SA', 'CC0'] as const;
export type CatalogLicence = (typeof CATALOG_LICENCES)[number];

export const CATALOG_KINDS = ['texts', 'story'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export interface CatalogBookMeta {
  title: string;
  /** the same title in Chinese, when it has one */
  titleZh: string;
  /** the HSK band it is written for, 1–7 (7 meaning 7–9) */
  level: number;
  kind: CatalogKind;
  /** a line or two saying what it is */
  blurb: string;
  /** where it is from: "Written with Claude for this site", a book's name */
  source: string;
  licence: CatalogLicence;
}

export interface CatalogBook extends CatalogBookMeta {
  id: string;
  /** one more each time it is published again */
  version: number;
  publishedAt: number;
  texts: number;
  /** distinct characters across its texts */
  chars: number;
  /** only in the admin's list */
  hidden?: boolean;
}

/** A catalogue text: the fields of a GeneratedText that are the text itself (src/domain/text.ts). */
export type CatalogText = Record<string, unknown> & { id: string; title: string; lines: Array<{ zh: string }> };

export interface CatalogBookWithTexts extends CatalogBook {
  textList: CatalogText[];
}

export interface PublishCatalogRequest {
  book: CatalogBookMeta;
  /** the shelf's texts, in reading order, as the workspace keeps them; progress is dropped on the way in */
  texts: unknown[];
}

export interface PublishCatalogResponse {
  id: string;
  version: number;
  /** pictures a text names that are not on the server under the admin's account: left out */
  missingPictures: number;
}
