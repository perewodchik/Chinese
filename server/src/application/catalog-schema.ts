import { z } from 'zod';
import { CATALOG_KINDS, CATALOG_LICENCES } from '../../../shared/catalog';
import { textSchema, type TextInput } from '../../../shared/text';

/** What a text may be on its way into the shared catalogue (SEC12): the same check the client makes (shared/text.ts, T6). */
export const catalogTextSchema = textSchema;
export type CatalogTextInput = TextInput;

export const catalogBookSchema = z.object({
  title: z.string().trim().min(1, 'A title.').max(120),
  titleZh: z.string().trim().max(120).default(''),
  level: z.number().int().min(1).max(7),
  kind: z.enum(CATALOG_KINDS).default('texts'),
  blurb: z.string().trim().min(1, 'A line saying what it is.').max(400),
  source: z.string().trim().min(1, 'Where it is from.').max(200),
  licence: z.enum(CATALOG_LICENCES, { message: 'Only what was written for the site, or is free to share, goes in the library.' }),
});

export const publishSchema = z.object({
  book: catalogBookSchema,
  texts: z.array(catalogTextSchema).min(1, 'A book needs at least one text.').max(200),
});
