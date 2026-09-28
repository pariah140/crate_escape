import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, parseSave, BOATS } from '../src/model';
import { PREMIUM_PRODUCTS, boatChartCost, chartedBoatPrice, ownsPaint, ownsYardTheme } from '../src/premium';

test('permanent looks require a verified product ID while free originals remain selectable', () => {
  assert.equal(ownsPaint('original', []), true);
  assert.equal(ownsPaint('festival', []), false);
  assert.equal(ownsPaint('festival', [PREMIUM_PRODUCTS[0].id]), true);
  assert.equal(ownsPaint('coral', [PREMIUM_PRODUCTS[1].id]), true);
  assert.equal(ownsYardTheme('festival', [PREMIUM_PRODUCTS[0].id]), false);
  assert.equal(ownsYardTheme('festival', [PREMIUM_PRODUCTS[3].id]), true);
});

test('boat charts reduce only cash price and preserve existing saves', () => {
  for (const craft of BOATS.slice(1, -1)) {
    assert.equal(chartedBoatPrice(craft.price, true), Math.ceil(craft.price / 2));
    assert.equal(chartedBoatPrice(craft.price, false), craft.price);
    assert.ok(boatChartCost(craft.price) >= 5);
  }
  const older = defaultSave() as Partial<ReturnType<typeof defaultSave>>;
  delete older.paint;
  delete older.yardTheme;
  const restored = parseSave(older);
  assert.equal(restored.paint, 'original');
  assert.equal(restored.yardTheme, 'working');
});
