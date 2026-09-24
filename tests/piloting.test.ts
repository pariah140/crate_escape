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

test('open-water targets are not clamped to the route', () => {
  let boat: Motion = { x: 0, z: 0, vx: 0, vz: 0 };
  for (let i = 0; i < 600; i++) boat = advanceMotion(boat, { x: -50, z: -30 }, { x: 0, z: 0 }, 9.2, 1 / 60);
  assert.ok(boat.x < -40);
  assert.ok(boat.z < 0);
});

test('large boats turn and stop more slowly than the dinghy', async () => {
  const { BOATS } = await import('../src/model');
  let nimble: Motion = { x: 0, z: 0, vx: 0, vz: 7 };
  let heavy: Motion = { ...nimble };
  for (let i = 0; i < 15; i++) {
    nimble = advanceMotion(nimble, null, { x: 1, z: 0 }, 9.2, 1 / 60, BOATS[0]);
    heavy = advanceMotion(heavy, null, { x: 1, z: 0 }, 9.2, 1 / 60, BOATS[4]);
  }
  assert.ok(nimble.vx > heavy.vx * 2);
  for (let i = 0; i < 30; i++) {
    nimble = advanceMotion(nimble, null, { x: 0, z: 0 }, 9.2, 1 / 60, BOATS[0]);
    heavy = advanceMotion(heavy, null, { x: 0, z: 0 }, 9.2, 1 / 60, BOATS[4]);
  }
  assert.ok(Math.hypot(heavy.vx, heavy.vz) > Math.hypot(nimble.vx, nimble.vz));
});

test('a fast boat can cross a listening patrol while its engine is cut', async () => {
  const { BOATS } = await import('../src/model');
  let boat: Motion = { x: 0, z: -18, vx: 0, vz: 9 };
  for (let i = 0; i < 5 * 60; i++) {
    boat = advanceMotion(boat, null, { x: 0, z: 0 }, 9.2, 1 / 60, { ...BOATS[0], coast: .16 });
  }
  assert.ok(boat.z > 12);
  assert.ok(boat.vz > 0);
});
