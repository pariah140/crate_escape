import test from 'node:test';
import assert from 'node:assert/strict';
import { patrolPose } from '../src/patrols';

test('patrol routes travel across, lengthwise, and around an oval while turning', () => {
  const routes = [0, 1, 2].map(index =>
    Array.from({ length: 72 }, (_, sample) => patrolPose(index, sample * 0.2, 0, 100, 0)));
  const ranges = routes.map(route => ({
    x: Math.max(...route.map(p => p.x)) - Math.min(...route.map(p => p.x)),
    z: Math.max(...route.map(p => p.z)) - Math.min(...route.map(p => p.z)),
  }));
  assert.ok(ranges[0].x > ranges[0].z * 2);
  assert.ok(ranges[1].z > ranges[1].x * 3);
  assert.ok(ranges[2].x > 6 && ranges[2].z > 9);
  for (const route of routes) assert.ok(new Set(route.map(p => Math.round(p.heading * 10))).size > 12);
});

test('vision follows a patrol bow and sound patrols ignore a cut engine', async () => {
  const { inVisionCone, heardBySoundPatrol } = await import('../src/patrols');
  const pose = { x: 0, z: 0, heading: 0 };
  assert.equal(inVisionCone(pose, 0, 7), true);
  assert.equal(inVisionCone(pose, 0, -7), false);
  assert.equal(inVisionCone({ ...pose, heading: Math.PI / 2 }, 7, 0), true);
  assert.equal(inVisionCone({ ...pose, heading: Math.PI / 2 }, -7, 0), false);
  assert.equal(heardBySoundPatrol(6, true, 8), true);
  assert.equal(heardBySoundPatrol(6, false, 8), false);
});
