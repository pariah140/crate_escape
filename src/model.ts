export type Phase = 'board' | 'pack' | 'run' | 'result' | 'yard';
export type CargoKind = 'standard' | 'bulky' | 'hot' | 'perishable' | 'fragile' | 'vip';
export type Cell = readonly [number, number];
export type Shape = 'single' | 'domino' | 'line3' | 'square' | 'ell' | 'tee' | 'ess';

export interface Job {
  id: string;
  client: string;
  cargo: string;
  kind: CargoKind;
  shapes: Shape[];
  payout: number;
  heat: number;
  destination: string;
  note: string;
  color: string;
  icon: string;
}

export interface Piece {
  id: string;
  jobId: string;
  shape: Shape;
  rotation: number;
  x: number | null;
  y: number | null;
}

export interface SaveData {
  cash: number;
  reputation: number;
  boat: 0 | 1;
  port: 0 | 1;
  upgrades: { engine: number; hull: number };
  runs: number;
  sound: boolean;
}

export const BOATS = [
  { name: 'Little Dinghy', width: 4, height: 3, speed: 1, hull: 100, price: 0, color: '#ff8557', description: 'A brave little boat with a snug hold.' },
  { name: 'Skipjack Speedboat', width: 5, height: 3, speed: 1.24, hull: 105, price: 250, color: '#ffe166', description: 'More room, more zoom, more excuses.' },
] as const;

export const PORTS = ['Sleepy Cove', 'Fogbank Harbour'] as const;

export const SHAPES: Record<Shape, Cell[]> = {
  single: [[0, 0]],
  domino: [[0, 0], [1, 0]],
  line3: [[0, 0], [1, 0], [2, 0]],
  square: [[0, 0], [1, 0], [0, 1], [1, 1]],
  ell: [[0, 0], [0, 1], [1, 1]],
  tee: [[0, 0], [1, 0], [2, 0], [1, 1]],
  ess: [[1, 0], [2, 0], [0, 1], [1, 1]],
};

export const SHAPE_NAMES: Record<Shape, string> = {
  single: 'Tiny', domino: 'Long', line3: 'Triple', square: 'Block', ell: 'L-shape', tee: 'T-shape', ess: 'Zigzag',
};

const coveJobs: Job[] = [
  { id: 'ducks', client: 'Lady Quacksworth', cargo: 'Collector ducks', kind: 'vip', shapes: ['square'], payout: 92, heat: 2, destination: 'Duckling Pier', note: 'VIP crate goes near the middle.', color: '#ffd34c', icon: '◆' },
  { id: 'gnomes', client: 'The Garden Club', cargo: 'Garden gnomes', kind: 'standard', shapes: ['ell'], payout: 58, heat: 1, destination: 'Mossy Jetty', note: 'Handle the hats with care.', color: '#79c8a6', icon: '♟' },
  { id: 'flamingos', client: 'Pink Flamingo Co.', cargo: 'Inflatable flamingos', kind: 'bulky', shapes: ['line3'], payout: 48, heat: 1, destination: 'Sunset Quay', note: 'Mostly air. Somehow still awkward.', color: '#fa90ad', icon: '✿' },
  { id: 'teapots', client: 'Auntie Kettle', cargo: 'Antique teapots', kind: 'fragile', shapes: ['domino'], payout: 64, heat: 2, destination: 'Little Bay', note: 'Collisions chip the payout.', color: '#b298e8', icon: '◈' },
  { id: 'mystery', client: 'Mr. Definitely Normal', cargo: 'Mystery boxes', kind: 'hot', shapes: ['domino', 'single'], payout: 112, heat: 4, destination: 'Quiet Dock', note: 'Unlabelled. Very suspiciously ordinary.', color: '#ec8b65', icon: '?' },
];

const fogJobs: Job[] = [
  { id: 'cheese', client: 'Captain Camembert', cargo: 'Moon cheese', kind: 'standard', shapes: ['square', 'single'], payout: 118, heat: 2, destination: 'Cheddar Point', note: 'The smell is its own searchlight.', color: '#ffcc62', icon: '◒' },
  { id: 'icecream', client: 'The Sundae Syndicate', cargo: 'Ice cream', kind: 'perishable', shapes: ['tee'], payout: 132, heat: 2, destination: 'Sprinkle Pier', note: 'Deliver before it becomes soup.', color: '#b4a1e8', icon: '✦' },
  { id: 'gnomes2', client: 'Gnome Away Ltd.', cargo: 'Travel gnomes', kind: 'standard', shapes: ['ell', 'domino'], payout: 126, heat: 1, destination: 'Fern Landing', note: 'Now with tiny suitcases.', color: '#79c8a6', icon: '♟' },
  { id: 'duck2', client: 'Lady Quacksworth', cargo: 'Golden duck', kind: 'vip', shapes: ['square'], payout: 154, heat: 3, destination: 'Royal Slip', note: 'Centre the crate for a happy customer.', color: '#ffd34c', icon: '◆' },
  { id: 'mystery2', client: 'Mr. Definitely Normal', cargo: 'Unlabelled crates', kind: 'hot', shapes: ['ess'], payout: 164, heat: 5, destination: 'The Back Pier', note: 'Best not to ask about the labels.', color: '#ec8b65', icon: '?' },
];

