import test from 'node:test';
import assert from 'node:assert/strict';
import { HARBORS } from '../src/harbors';
import { canDock, harborCourseSlope, levelPlan, channelCenter, channelHalfWidth, offshoreState, offshoreWaveStrength, roughWaterPush, currentPush, destinationX, destinationZ, weatherPush } from '../src/levels';

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
  assert.ok(early.routeEnd < late.routeEnd);
  assert.ok(levelPlan(1, 0).routeEnd < levelPlan(1, 12).routeEnd);
  assert.ok(levelPlan(1, 12).routeEnd < levelPlan(1, 24).routeEnd);
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
  for (let z = 0; z <= plan.routeEnd; z += 13) {
    const center = channelCenter(plan, z);
    const half = channelHalfWidth(plan, z);
    assert.ok(half > 13);
    assert.equal(offshoreState(plan, center, z).zone, 'charted');
    assert.equal(offshoreState(plan, center + half + 2, z).zone, 'warning');
    assert.equal(offshoreState(plan, center - half - 12, z).zone, 'rough');
    assert.equal(offshoreState(plan, center + half + 23, z).zone, 'danger');
    assert.ok(offshoreState(plan, center + half + 23, z).push < 0);
    assert.ok(offshoreState(plan, center - half - 23, z).push > 0);
  }
  assert.equal(destinationX(plan), channelCenter(plan, destinationZ(plan) + 3) + 5.2);
  const current = plan.currents[0];
  assert.notEqual(currentPush(plan, current.x, current.z, 0), 0);
  assert.equal(currentPush(plan, 100, 100, 0), 0);
  assert.equal(weatherPush(levelPlan(1, 0), 5), 0);
});

test('every harbor has a distinct off-north course and docking requires reaching its port', () => {
  const slopes = HARBORS.map((_, port) => harborCourseSlope(port));
  assert.equal(new Set(slopes).size, HARBORS.length);
  for (let port = 0; port < HARBORS.length; port++) {
    const plan = levelPlan(1, port);
    const bearing = Math.atan2(destinationX(plan), destinationZ(plan));
    assert.ok(Math.abs(bearing) > Math.PI / 16);
    assert.equal(canDock(plan, destinationX(plan), plan.routeEnd), true);
    assert.equal(canDock(plan, destinationX(plan) + 20, plan.routeEnd), false);
    assert.equal(canDock(plan, destinationX(plan), plan.routeEnd - 1), false);
  }
});

test('encounters fill each voyage with biome hazards and leave a navigable gap', () => {
  for (const [level, port] of [[1, 0], [36, 9], [85, 17], [145, 24]]) {
    const plan = levelPlan(level, port);
    assert.ok(plan.hazards.every(hazard => hazard.z > 24 && hazard.z < plan.routeEnd - 20));
    const encounterHazards = plan.hazards.filter(hazard => hazard.kind === 'reef' || hazard.kind === 'driftwood');
    assert.ok(encounterHazards.length > 0 || plan.hazards.some(hazard => hazard.kind === 'iceberg'));
    for (let z = 35; z < plan.routeEnd - 25; z += 5) {
      const center = channelCenter(plan, z);
      const freeAtCenter = plan.hazards.every(hazard => Math.hypot(center - hazard.x, z - hazard.z) > hazard.radius + 1.2);
      assert.ok(freeAtCenter, `blocked route centre at ${level}/${port}/${z}`);
    }
  }
});

test('offshore waves and buffeting build smoothly from calm water', () => {
  const plan = levelPlan(7, 0);
  const z = 200, edge = channelCenter(plan, z) + channelHalfWidth(plan, z);
  const strengths = [0, 5, 15, 28, 42].map(distance => offshoreWaveStrength(plan, edge + distance, z));
  assert.equal(strengths[0], 0);
  assert.equal(strengths.at(-1), 1);
  assert.ok(strengths.every((value, i) => i === 0 || value > strengths[i - 1]));
  const calm = roughWaterPush(plan, channelCenter(plan, z), z, 3);
  assert.equal(Math.hypot(calm.x, calm.z), 0);
  assert.notDeepEqual(roughWaterPush(plan, edge + 28, z, 3), { x: 0, z: 0 });
});

test('icy harbors generate visible iceberg hazards and snowy voyages', () => {
  for (const port of [8, 16, 23]) {
    const plan = levelPlan(41, port);
    assert.ok(plan.hazards.some(hazard => hazard.kind === 'iceberg'));
    assert.ok(Array.from({ length: 4 }, (_, i) => levelPlan(41 + i, port)).some(voyage => voyage.weather === 'snow'));
  }
  assert.equal(levelPlan(41, 0).hazards.some(hazard => hazard.kind === 'iceberg'), false);
});
