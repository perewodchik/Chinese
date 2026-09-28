import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildContent, compileDistrict } from './build-content';
import { checkContent, readLibrary } from './check-content';

describe('the built content', () => {
  it('writes one file per district and an index', () => {
    const out = mkdtempSync(join(tmpdir(), 'world-content-'));
    const ids = buildContent('content/world', out);
    assert.ok(ids.includes('gulou'));
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')), ids);
    const gulou = JSON.parse(readFileSync(join(out, 'gulou.json'), 'utf8'));
    assert.equal(gulou.district.id, 'gulou');
    assert.equal(typeof gulou.pinyin, 'object');
  });

  it('the committed content is up to date with its sources', () => {
    const r = checkContent('content/world', readLibrary());
    for (const d of r.districts) {
      const built = `public/world/content/${d.district.id}.json`;
      assert.ok(existsSync(built), `${built} is missing — npm run world:content`);
      assert.deepEqual(JSON.parse(readFileSync(built, 'utf8')), JSON.parse(JSON.stringify(compileDistrict(d))), `${built} is stale — npm run world:content`);
    }
  });

  it('every map a district lists is built and belongs to it', () => {
    const index = JSON.parse(readFileSync('public/world/maps/index.json', 'utf8')) as Record<string, { district: string }>;
    for (const d of checkContent('content/world', readLibrary()).districts) {
      for (const m of d.district.maps) {
        assert.ok(index[m], `${d.district.id}: map ${m} is not built`);
        assert.equal(index[m]!.district, d.district.id, `${m} says district ${index[m]!.district}`);
      }
    }
  });

  it('a manual reading travels with its line', () => {
    const c = compileDistrict({
      district: { id: 'x', name: '北京', en: 'x', chapter: 1, maps: ['m'], stations: [], names: [] },
      npcs: [], quests: [], spirits: [], idioms: [], stamps: [], items: [],
      scenes: [{ id: 's', map: 'm', trigger: 'talk', start: 'a', nodes: [{ id: 'a', say: '还行', pinyin: 'hái xíng', translate: 'OK' }] }],
    });
    assert.deepEqual(c.pinyin, { 还行: 'hái xíng' });
  });
});
