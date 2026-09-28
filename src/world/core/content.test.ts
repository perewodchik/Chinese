import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadDistrict, mapObjectSchema, type DistrictFiles } from './content';

const valid = (): Record<string, unknown> => ({
  district: {
    id: 'gulou',
    name: '鼓楼 · 南锣鼓巷',
    en: 'Drum Tower · Nanluoguxiang',
    chapter: 1,
    maps: ['nanluo-main'],
    stations: ['nanluoguxiang'],
    names: ['南锣鼓巷', '鼓楼'],
  },
  npcs: [
    {
      id: 'wang-ayi',
      name: '王阿姨',
      role: 'landlady',
      look: { sprite: 'auntie' },
      character: 'Calm and kind.',
      knows: ['the lane'],
      wants: ['you to eat breakfast'],
      actions: ['give', 'flag'],
      routine: [{ hours: [7, 21], map: 'siheyuan', tile: [4, 5] }],
      explains: { 附近: '就是不远的地方' },
    },
  ],
  scenes: [
    {
      id: 'arrival',
      map: 'siheyuan',
      npc: 'wang-ayi',
      trigger: 'talk',
      when: { not: { scene: 'arrival' } },
      start: 'hello',
      nodes: [
        {
          id: 'hello',
          say: '你好！你是新来的吗？',
          translate: 'Hi! Are you the new one?',
          expect: [{ intent: 'yes', match: [['是', '对']], go: 'room', actions: [{ do: 'give', item: 'key' }] }],
          hint: { word: '是', frame: '___，我是。', full: '是，我是新来的。' },
        },
        { id: 'room', say: '这是你的房间。', translate: 'This is your room.', onExit: [{ do: 'stamp', stamp: 'new-home' }] },
      ],
      stamp: 'new-home',
    },
  ],
  quests: [{ id: 'settle', title: 'Settle in', chapter: 1, steps: [{ id: 'meet', now: 'Say hello to 王阿姨.' }] }],
  stamps: [{ id: 'new-home', name: '新家', en: 'New home', place: 'siheyuan', design: 'stamp-home' }],
  items: [{ id: 'key', name: '钥匙', en: 'key' }],
});

describe('loadDistrict', () => {
  it('accepts a valid district', () => {
    const r = loadDistrict(valid());
    assert.equal(r.ok, true, r.ok ? '' : r.errors.join('\n'));
    if (r.ok) {
      assert.equal(r.value.scenes[0].nodes.length, 2);
      assert.deepEqual(r.value.spirits, []);
    }
  });

  const broken = (change: (f: Record<string, any>) => void): string[] => {
    const f = valid();
    change(f as Record<string, any>);
    const r = loadDistrict(f as DistrictFiles);
    assert.equal(r.ok, false);
    return r.ok ? [] : r.errors;
  };

  it('names the path of a wrong type', () => {
    const e = broken((f) => (f.scenes[0].nodes[0].expect[0].match = ['地铁']));
    assert.ok(e.some((x) => x.startsWith('scenes[0].nodes[0].expect[0].match[0]')), e.join('\n'));
  });

  it('names a missing field', () => {
    const e = broken((f) => delete f.scenes[0].nodes[1].translate);
    assert.ok(e.some((x) => x.startsWith('scenes[0].nodes[1].translate')), e.join('\n'));
  });

  it('refuses unknown keys, so a typo does not silently vanish', () => {
    const e = broken((f) => (f.npcs[0].explain = {}));
    assert.ok(e.some((x) => x.startsWith('npcs[0]')), e.join('\n'));
  });

  it('refuses an unknown action', () => {
    const e = broken((f) => (f.scenes[0].nodes[0].onEnter = [{ do: 'fly' }]));
    assert.ok(e.some((x) => x.startsWith('scenes[0].nodes[0].onEnter[0]')), e.join('\n'));
  });

  it('checks conditions deep inside', () => {
    const e = broken((f) => (f.scenes[0].when = { not: { hours: [7] } }));
    assert.ok(e.some((x) => x.startsWith('scenes[0].when')), e.join('\n'));
  });

  it('refuses bad ids', () => {
    const e = broken((f) => (f.items[0].id = 'Key 1'));
    assert.ok(e.some((x) => x.startsWith('items[0].id')), e.join('\n'));
  });

  it('needs the district file', () => {
    const e = broken((f) => delete f.district);
    assert.deepEqual(e, ['district: the file is missing']);
  });

  it('finds dangling node links', () => {
    const e = broken((f) => (f.scenes[0].nodes[0].expect[0].go = 'nowhere'));
    assert.deepEqual(e, ['scenes[0].nodes[0].expect[0].go: no node "nowhere"']);
  });

  it('finds a missing start node', () => {
    const e = broken((f) => (f.scenes[0].start = 'nope'));
    assert.deepEqual(e, ['scenes[0].start: no node "nope"']);
  });

  it('finds unknown items, stamps and npcs', () => {
    const e = broken((f) => {
      f.scenes[0].nodes[0].expect[0].actions = [{ do: 'give', item: 'lamp' }];
      f.scenes[0].stamp = 'x';
      f.scenes[0].npc = 'nobody';
    });
    assert.ok(e.includes('scenes[0].nodes[0].expect[0].actions[0]: unknown item "lamp"'), e.join('\n'));
    assert.ok(e.includes('scenes[0].stamp: unknown stamp "x"'), e.join('\n'));
    assert.ok(e.includes('scenes[0].npc: unknown npc "nobody"'), e.join('\n'));
  });

  it('finds a quest step that does not exist', () => {
    const e = broken((f) => (f.scenes[0].nodes[1].onExit = [{ do: 'quest', quest: 'settle', step: 'fly' }]));
    assert.deepEqual(e, ['scenes[0].nodes[1].onExit[0]: unknown step of settle "fly"']);
  });

  it('allows one key line per scene', () => {
    const e = broken((f) => {
      f.scenes[0].nodes[0].key = true;
      f.scenes[0].nodes[1].key = true;
    });
    assert.deepEqual(e, ['scenes[0]: 2 key lines — at most one per scene']);
  });

  it('finds duplicate ids', () => {
    const e = broken((f) => f.items.push({ id: 'key', name: '钥匙', en: 'key' }));
    assert.deepEqual(e, ['items[1].id: "key" is used twice']);
  });
});

describe('map objects', () => {
  it('accepts each kind', () => {
    for (const o of [
      { kind: 'door', id: 'd1', tile: [3, 4], to: { map: 'shop', tile: [2, 7], facing: 'up' } },
      { kind: 'edge', id: 'e1', side: 'left', from: 0, to: 10, target: { map: 'lane', offset: 0 } },
      { kind: 'sign', id: 's1', tile: [1, 1], text: '出口' },
      { kind: 'npc', id: 'n1', npc: 'wang-ayi', tile: [1, 1] },
      { kind: 'light', id: 'l1', tile: [1, 1] },
      { kind: 'zone', id: 'z1', tile: [1, 1], size: [2, 1], scene: 'arrival' },
      { kind: 'spirit', id: 'p1', tile: [1, 1], spirit: 'shishizi' },
      { kind: 'bike', id: 'b1', tile: [1, 1] },
    ]) {
      assert.equal(mapObjectSchema.safeParse(o).success, true, o.kind);
    }
  });
  it('refuses a negative tile', () => {
    assert.equal(mapObjectSchema.safeParse({ kind: 'bike', id: 'b', tile: [-1, 0] }).success, false);
  });
});
