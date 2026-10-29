import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import type { GeneratedText } from '../../src/domain/text';
import { illustrate, imageSize, jobsOf, promptFor, referencesFor, withDrawn, type PictureAccount } from './illustrate';

const K = (c: string) => c.repeat(64);

function text(id: string, createdAt: number, pictures: GeneratedText['pictures'], setId = 's1'): GeneratedText {
  return {
    id,
    setId,
    title: id,
    titleZh: id,
    topic: '',
    length: 'medium',
    level: 'edge',
    genre: 'story',
    createdAt,
    model: 'Claude · story',
    lines: [{ zh: '你好。', py: 'nǐ hǎo', en: 'Hello.' }],
    vocab: [],
    questions: [],
    grammar: [],
    note: '',
    teach: [],
    glosses: {},
    basis: [],
    read: false,
    pictures,
  };
}

// A 2×1 PNG and a JPEG whose frame says 640×480.
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQZGBgAGu4D/U2oCsIAAAAASUVORK5CYII=', 'base64'));
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x01, 0xe0, 0x02, 0x80, 3, 0, 0, 0, 0]);

describe('drawing a shelf’s pictures', () => {
  it('reads a picture’s size from its header', () => {
    assert.deepEqual(imageSize(png), { w: 2, h: 1 });
    assert.deepEqual(imageSize(jpeg), { w: 640, h: 480 });
    assert.equal(imageSize(new Uint8Array([1, 2, 3])), null);
  });

  it('draws what is not drawn, oldest text first, paragraph by paragraph', () => {
    const texts = [
      text('b', 2, [{ para: 1, prompt: 'b1' }, { para: 0, prompt: 'b0' }]),
      text('a', 1, [{ para: 0, prompt: 'a0', key: K('a'), w: 4, h: 3 }, { para: 1, prompt: 'a1' }]),
    ];
    assert.deepEqual(
      jobsOf(texts).map((j) => `${j.textId}${j.para}`),
      ['a1', 'b1', 'b0'],
    );
    assert.equal(jobsOf(texts, { redo: true }).length, 4);
  });

  it('draws beside the nearest pictures: the paragraph before, then the chapter before', () => {
    const texts = [
      text('ch1', 1, [{ para: 0, prompt: 'x', key: K('1'), w: 4, h: 3 }, { para: 1, prompt: 'x', key: K('2'), w: 4, h: 3 }]),
      text('ch2', 2, [{ para: 0, prompt: 'x', key: K('3'), w: 4, h: 3 }, { para: 1, prompt: 'y' }]),
      text('other', 0, [{ para: 0, prompt: 'x', key: K('9'), w: 4, h: 3 }], 's2'),
    ];
    const job = { textId: 'ch2', title: 'ch2', setId: 's1', para: 1, prompt: 'y' };
    assert.deepEqual(referencesFor(job, texts), [K('3'), K('2')]);
    assert.deepEqual(referencesFor({ ...job, para: 0 }, texts, 3), [K('2'), K('1')]);
  });

  it('asks for the same characters when there are pictures to keep them like', () => {
    assert.doesNotMatch(promptFor('Ash in a tree', 'Watercolour.', 0), /earlier page/);
    assert.match(promptFor('Ash in a tree', 'Watercolour.', 2), /earlier pages of the same book/);
    assert.match(promptFor('Ash in a tree', 'Watercolour.', 0), /No text, letters/);
  });

  it('puts a drawn picture in its paragraph and leaves the rest', () => {
    const t = withDrawn(text('a', 1, [{ para: 0, prompt: 'x' }, { para: 1, prompt: 'y' }]), 1, { key: K('c'), w: 4, h: 3, at: 7 });
    assert.deepEqual(t.pictures, [{ para: 0, prompt: 'x' }, { para: 1, prompt: 'y', key: K('c'), w: 4, h: 3, at: 7 }]);
  });

  it('draws, keeps and saves each picture, and carries on past one that fails', async () => {
    let doc: Record<string, unknown> = {
      version: 11,
      sets: [{ id: 's1', name: 'Story', createdAt: 0 }],
      texts: [text('ch1', 1, [{ para: 0, prompt: 'forest' }, { para: 1, prompt: 'refused' }, { para: 2, prompt: 'river' }])],
    };
    let revision = 1;
    const kept = new Map<string, Uint8Array>();
    const account: PictureAccount = {
      where: 'test',
      read: async () => ({ revision, document: structuredClone(doc) }),
      async write(base, next) {
        if (base !== revision) return false;
        doc = next;
        revision += 1;
        return true;
      },
      getPicture: async (key) => (kept.has(key) ? { mime: 'image/png', bytes: kept.get(key)! } : null),
      async putPicture(key, _mime, bytes) {
        assert.equal(key, createHash('sha256').update(bytes).digest('hex'));
        kept.set(key, bytes);
      },
    };
    const seen: number[] = [];
    const painter = {
      model: 'fake',
      async paint(prompt: string, refs: unknown[]) {
        if (prompt.includes('refused')) throw new Error('Gemini drew nothing (PROHIBITED_CONTENT).');
        seen.push(refs.length);
        return png;
      },
    };
    const lines: string[] = [];
    const result = await illustrate(account, painter, { set: 'Story', say: (l) => lines.push(l) });
    assert.deepEqual(result, { drawn: 2, failed: 1 });
    // The second drawing had the first beside it.
    assert.deepEqual(seen, [0, 1]);
    const pictures = (doc.texts as GeneratedText[])[0]!.pictures!;
    assert.deepEqual(pictures.map((p) => Boolean(p.key)), [true, false, true]);
    assert.deepEqual([pictures[0]!.w, pictures[0]!.h], [2, 1]);
    assert.ok(lines.some((l) => l.includes('PROHIBITED_CONTENT')));

    // Run again: only the one that failed is left.
    const again: string[] = [];
    await illustrate(account, null, { set: 'Story', say: (l) => again.push(l) });
    assert.ok(again.some((l) => l.includes('¶2: refused')));
    assert.ok(!again.some((l) => l.includes('forest')));
  });
});

