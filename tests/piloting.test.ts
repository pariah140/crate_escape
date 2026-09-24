import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceMotion, type Motion } from '../src/piloting';

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