export function jobsForPort(port: number): Job[] { return port === 0 ? coveJobs : fogJobs; }
export function jobById(id: string): Job | undefined { return [...coveJobs, ...fogJobs].find(job => job.id === id); }

export function rotatedCells(shape: Shape, rotation: number): Cell[] {
  let cells: Cell[] = SHAPES[shape].map(([x, y]) => [x, y]);
  for (let i = 0; i < ((rotation % 4) + 4) % 4; i++) cells = cells.map(([x, y]) => [-y, x]);
  const minX = Math.min(...cells.map(cell => cell[0]));
  const minY = Math.min(...cells.map(cell => cell[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

export function occupiedCells(piece: Piece): Cell[] {
  if (piece.x === null || piece.y === null) return [];
  return rotatedCells(piece.shape, piece.rotation).map(([x, y]) => [x + piece.x!, y + piece.y!]);
}

export function canPlace(piece: Piece, x: number, y: number, pieces: Piece[], width: number, height: number): boolean {
  const used = new Set(pieces.filter(other => other.id !== piece.id).flatMap(other => occupiedCells(other).map(([cx, cy]) => `${cx},${cy}`)));
  return rotatedCells(piece.shape, piece.rotation).every(([cx, cy]) => {
    const px = x + cx, py = y + cy;
    if (px < 0 || py < 0 || px >= width || py >= height || used.has(`${px},${py}`)) return false;
    if (jobById(piece.jobId)?.kind === 'vip') {
      const centreX = (width - 1) / 2, centreY = (height - 1) / 2;
      if (!rotatedCells(piece.shape, piece.rotation).some(([vx, vy]) => Math.abs(x + vx - centreX) <= 0.5 && Math.abs(y + vy - centreY) <= 0.5)) return false;
    }
    return true;
  });
}

/** Bitmask search keeps job acceptance instant, even when the hold is nearly full. */
export function canFitAll(pieces: Piece[], width: number, height: number): boolean {
  let occupied = 0n;
  for (const piece of pieces) for (const [x, y] of occupiedCells(piece)) occupied |= 1n << BigInt(y * width + x);
  const centreX = (width - 1) / 2, centreY = (height - 1) / 2;
  const choices = pieces.filter(piece => piece.x === null).map(piece => {
    const masks = new Set<bigint>();
    for (let rotation = 0; rotation < 4; rotation++) {
      const cells = rotatedCells(piece.shape, rotation);
      const shapeWidth = Math.max(...cells.map(([x]) => x)) + 1;
      const shapeHeight = Math.max(...cells.map(([, y]) => y)) + 1;
      for (let y = 0; y <= height - shapeHeight; y++) for (let x = 0; x <= width - shapeWidth; x++) {
        if (jobById(piece.jobId)?.kind === 'vip' && !cells.some(([cx, cy]) => Math.abs(x + cx - centreX) <= 0.5 && Math.abs(y + cy - centreY) <= 0.5)) continue;
        let mask = 0n;
        for (const [cx, cy] of cells) mask |= 1n << BigInt((y + cy) * width + x + cx);
        masks.add(mask);
      }
    }
    return [...masks];
  }).sort((a, b) => a.length - b.length);
  const failed = new Set<string>();
  function search(index: number, used: bigint): boolean {
    if (index === choices.length) return true;
    const key = `${index}:${used}`;
    if (failed.has(key)) return false;
    for (const mask of choices[index]) if ((used & mask) === 0n && search(index + 1, used | mask)) return true;
    failed.add(key); return false;
  }
  return search(0, occupied);
}

export function defaultSave(): SaveData {
  return { cash: 80, reputation: 0, boat: 0, port: 0, upgrades: { engine: 0, hull: 0 }, runs: 0, sound: true };
}

export function loadSave(): SaveData {
  try {
    const data = JSON.parse(localStorage.getItem('crate-escape-save-v1') || 'null') as Partial<SaveData> | null;
    if (!data || typeof data.cash !== 'number') return defaultSave();
    return { ...defaultSave(), ...data, upgrades: { ...defaultSave().upgrades, ...data.upgrades } };
  } catch { return defaultSave(); }
}

export function persist(data: SaveData): void {
  try { localStorage.setItem('crate-escape-save-v1', JSON.stringify(data)); } catch { /* Private browsing can block storage. */ }
}
