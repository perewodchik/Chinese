import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { nextHop, rideFrom, trailFor, trailGoals } from './guide';
import type { MapLinks } from './places';
import { newSave } from './save';
import type { MapObject, Tile } from './types';

const index = JSON.parse(readFileSync('public/world/maps/index.json', 'utf8')) as MapLinks;
const objects = (map: string) => JSON.parse(readFileSync(`content/world/maps/${map}.objects.json`, 'utf8')) as MapObject[];
const at = (map: string, tile: Tile = [3, 8]) => ({ ...newSave('t', 0), place: { map, tile, facing: 'down' as const } });

describe('take me there (M6)', () => {
  it('leads on foot to the next map on the way, one map at a time', () => {
    const h = nextHop(at('nanluo-main'), 'siheyuan-room', index);
    assert.equal(h.kind, 'walk');
    assert.ok(h.kind === 'walk' && h.next === 'hutong-home' && h.then.at(-1) === 'siheyuan-room', JSON.stringify(h));
    assert.deepEqual(nextHop(at('siheyuan-room'), 'siheyuan-room', index), { kind: 'here' });
  });

  it('across town: to the station, then the platform with the right train, then on foot from the station you get off at', () => {
    const street = nextHop(at('nanluo-main'), 'bianlidian', index);
    assert.ok(street.kind === 'walk' && street.then.at(-1) === 'station-nanluoguxiang', JSON.stringify(street));
    const platform = nextHop(at('station-nanluoguxiang'), 'bianlidian', index);
    assert.equal(platform.kind, 'board');
    const ride = platform.kind === 'board' ? rideFrom(platform.rides, 'nanluoguxiang') : undefined;
    assert.ok(ride && ride.stops.length > 1 && (ride.direction.startsWith('往') || ride.direction.endsWith('环')), JSON.stringify(ride));
    assert.deepEqual(trailFor(platform), { board: true });
    const off = nextHop(at('station-guomao'), 'bianlidian', index);
    assert.ok(off.kind === 'walk', JSON.stringify(off));
  });

  it('changes to a bus at its stop, not at the subway board (西直门 → 332 to 颐和园)', () => {
    const hall = nextHop(at('station-xizhimen'), 'stop-yiheyuan', index);
    assert.deepEqual(hall.kind === 'walk' ? hall.next : hall, 'stop-xizhimen');
    const stop = nextHop(at('stop-xizhimen'), 'stop-yiheyuan', index);
    assert.ok(stop.kind === 'board' && stop.rides[0]!.mode === 'bus', JSON.stringify(stop));
  });

  it('ends the trail on the door or the street end into the next map, or beside the train board', () => {
    const doors = trailGoals({ to: 'chaguan' }, objects('nanluo-main'), 22, 60);
    assert.deepEqual(doors, [[15, 14]]);
    const edge = trailGoals({ to: 'gulou-dongdajie' }, objects('nanluo-main'), 22, 60);
    assert.ok(edge.length === 8 && edge.every(([, y]) => y === 0), JSON.stringify(edge));
    const board = trailGoals({ board: true }, objects('station-nanluoguxiang'), 20, 20);
    assert.ok(board.length >= 1, 'the station has its board');
  });
});
