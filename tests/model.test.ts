import test from 'node:test';
import assert from 'node:assert/strict';
import { canFitAll, canPlace, jobsForPort, rotatedCells, type Piece } from '../src/model';

function piecesFor(...ids: string[]): Piece[] {
  return jobsForPort(0).filter(job => ids.includes(job.id)).flatMap(job => job.shapes.map((shape, index) => ({
    id: `${job.id}-${index}`, jobId: job.id, shape, rotation: 0, x: null, y: null,
  })));
}

test('four small jobs fit in the 4 by 3 starter hold, but a fifth cannot', () => {
  const full = piecesFor('ducks', 'gnomes', 'flamingos', 'teapots');
  assert.equal(canFitAll(full, 4, 3), true);
  assert.equal(canFitAll([...full, ...piecesFor('mystery')], 4, 3), false);
});

test('VIP cargo must cover the centre of the hold', () => {
  const [duck] = piecesFor('ducks');
  assert.equal(canPlace(duck, 1, 0, [duck], 4, 3), true);
  assert.equal(canPlace(duck, 0, 0, [duck], 4, 3), true);
  assert.equal(canPlace(duck, 2, 0, [duck], 4, 3), true);
  assert.equal(canPlace(duck, 0, 1, [duck], 4, 3), true);
  assert.equal(canPlace(duck, 2, 1, [duck], 4, 3), true);
  assert.equal(canPlace(duck, 3, 0, [duck], 4, 3), false);
});

test('rotation normalizes a shape and occupied cells block later crates', () => {
  assert.deepEqual(rotatedCells('domino', 1), [[0, 0], [0, 1]]);
  const [gnome] = piecesFor('gnomes');
  const [teapot] = piecesFor('teapots');
  gnome.x = 0; gnome.y = 0;
  assert.equal(canPlace(teapot, 0, 1, [gnome, teapot], 4, 3), false);
  assert.equal(canPlace(teapot, 2, 1, [gnome, teapot], 4, 3), true);
});

test('different hull outlines change usable cargo cells and reject wall overlap', async () => {
  const { BOATS, usableCells } = await import('../src/model');
  assert.deepEqual(BOATS.map(usableCells), [12, 18, 22, 31, 44, 13, 26, 31, 36, 50]);
  const [crate] = piecesFor('teapots');
  assert.equal(canPlace(crate, 0, 0, [crate], 5, 4, BOATS[1].blocked), false);
  assert.equal(canPlace(crate, 1, 0, [crate], 5, 4, BOATS[1].blocked), true);
  crate.x = 0; crate.y = 0;
  assert.equal(canFitAll([crate], 5, 4, BOATS[1].blocked), false);
});

test('yard facilities change real repair prices and rare offer frequency', async () => {
  const { defaultSave, rareChance, repairCost, specialOfferFor } = await import('../src/model');
  const base = defaultSave(); base.boatCondition[0] = 60;
  const originalRepair = repairCost(base);
  base.yardUpgrades.repairBay = 2;
  assert.ok(repairCost(base) < originalRepair);
  const ordinaryChance = rareChance(base);
  const firstOffers = Array.from({ length: 100 }, (_, runs) => specialOfferFor({ ...base, runs })?.id);
  base.yardUpgrades.brokerDesk = 3;
  assert.ok(rareChance(base) > ordinaryChance);
  const betterOffers = Array.from({ length: 100 }, (_, runs) => specialOfferFor({ ...base, runs })?.id);
  assert.ok(betterOffers.filter(Boolean).length > firstOffers.filter(Boolean).length);
  assert.equal(specialOfferFor({ ...base, runs: 7 })?.id, specialOfferFor({ ...base, runs: 7 })?.id);
});

test('previous saves keep the owned speedboat and upgrades', async () => {
  const { loadSave } = await import('../src/model');
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify({ cash: 36, boat: 1, port: 1, upgrades: { engine: 2, hull: 1 }, runs: 4, sound: false }) } });
  try {
    const restored = loadSave();
    assert.deepEqual(restored.ownedBoats, [0, 1]);
    assert.deepEqual(restored.boatUpgrades[1], { engine: 2, hull: 1 });
    assert.equal(restored.port, 1);
    assert.ok(restored.unlockedPorts.includes(1));
    assert.equal(restored.yardUpgrades.brokerDesk, 0);
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous }); }
});


test('harbor map unlocks follow boat and reputation requirements and stay open', async () => {
  const { defaultSave, HARBORS, harborRequirements, refreshHarborUnlocks } = await import('../src/model');
  const save = defaultSave();
  assert.equal(HARBORS.length, 5);
  assert.deepEqual(save.unlockedPorts, [0]);
  assert.match(harborRequirements(save, 1).join(' '), /Skipjack/);
  save.ownedBoats.push(1);
  refreshHarborUnlocks(save);
  assert.deepEqual(save.unlockedPorts, [0, 1]);
  save.reputation = 25;
  assert.match(harborRequirements(save, 2).join(' '), /22\+ cargo cells/);
  save.ownedBoats.push(2);
  refreshHarborUnlocks(save);
  assert.ok(save.unlockedPorts.includes(2));
  save.reputation = 0;
  refreshHarborUnlocks(save);
  assert.ok(save.unlockedPorts.includes(2));
});

test('every harbor has distinct jobs and all can fit a large hull', async () => {
  const { BOATS, jobsForPort, HARBORS } = await import('../src/model');
  const ids = new Set<string>();
  for (let port = 0; port < HARBORS.length; port++) {
    const jobs = jobsForPort(port);
    assert.equal(jobs.length, 5);
    for (const job of jobs) {
      assert.ok(!ids.has(job.id)); ids.add(job.id);
      const crates = job.shapes.map((shape, index) => ({ id: `${job.id}-${index}`, jobId: job.id, shape, rotation: 0, x: null, y: null })) as Piece[];
      assert.equal(canFitAll(crates, BOATS[9].width, BOATS[9].height, BOATS[9].blocked), true, `${job.id} should fit`);
    }
  }
});


test('later harbors cannot skip the previous stop', async () => {
  const { defaultSave, harborRequirements, refreshHarborUnlocks } = await import('../src/model');
  const save = defaultSave(); save.reputation = 200; save.ownedBoats.push(4);
  refreshHarborUnlocks(save);
  assert.deepEqual(save.unlockedPorts, [0]);
  assert.match(harborRequirements(save, 2).join(' '), /Fogbank Harbour first/);
  save.ownedBoats.push(1);
  refreshHarborUnlocks(save);
  assert.deepEqual(save.unlockedPorts, [0, 1, 2, 3, 4]);
});
