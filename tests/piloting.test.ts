import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceMotion, clampSailingPoint, SAILING_BOUNDS, type Motion } from '../src/piloting';

test('an untouched boat stays at the harbour', () => {
  let boat: Motion = { x: 0, z: 0, vx: 0, vz: 0 };
  for (let i = 0; i < 180; i++) boat = advanceMotion(boat, null, { x: 0, z: 0 }, 9.2, 1 / 60);
  assert.deepEqual(boat, { x: 0, z: 0, vx: 0, vz: 0 });
});

test('the boat lags behind a target, then coasts and comes to rest after release', () => {
  let boat: Motion = { x: 0, z: 0, vx: 0, vz: 0 };
  boat = advanceMotion(boat, { x: 0, z: 12 }, { x: 0, z: 0 }, 9.2, 1 / 60);
  assert.ok(boat.vz > 0 && boat.vz < 9.2);
  for (let i = 0; i < 40; i++) boat = advanceMotion(boat, { x: 0, z: 12 }, { x: 0, z: 0 }, 9.2, 1 / 60);
  const releaseZ = boat.z;
  for (let i = 0; i < 360; i++) boat = advanceMotion(boat, null, { x: 0, z: 0 }, 9.2, 1 / 60);
  assert.ok(boat.z > releaseZ);
  assert.equal(boat.vz, 0);
});

test('screen-edge targets steer across the wider channel and slightly behind the start', () => {
  assert.deepEqual(clampSailingPoint({ x: -99, z: -99 }), { x: SAILING_BOUNDS.minX, z: SAILING_BOUNDS.minZ });
  assert.deepEqual(clampSailingPoint({ x: 99, z: 99 }), { x: SAILING_BOUNDS.maxX, z: 99 });
  let boat: Motion = { x: 0, z: 0, vx: 0, vz: 0 };
  for (let i = 0; i < 180; i++) boat = advanceMotion(boat, { x: -11.5, z: -8 }, { x: 0, z: 0 }, 9.2, 1 / 60);
  assert.ok(boat.x < -6.8);
  assert.ok(boat.z < 0);
});
