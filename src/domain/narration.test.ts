import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { narratorScript, soundOf } from './narration';

describe('a script for the narrator', () => {
  it('puts every sentence on its own line, with the long pause after it', () => {
    const script = narratorScript({
      lines: [
        { zh: '医生看了看皮卡丘，笑了。', py: '', en: '' },
        { zh: ' “他没有生病。” ', py: '', en: '' },
        { zh: '', py: '', en: '' },
      ],
    });
    assert.equal(script, '医生看了看皮卡丘，笑了。 (chuckle) <#1.5#>\n“他没有生病。” <#1.5#>');
  });

  it('adds a sound only where the sentence says it', () => {
    assert.equal(soundOf('哈哈，你好！'), '(laughs)');
    assert.equal(soundOf('皮卡丘饿了。'), null);
  });
});