describe('describing the pictures of a text already on the shelf', () => {
  it('keeps a drawing whose description is unchanged, and asks again for one that changed', async () => {
    const { withDescribed } = await import('./illustrate');
    const t = text('a', 1, [
      { para: 0, prompt: 'same', key: K('a'), w: 4, h: 3 },
      { para: 1, prompt: 'old', key: K('b'), w: 4, h: 3 },
    ]);
    assert.deepEqual(
      withDescribed(t, [{ para: 0, prompt: 'same' }, { para: 1, prompt: 'new' }, { para: 2, prompt: 'more' }]).pictures,
      [{ para: 0, prompt: 'same', key: K('a'), w: 4, h: 3 }, { para: 1, prompt: 'new' }, { para: 2, prompt: 'more' }],
    );
  });
});

describe('a painter that cannot draw at all', () => {
  it('stops the run at once and says why', async () => {
    const { PainterUnavailable } = await import('./illustrate');
    let doc: Record<string, unknown> = {
      sets: [{ id: 's1', name: 'Story', createdAt: 0 }],
      texts: [text('ch1', 1, [{ para: 0, prompt: 'a' }, { para: 1, prompt: 'b' }])],
    };
    const account: PictureAccount = {
      where: 'test',
      read: async () => ({ revision: 1, document: structuredClone(doc) }),
      write: async (_b, next) => ((doc = next), true),
      getPicture: async () => null,
      putPicture: async () => undefined,
    };
    let asked = 0;
    const painter = {
      model: 'fake',
      async paint(): Promise<Uint8Array> {
        asked += 1;
        throw new PainterUnavailable('No quota.');
      },
    };
    const lines: string[] = [];
    assert.deepEqual(await illustrate(account, painter, { set: 'Story', say: (l) => lines.push(l) }), { drawn: 0, failed: 2 });
    assert.equal(asked, 1);
    assert.ok(lines.includes('No quota.'));
  });
});
