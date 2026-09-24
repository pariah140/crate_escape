import test from 'node:test';
import assert from 'node:assert/strict';
import { HARBORS } from '../src/harbors';
import { levelPlan, channelCenter, channelHalfWidth, clampToChannel, currentPush, destinationX, weatherPush } from '../src/levels';

test('all 25 harbors have distinct fixed coastal routes', () => {
  assert.equal(HARBORS.length, 25);
  const signatures = HARBORS.map((_, port) => {
    const plan = levelPlan(1, port);
    return [80, 160, 240, 320, 400, 480].map(z => channelCenter(plan, z).toFixed(2)).join(',');
  });
  assert.equal(new Set(signatures).size, 25);
  for (let port = 0; port < HARBORS.length; port++) {
    const first = levelPlan(1, port);
    const later = levelPlan(145, port);
    assert.equal(first.port, port);
    assert.equal(channelCenter(first, 210), channelCenter(later, 210));
    assert.notEqual(destinationX(first), destinationX(levelPlan(1, (port + 1) % HARBORS.length)));
  }
});

test('voyages continue beyond 100 while adding hazards and later mission features', () => {
  const early = levelPlan(1, 0);
  const late = levelPlan(100, 0);
  const endless = levelPlan(101, 0);
  const distant = levelPlan(1001, 24);
  assert.deepEqual(levelPlan(145, 2), levelPlan(145, 2));
  assert.ok(late.hazards.length > early.hazards.length);
  assert.equal(endless.number, 101);
  assert.equal(distant.number, 1001);
  assert.notDeepEqual(endless.hazards, late.hazards);
  assert.equal(early.currents.length, 0);
  assert.ok(levelPlan(31, 0).currents.length > 0);
  assert.equal(levelPlan(25, 0).patrols.some(p => p.sound), false);
  assert.equal(levelPlan(26, 0).patrols.some(p => p.sound), true);
  assert.equal(levelPlan(60, 0).night, false);
  assert.equal(levelPlan(61, 0).night, true);
  assert.ok(Array.from({ length: 50 }, (_, i) => levelPlan(i + 50, 0)).some(p => p.weather === 'storm'));
});

test('coastal physics, hazards and destination agree with the curved route', () => {
  const plan = levelPlan(72, 17);
  for (let z = 0; z <= 520; z += 13) {
    const center = channelCenter(plan, z);
    const half = channelHalfWidth(plan, z);
    assert.ok(half > 13);
    assert.ok(clampToChannel(plan, 100, z) < center + half);
    assert.ok(clampToChannel(plan, -100, z) > center - half);
  }
  assert.equal(destinationX(plan), channelCenter(plan, 532) - 1.8);
  const current = plan.currents[0];
  assert.notEqual(currentPush(plan, current.x, current.z, 0), 0);
  assert.equal(currentPush(plan, 100, 100, 0), 0);
  assert.equal(weatherPush(levelPlan(1, 0), 5), 0);
});
