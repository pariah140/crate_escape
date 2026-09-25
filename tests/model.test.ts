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
  assert.deepEqual(BOATS.map(usableCells), [12, 18, 22, 31, 44, 13, 26, 31, 36, 50, 8]);
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
  const firstOffers = Array.from({ length: 1000 }, (_, offerCycle) => specialOfferFor({ ...base, offerCycle })?.id);
  base.yardUpgrades.brokerDesk = 3;
  assert.ok(rareChance(base) > ordinaryChance);
  const betterOffers = Array.from({ length: 1000 }, (_, offerCycle) => specialOfferFor({ ...base, offerCycle })?.id);
  assert.ok(betterOffers.filter(Boolean).length > firstOffers.filter(Boolean).length);
  assert.equal(specialOfferFor({ ...base, offerCycle: 7 })?.id, specialOfferFor({ ...base, offerCycle: 7 })?.id);
  assert.equal(specialOfferFor({ ...base, runs: 800 })?.id, specialOfferFor(base)?.id, 'failed runs cannot reroll the board');
});

test('previous saves keep the owned speedboat and upgrades', async () => {
  const { loadSave } = await import('../src/model');
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify({ cash: 36, boat: 1, port: 1, upgrades: { engine: 2, hull: 1 }, runs: 4, sound: false }) } });
  try {
    const restored = loadSave();
    assert.deepEqual(restored.ownedBoats, [0, 1, 10]);
    assert.deepEqual(restored.boatUpgrades[1], { engine: 2, hull: 1 });
    assert.equal(restored.port, 1);
    assert.ok(restored.unlockedPorts.includes(1));
    assert.equal(restored.yardUpgrades.brokerDesk, 0);
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous }); }
});

test('backup sailboat is always owned, free to repair, and can carry a job from every harbor', async () => {
  const { BACKUP_BOAT_INDEX, BOATS, HARBORS, defaultSave, repairCost } = await import('../src/model');
  const save = defaultSave();
  const backup = BOATS[BACKUP_BOAT_INDEX];
  assert.ok(save.ownedBoats.includes(BACKUP_BOAT_INDEX));
  save.boatCondition[BACKUP_BOAT_INDEX] = 30;
  assert.equal(repairCost(save, BACKUP_BOAT_INDEX), 0);
  for (let port = 0; port < HARBORS.length; port++) {
    const fits = jobsForPort(port).some(job => canFitAll(job.shapes.map((shape, index) => ({ id: `${port}-${index}`, jobId: job.id, shape, rotation: 0, x: null, y: null })), backup.width, backup.height, backup.blocked));
    assert.ok(fits, `backup boat needs a deliverable job at ${HARBORS[port].name}`);
  }
});

test('an unaffordable damaged boat restores into the backup sailboat', async () => {
  const { BACKUP_BOAT_INDEX, loadSave } = await import('../src/model');
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify({ cash: 0, boat: 0, ownedBoats: [0], boatCondition: { 0: 30 } }) } });
  try { assert.equal(loadSave().boat, BACKUP_BOAT_INDEX); }
  finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous }); }
});

test('saved voyage numbers are no longer capped at one hundred', async () => {
  const { loadSave } = await import('../src/model');
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify({ cash: 80, boat: 0, runs: 1233, level: 1234 }) } });
  try { assert.equal(loadSave().level, 1234); }
  finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous }); }
});


