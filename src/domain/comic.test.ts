import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseResponse } from './parse';

describe('a comic’s lines', () => {
  it('keep what each line is on the page and where, and drop a place off the photo', () => {
    const raw = JSON.stringify({
      texts: [
        {
          title: 'Chapter 1',
          titleZh: '第一话',
          lines: [
            { zh: '然而，三界没笑多久……', py: 'rán’ér sānjiè méi xiào duōjiǔ', en: 'But the three realms did not laugh for long…', p: true, who: '旁白', kind: 'caption', box: [32.04, 3, 30, 4] },
            { zh: '轰隆隆', py: 'hōnglōnglōng', en: 'Boom, rumble: thunder.', who: '音效', kind: 'sfx', box: [30, 10, 25, 50] },
            { zh: '谁？', py: 'shéi', en: 'Who?', kind: 'shout', box: [90, 10, 20, 5] },
          ],
        },
      ],
    });
    const [draft] = parseResponse(raw).drafts;
    const [caption, sfx, odd] = draft!.lines;
    assert.equal(caption!.kind, 'caption');
    assert.deepEqual(caption!.box, [32, 3, 30, 4]);
    assert.equal(sfx!.kind, 'sfx');
    assert.equal(odd!.kind, undefined);
    assert.equal(odd!.box, undefined);
  });
});
