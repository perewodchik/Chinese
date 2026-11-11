import { z } from 'zod';
import { CATALOG_KINDS, CATALOG_LICENCES } from '../../../shared/catalog';

/**
 * What a text may be on its way into the shared catalogue (SEC12): every
 * field of a text that is the text itself, each bounded, and nothing else.
 * Progress (read, reads, study, endings) and the shelf it stood on are
 * dropped, since they are the publisher's own. Unknown keys are dropped too,
 * so nothing the client invents reaches other learners. A story's branches
 * and a text's scenes are checked by the app's own reader as it opens them
 * (store/migrations.ts); here they are held to a size and to plain data.
 */

const short = (max: number) => z.string().max(max);
const LINES_MAX = 600;

const line = z.object({
  zh: short(600),
  py: short(1500),
  en: short(1500),
  zht: short(600).optional(),
  p: z.boolean().optional(),
  a: short(600).optional(),
  who: short(60).optional(),
  kind: z.enum(['bubble', 'caption', 'sfx', 'sign', 'note']).optional(),
});

const picture = z.object({
  para: z.number().int().min(0).max(LINES_MAX),
  prompt: short(1200),
  key: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  w: z.number().int().min(1).max(8192).optional(),
  h: z.number().int().min(1).max(8192).optional(),
  at: z.number().int().min(0).optional(),
});

/** Plain data of at most `bytes` as JSON, with no web address in it. */
const plainData = (bytes: number) =>
  z.unknown().refine((v) => {
    const json = JSON.stringify(v ?? null);
    return json.length <= bytes && !/https?:|javascript:|data:/i.test(json);
  }, `At most ${Math.round(bytes / 1024)} KB of plain data, with no addresses in it.`);

export const catalogTextSchema = z.object({
  id: short(80).min(1),
  title: short(200),
  titleZh: short(200).default(''),
  topic: short(300).default(''),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  level: z.enum(['comfort', 'edge', 'stretch', 'beyond']).default('edge'),
  genre: short(40).default('story'),
  hsk: z.number().int().min(1).max(9).optional(),
  ceiling: z.number().int().min(1).max(9).optional(),
  createdAt: z.number().int().min(0),
  model: short(80).default(''),
  lines: z.array(line).min(1).max(LINES_MAX),
  vocab: z.array(z.object({ w: short(40), py: short(120), d: short(300), isNew: z.boolean().optional() })).max(300).default([]),
  questions: z.array(line).max(40).default([]),
  grammar: z.array(z.object({ point: short(200), zh: short(600), en: short(1000) })).max(40).default([]),
  note: short(2000).default(''),
  teach: z.array(short(8)).max(400).default([]),
  glosses: z.record(short(8), z.object({ py: short(60), d: short(300) })).default({}),
  basis: z.array(short(8)).max(6000).default([]),
  story: plainData(256 * 1024).optional(),
  scenes: plainData(128 * 1024).optional(),
  pictures: z.array(picture).max(80).optional(),
});

export type CatalogTextInput = z.infer<typeof catalogTextSchema>;

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