test('harbor charters need local deliveries, variety, a clean run, capacity and outfitting', async () => {
  const { defaultSave, HARBORS, harborRequirements, openHarbor, recordHarborDelivery } = await import('../src/model');
  const save = defaultSave();
  assert.equal(HARBORS.length, 25);
  assert.deepEqual(save.unlockedPorts, [0]);
  assert.match(harborRequirements(save, 1).join(' '), /Deliveries 0\/4/);
  const jobs = jobsForPort(0);
  for (let i = 0; i < 4; i++) recordHarborDelivery(save, 0, [jobs[i % 2]], i === 2);
  save.ownedBoats.push(1);
  assert.equal(openHarbor(save, 1), true);
  assert.deepEqual(save.unlockedPorts, [0, 1]);
  for (let i = 0; i < 5; i++) recordHarborDelivery(save, 1, [jobsForPort(1)[i % 2]], i === 0);
  assert.match(harborRequirements(save, 2).join(' '), /Outfitting/);
  save.cash = 260;
  assert.equal(openHarbor(save, 2), true);
  assert.equal(save.cash, 10);
  save.cash = 0;
  assert.ok(save.unlockedPorts.includes(2), 'opened harbours stay open');
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
  const { defaultSave, harborRequirements, openHarbor, recordHarborDelivery } = await import('../src/model');
  const save = defaultSave(); save.reputation = 200; save.ownedBoats.push(4);
  assert.deepEqual(save.unlockedPorts, [0]);
  assert.match(harborRequirements(save, 2).join(' '), /Fogbank Harbour first/);
  save.ownedBoats.push(1);
  for (let i = 0; i < 4; i++) recordHarborDelivery(save, 0, [jobsForPort(0)[i % 2]], true);
  assert.equal(openHarbor(save, 2), false);
  assert.equal(openHarbor(save, 1), true);
  assert.deepEqual(save.unlockedPorts, [0, 1]);
});

test('each boat has a capacity, price, handling tradeoff and a working specialty', async () => {
  const { BOATS, HARBOR_GATES, estimateCargoPay, voyageReceipt, usableCells, boatTraits, impactDamage, conditionHandling, repairCost, defaultSave } = await import('../src/model');
  assert.equal(HARBOR_GATES.length, 25);
  assert.equal(new Set(BOATS.map(boat => boat.ability)).size, BOATS.length);
  assert.deepEqual(BOATS.map(usableCells), [12, 18, 22, 31, 44, 13, 26, 31, 36, 50, 8]);
  assert.ok(BOATS[9].turnRate < BOATS[0].turnRate);
  assert.ok(BOATS[9].price > BOATS[4].price);
  assert.equal(impactDamage(BOATS[0], 'reef', 20), 15);
  assert.equal(impactDamage(BOATS[2], 'rock', 20), 16);
  assert.equal(boatTraits(BOATS[1]).deadline, 1.25);
  assert.equal(boatTraits(BOATS[5]).vision, .85);
  assert.equal(boatTraits(BOATS[6]).current, .6);
  assert.equal(boatTraits(BOATS[8]).wind, .5);
  assert.equal(boatTraits(BOATS[10]).sonarAudible, false);
  assert.equal(conditionHandling(70), 1);
  assert.ok(conditionHandling(50) < 1);
  const save = defaultSave(); save.boatCondition[7] = 50;
  assert.ok(repairCost(save, 7) < Math.ceil(50 * BOATS[7].repairRate));
  const fragile = [jobsForPort(3).find(job => job.kind === 'fragile')!];
  assert.ok(voyageReceipt(3, fragile, BOATS[3], false, 2, false).payout > voyageReceipt(3, fragile, BOATS[7], false, 2, false).payout);
  assert.ok(estimateCargoPay(24, jobsForPort(24), BOATS[9]) < 2400, 'endless voyages do not multiply cash without bound');
});

test('charter challenges rotate after a win and pay a bounded bonus', async () => {
  const { defaultSave, charterChallenge, completesChallenge, BOATS, voyageReceipt, estimateCargoPay, BACKUP_BOAT_INDEX } = await import('../src/model');
  const save = defaultSave();
  const first = charterChallenge(save);
  save.offerCycle++;
  const second = charterChallenge(save);
  assert.notEqual(first.kind, second.kind);
  const jobs = jobsForPort(0).slice(0, 2);
  assert.equal(completesChallenge(first, jobs, BOATS[0], 0), true);
  assert.equal(completesChallenge(first, jobs, BOATS[0], 1), false);
  const receipt = voyageReceipt(0, jobs, BOATS[0], false, 0, false, 1);
  assert.ok(receipt.challengeBonus <= Math.round(estimateCargoPay(0, jobs, BOATS[0]) * .08));
  save.boat = BACKUP_BOAT_INDEX;
  assert.equal(charterChallenge(save).kind, 'clean', 'recovery boat receives a feasible challenge');
});
