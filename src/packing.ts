import { rotatedCells, type Piece } from './model';

/** Keep the dragged crate centred on the hovered cell and inside the hold. */
export function dragPlacementAnchor(piece: Pick<Piece, 'shape' | 'rotation'>, cellX: number, cellY: number, holdWidth: number, holdHeight: number): { x: number; y: number } {
  const cells = rotatedCells(piece.shape, piece.rotation);
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  return {
    x: Math.max(0, Math.min(holdWidth - width, cellX - Math.floor(width / 2))),
    y: Math.max(0, Math.min(holdHeight - height, cellY - Math.floor(height / 2))),
  };
}
