import test from 'node:test';
import assert from 'node:assert/strict';
import { dragPlacementAnchor } from '../src/packing';

test('dragged cargo is centred under the pointer and stays inside the hold', () => {
  const square = { shape: 'square' as const, rotation: 0 };
  assert.deepEqual(dragPlacementAnchor(square, 4, 3, 8, 6), { x: 3, y: 2 });
  assert.deepEqual(dragPlacementAnchor(square, 0, 0, 8, 6), { x: 0, y: 0 });
  assert.deepEqual(dragPlacementAnchor(square, 7, 5, 8, 6), { x: 6, y: 4 });
  const long = { shape: 'domino' as const, rotation: 1 };
  assert.deepEqual(dragPlacementAnchor(long, 4, 3, 8, 6), { x: 4, y: 2 });
});
