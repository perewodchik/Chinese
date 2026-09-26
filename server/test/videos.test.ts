import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseTimedText } from '../src/infrastructure/youtube';

describe('YouTube timed text', () => {
  it('reads cues, entities and line breaks, and drops empty ones', () => {
    const xml =
      '<?xml version="1.0" encoding="utf-8" ?><transcript>' +
      '<text start="2.766" dur="1.3">我是佩奇\nwǒ shì pèi qí\nI am Peppa</text>' +
      '<text start="5" dur="2">It&amp;#39;s &quot;fine&quot;</text>' +
      '<text start="8" dur="1"> </text></transcript>';
    assert.deepEqual(parseTimedText(xml), [
      { at: 2.766, end: 4.066, text: '我是佩奇\nwǒ shì pèi qí\nI am Peppa' },
      { at: 5, end: 7, text: 'It\'s "fine"' },
    ]);
  });
});
