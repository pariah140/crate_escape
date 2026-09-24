import test from 'node:test';
import assert from 'node:assert/strict';
import { levelPlan, channelHalfWidth, clampToChannel, currentPush, weatherPush, MAX_LEVEL } from '../src/levels';

test('one hundred deterministic, bounded levels add hazards and later mission features', () => {
  const plans = Array.from({ length: MAX_LEVEL }, (_, i) => levelPlan(i + 1, 0));
  assert.equal(plans.length, 100);
  assert.deepEqual(levelPlan(42, 2), levelPlan(42, 2));
  assert.ok(plans[99].hazards.length > plans[0].hazards.length);
  assert.equal(plans[0].currents.length, 0);
  assert.ok(plans[30].currents.length > 0);
  assert.equal(plans[24].patrols.some(p => p.sound), false);
  assert.equal(plans[25].patrols.some(p => p.sound), true);
  assert.equal(plans[59].night, false);
  assert.equal(plans[60].night, true);
  assert.ok(plans.slice(20).some(p => p.weather === 'storm'));
  assert.ok(plans.slice(20).some(p => p.weather === 'rain'));
});

test('channel edges and current forces agree with the generated route', () => {
  const plan = levelPlan(72, 3);
  for (let z = 0; z <= 520; z += 13) {
    const half = channelHalfWidth(plan, z);
    assert.ok(half > 13);
    assert.ok(clampToChannel(plan, 100, z) < half);
    assert.ok(clampToChannel(plan, -100, z) > -half);
  }
  const current = plan.currents[0];
  assert.notEqual(currentPush(plan, current.x, current.z, 0), 0);
  assert.equal(currentPush(plan, 100, 100, 0), 0);
  assert.equal(weatherPush(levelPlan(1, 0), 5), 0);
});
