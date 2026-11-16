import { z } from 'zod';

/**
 * What a text may be (T6, SEC12): every field of a text that is the text
 * itself, each bounded, and nothing else — the one check a text passes on its
 * way into the shared catalogue (server) and into a workspace from a file
 * (client). Progress (read, reads, study, endings) is not part of it, and
 * unknown keys are dropped, so nothing invented reaches another learner. A
 * story's branches and a text's scenes are checked by the reader as it opens
 * them (store/migrations.ts); here they are held to a size and to plain data.
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

export const textSchema = z.object({
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

export type TextInput = z.infer<typeof textSchema>;

/** A text before it has an id or a time: what a file or an answer brings. */
export const newTextSchema = textSchema.omit({ id: true, createdAt: true });
