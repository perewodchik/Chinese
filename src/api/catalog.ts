import type { CatalogBook, CatalogBookMeta, CatalogBookWithTexts, PublishCatalogResponse } from '../../shared/catalog';
import { request } from './http';

/** The books of the shared catalogue on offer, and one with its texts. */
export const catalogBooks = () => request<CatalogBook[]>('GET', '/api/catalog');
export const catalogBook = (id: string) => request<CatalogBookWithTexts>('GET', `/api/catalog/${encodeURIComponent(id)}`);

/** A9: this learner took a book of the library onto a shelf (false), or has read all of it (true). Counted, never named. */
export const markCatalogReader = (id: string, finished: boolean) => request<void>('POST', `/api/catalog/${encodeURIComponent(id)}/reader`, { body: { finished } });

/** A9, for an admin: a book hidden or shown, moved one place, or put at another band. */
export const changeCatalogBook = (id: string, change: { hidden: boolean } | { move: 'earlier' | 'later' } | { level: number }) =>
  request<void>('PATCH', `/api/admin/catalog/${encodeURIComponent(id)}`, { body: change });

/** For an admin: a shelf published as a new book, or as a new version of the book it already is. */
export const publishBook = (book: CatalogBookMeta, texts: unknown[], id?: string) =>
  id
    ? request<PublishCatalogResponse>('PUT', `/api/admin/catalog/${encodeURIComponent(id)}`, { body: { book, texts } })
    : request<PublishCatalogResponse>('POST', '/api/admin/catalog', { body: { book, texts } });
