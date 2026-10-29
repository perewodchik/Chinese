import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergePictures, pictureAbove, picturesOf } from './pictures';

const KEY = 'a'.repeat(64);
const KEY2 = 'b'.repeat(64);

describe('a text’s pictures', () => {
  it('keeps one a paragraph, in order, and drops what is malformed', () => {
    assert.deepEqual(
      picturesOf([
        { para: 2, prompt: ' the river ' },
        { para: 0, prompt: 'the forest', key: KEY, w: 1024, h: 768, at: 5 },
        { para: -1, prompt: 'nowhere' },
        { para: 1, prompt: '' },
        { para: 1.5, prompt: 'half a paragraph' },
        'a string',
      ]),
      [
        { para: 0, prompt: 'the forest', key: KEY, w: 1024, h: 768, at: 5 },
        { para: 2, prompt: 'the river' },
      ],
    );
    assert.deepEqual(picturesOf('nothing'), []);
  });

  it('treats a key without a size, or a key that is not a digest, as not drawn yet', () => {
    assert.deepEqual(picturesOf([{ para: 0, prompt: 'x', key: KEY }]), [{ para: 0, prompt: 'x' }]);
    assert.deepEqual(picturesOf([{ para: 0, prompt: 'x', key: '../etc', w: 1, h: 1 }]), [{ para: 0, prompt: 'x' }]);
  });

  it('keeps what was drawn on either device, the later of two drawings', () => {
    const described = [{ para: 0, prompt: 'x' }, { para: 1, prompt: 'y' }];
    const drawn = [{ para: 1, prompt: 'y', key: KEY, w: 4, h: 3, at: 10 }];
    assert.deepEqual(mergePictures(described, drawn), [{ para: 0, prompt: 'x' }, drawn[0]]);
    assert.deepEqual(mergePictures(drawn, described), [{ para: 0, prompt: 'x' }, drawn[0]]);
    const redrawn = [{ para: 1, prompt: 'y', key: KEY2, w: 4, h: 3, at: 20 }];
    assert.deepEqual(mergePictures(drawn, redrawn), redrawn);
    assert.equal(mergePictures(undefined, undefined), undefined);
  });

  it('shows only a drawn picture above its paragraph', () => {
    const text = { pictures: picturesOf([{ para: 0, prompt: 'x' }, { para: 1, prompt: 'y', key: KEY, w: 4, h: 3 }]) };
    assert.equal(pictureAbove(text, 0), undefined);
    assert.equal(pictureAbove(text, 1)?.key, KEY);
  });
});

describe('pictures in a writer’s reply', () => {
  it('are read as descriptions only: a key cannot arrive with the text', async () => {
    const { parseResponse } = await import('./parse');
    const reply = JSON.stringify({
      texts: [
        {
          title: 'T',
          titleZh: '题',
          lines: [{ zh: '你好。', py: 'nǐ hǎo', en: 'Hello.' }],
          pictures: [{ para: 0, prompt: 'two friends wave', key: KEY, w: 4, h: 3 }],
        },
      ],
    });
    assert.deepEqual(parseResponse(reply).drafts[0]?.pictures, [{ para: 0, prompt: 'two friends wave' }]);
  });
});
