import type { CatalogBook, CatalogBookMeta, CatalogBookWithTexts, PublishCatalogResponse } from '../../shared/catalog';
import { request } from './http';

/** The books of the shared catalogue on offer, and one with its texts. */
export const catalogBooks = () => request<CatalogBook[]>('GET', '/api/catalog');
export const catalogBook = (id: string) => request<CatalogBookWithTexts>('GET', `/api/catalog/${encodeURIComponent(id)}`);

/** For an admin: a shelf published as a new book, or as a new version of the book it already is. */
export const publishBook = (book: CatalogBookMeta, texts: unknown[], id?: string) =>
  id
    ? request<PublishCatalogResponse>('PUT', `/api/admin/catalog/${encodeURIComponent(id)}`, { body: { book, texts } })
    : request<PublishCatalogResponse>('POST', '/api/admin/catalog', { body: { book, texts } });
