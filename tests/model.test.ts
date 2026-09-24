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
