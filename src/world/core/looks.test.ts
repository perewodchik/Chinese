import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_WORN, heroFrames } from '../art/hero';
import { rng } from '../../../scripts/world/art/gen/grid';
import {
  ADDRESSES, BROWS, BUILDS, DEFAULT_LOOK, EYES, HAIR_COLOURS, HAIR_STYLES, isLook, lookKey, MOUTHS, randomLook, SKINS, type HeroLook,
} from './looks';

describe('the character creator’s catalogue (W3)', () => {
  it('every combination composes: each build × skin × face × hair × colour gives thirteen frames', () => {
    // every value of every choice meets every value of every other choice at least once, by pairs
    let n = 0;
    for (const build of BUILDS) {
      for (let skin = 0; skin < SKINS; skin++) {
        for (const style of HAIR_STYLES) {
          const i = n++;
          const look: HeroLook = {
            build,
            skin,
            face: { eyes: EYES[i % EYES.length]!, brows: BROWS[i % BROWS.length]!, mouth: MOUTHS[i % MOUTHS.length]! },
            hair: { style, colour: HAIR_COLOURS[i % HAIR_COLOURS.length]! },
            address: ADDRESSES[i % ADDRESSES.length]!,
          };
          assert.ok(isLook(look));
          const frames = heroFrames(look, DEFAULT_WORN);
          assert.equal(frames.length, 13);
        }
      }
    }
    for (const eyes of EYES) for (const brows of BROWS) for (const mouth of MOUTHS) for (const colour of HAIR_COLOURS) {
      assert.equal(heroFrames({ ...DEFAULT_LOOK, face: { eyes, brows, mouth }, hair: { style: 'short', colour } }, DEFAULT_WORN).length, 13);
    }
  });

  it('🎲 gives a valid look every time and keeps how you are addressed', () => {
    const r = rng(7);
    const keep: HeroLook = { ...DEFAULT_LOOK, address: '姑娘' };
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const l = randomLook(r, keep);
      assert.ok(isLook(l), JSON.stringify(l));
      assert.equal(l.address, '姑娘');
      seen.add(l.hair.style);
    }
    assert.equal(seen.size, HAIR_STYLES.length);
  });

  it('a look’s key changes with any choice and with the clothes', () => {
    const k = lookKey(DEFAULT_LOOK, {}, () => '');
    assert.notEqual(lookKey({ ...DEFAULT_LOOK, skin: 3 }, {}, () => ''), k);
    assert.notEqual(lookKey(DEFAULT_LOOK, { hat: 'cap:red' }, () => 'rR'), k);
    assert.equal(lookKey({ ...DEFAULT_LOOK }, {}, () => ''), k);
  });
});
