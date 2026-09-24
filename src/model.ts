import { HARBORS } from './harbors';
export { HARBORS } from './harbors';

export type Phase = 'board' | 'pack' | 'run' | 'result' | 'yard' | 'market' | 'map';
export type CargoKind = 'standard' | 'bulky' | 'hot' | 'perishable' | 'fragile' | 'vip';
export type Cell = readonly [number, number];
export type Shape = 'single' | 'domino' | 'line3' | 'square' | 'ell' | 'tee' | 'ess';
export type BoatStyle = 'dinghy' | 'speedboat' | 'trawler' | 'cruiser' | 'freighter' | 'skiff' | 'catamaran' | 'houseboat' | 'clipper' | 'barge';
export interface BoatDefinition {
  name: string; style: BoatStyle; width: number; height: number; blocked: Cell[];
  speed: number; turnRate: number; acceleration: number; coast: number; hull: number;
  price: number; repairRate: number; color: string; description: string; handling: string;
}
export interface BoatUpgrades { engine: number; hull: number }
export interface YardUpgrades { repairBay: number; brokerDesk: number }

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
  rare?: boolean;
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
  boat: number;
  ownedBoats: number[];
  port: number;
  unlockedPorts: number[];
  boatUpgrades: Record<number, BoatUpgrades>;
  boatCondition: Record<number, number>;
  yardUpgrades: YardUpgrades;
  runs: number;
  level: number;
  soundTutorialSeen: boolean;
  sound: boolean;
}

export const BOATS: BoatDefinition[] = [
  { name: 'Little Dinghy', style: 'dinghy', width: 4, height: 3, blocked: [], speed: 1, turnRate: 3.8, acceleration: 2.7, coast: 1.25, hull: 100, price: 0, repairRate: 1, color: '#ff8557', handling: 'Nimble', description: 'Tiny turns and a snug, square hold.' },
  { name: 'Skipjack Speedboat', style: 'speedboat', width: 5, height: 4, blocked: [[0, 0], [4, 0]], speed: 1.25, turnRate: 2.9, acceleration: 3.1, coast: 1.15, hull: 95, price: 250, repairRate: 1.2, color: '#ffe166', handling: 'Quick', description: 'Fast, pointed, and roomy behind the bow.' },
  { name: 'Merry Trawler', style: 'trawler', width: 6, height: 4, blocked: [[0, 0], [5, 0]], speed: 0.91, turnRate: 2.0, acceleration: 1.8, coast: 0.85, hull: 145, price: 720, repairRate: 1.45, color: '#75c7a6', handling: 'Steady', description: 'A broad workboat that shrugs off bumps.' },
  { name: 'Sunbeam Cruiser', style: 'cruiser', width: 7, height: 5, blocked: [[0, 0], [6, 0], [0, 4], [6, 4]], speed: 1.08, turnRate: 1.5, acceleration: 1.35, coast: 0.7, hull: 180, price: 1650, repairRate: 1.8, color: '#f49aa0', handling: 'Wide turns', description: 'Long decks, a pinched bow, and plenty of cargo room.' },
  { name: 'Cloudbreak Freighter', style: 'freighter', width: 8, height: 6, blocked: [[0, 0], [7, 0], [3, 5], [4, 5]], speed: 0.82, turnRate: 0.9, acceleration: 0.9, coast: 0.48, hull: 250, price: 3400, repairRate: 2.2, color: '#a79cda', handling: 'Heavy turns', description: 'A floating warehouse with a slow, deliberate helm.' },
  { name: 'Pip Skiff', style: 'skiff', width: 5, height: 3, blocked: [[0, 0], [4, 0]], speed: 1.42, turnRate: 4.1, acceleration: 3.6, coast: 1.4, hull: 75, price: 390, repairRate: 1.25, color: '#7ccbe1', handling: 'Razor turns', description: 'A darting little courier with exposed deck space.' },
  { name: 'Twinfin Catamaran', style: 'catamaran', width: 6, height: 5, blocked: [[0, 0], [5, 0], [2, 4], [3, 4]], speed: 1.18, turnRate: 2.25, acceleration: 2.15, coast: 0.92, hull: 125, price: 1080, repairRate: 1.55, color: '#87ddd1', handling: 'Balanced', description: 'Two slim hulls and a broad, split cargo deck.' },
  { name: 'Hearthside Houseboat', style: 'houseboat', width: 7, height: 5, blocked: [[0, 0], [6, 0], [0, 4], [6, 4]], speed: 0.76, turnRate: 1.12, acceleration: 1.05, coast: 0.56, hull: 205, price: 1980, repairRate: 1.7, color: '#f1b779', handling: 'Gentle turns', description: 'A floating cottage with a generous square hold.' },
  { name: 'Bluebell Clipper', style: 'clipper', width: 8, height: 5, blocked: [[0, 0], [7, 0], [0, 4], [7, 4]], speed: 1.3, turnRate: 1.3, acceleration: 1.45, coast: 0.65, hull: 160, price: 2850, repairRate: 2.05, color: '#7cafe0', handling: 'Sweeping turns', description: 'A long, swift hull that needs room to carve.' },
  { name: 'Mossbank Barge', style: 'barge', width: 9, height: 6, blocked: [[0, 0], [8, 0], [0, 5], [8, 5]], speed: 0.68, turnRate: 0.68, acceleration: 0.75, coast: 0.36, hull: 310, price: 4950, repairRate: 2.45, color: '#a5bb7a', handling: 'Very wide turns', description: 'The biggest hold afloat, with a patient helm.' },
];

export const usableCells = (boat: BoatDefinition): number => boat.width * boat.height - boat.blocked.length;
export const isBlocked = (x: number, y: number, blocked: readonly Cell[]): boolean => blocked.some(([bx, by]) => bx === x && by === y);
export const boatUpgrade = (save: SaveData, index = save.boat): BoatUpgrades => save.boatUpgrades[index] || { engine: 0, hull: 0 };
export const repairCost = (save: SaveData, index = save.boat): number => Math.ceil(
  (100 - (save.boatCondition[index] ?? 100)) * BOATS[index].repairRate * (1 - save.yardUpgrades.repairBay * 0.18),
);
export const rareChance = (save: SaveData): number => 0.14 + save.yardUpgrades.brokerDesk * 0.16;

export const PORTS = HARBORS.map(harbor => harbor.name);
export function harborRequirements(save: SaveData, index: number): string[] {
  const harbor = HARBORS[index];
  if (!harbor) return ['Unknown harbor'];
  const unmet: string[] = [];
  if (index > 0 && !save.unlockedPorts.includes(index - 1)) unmet.push(`Unlock ${HARBORS[index - 1].name} first`);
  if (harbor.requiredBoat !== null && !save.ownedBoats.includes(harbor.requiredBoat)) unmet.push(`Own the ${BOATS[harbor.requiredBoat].name}`);
  if (save.reputation < harbor.reputation) unmet.push(`${harbor.reputation} reputation (${Math.floor(save.reputation)}/${harbor.reputation})`);
  if (Math.max(...save.ownedBoats.map(id => usableCells(BOATS[id]))) < harbor.capacity) unmet.push(`Own a boat with ${harbor.capacity}+ cargo cells`);
  return unmet;
}
export function refreshHarborUnlocks(save: SaveData): number[] {
  const unlocked = new Set(save.unlockedPorts);
  HARBORS.forEach((_, index) => {
    save.unlockedPorts = [...unlocked].sort((a, b) => a - b);
    if (harborRequirements(save, index).length === 0) unlocked.add(index);
  });
  save.unlockedPorts = [...unlocked].sort((a, b) => a - b);
  return save.unlockedPorts;
}

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

const coralJobs: Job[] = [
  { id: 'coralglass', client: 'Reef Glassworks', cargo: 'Sea glass lamps', kind: 'fragile', shapes: ['square', 'domino'], payout: 210, heat: 2, destination: 'Shell Pier', note: 'Keep the glass out of trouble.', color: '#91d7c7', icon: '◈' },
  { id: 'sunsails', client: 'Sun Sail Club', cargo: 'Festival sails', kind: 'bulky', shapes: ['tee', 'ell'], payout: 230, heat: 2, destination: 'Palm Jetty', note: 'Beautiful, but they catch every breeze.', color: '#ffb66d', icon: '✿' },
  { id: 'seahorses', client: 'The Tiny Aquarium', cargo: 'Seahorse tanks', kind: 'vip', shapes: ['square', 'single'], payout: 255, heat: 3, destination: 'Lagoon Slip', note: 'Centre the VIP tank.', color: '#acd0ec', icon: '◆' },
  { id: 'reefice', client: 'Coral Creamery', cargo: 'Frozen reef treats', kind: 'perishable', shapes: ['ess', 'domino'], payout: 270, heat: 3, destination: 'Bright Quay', note: 'The sun is not on your side.', color: '#f8aabd', icon: '❄' },
  { id: 'coralcrate', client: 'Captain Hush', cargo: 'Sealed reef crates', kind: 'hot', shapes: ['tee', 'square'], payout: 310, heat: 5, destination: 'Hidden Anchorage', note: 'The patrol knows this sender.', color: '#e69b82', icon: '?' },
];
const lanternJobs: Job[] = [
  { id: 'lanterns', client: 'Night Market Guild', cargo: 'Paper lanterns', kind: 'fragile', shapes: ['tee', 'square'], payout: 340, heat: 2, destination: 'Glow Pier', note: 'Delicate and dazzling.', color: '#f4c573', icon: '✦' },
  { id: 'clockwork', client: 'Clockwork & Co.', cargo: 'Toy automata', kind: 'standard', shapes: ['ess', 'ell', 'single'], payout: 360, heat: 3, destination: 'Clock Quay', note: 'Some of them tick on the way.', color: '#adbee1', icon: '♟' },
  { id: 'velvet', client: 'Madame Marigold', cargo: 'Velvet costumes', kind: 'vip', shapes: ['square', 'domino'], payout: 385, heat: 3, destination: 'Theatre Dock', note: 'A central berth for the star crate.', color: '#e8a1be', icon: '◆' },
  { id: 'noodles', client: 'Moon Noodle House', cargo: 'Midnight noodles', kind: 'perishable', shapes: ['tee', 'tee'], payout: 405, heat: 2, destination: 'Lantern Steps', note: 'Hot food waits for nobody.', color: '#e8d899', icon: '◒' },
  { id: 'masked', client: 'The Masked Merchant', cargo: 'Masked parcels', kind: 'hot', shapes: ['square', 'ess'], payout: 470, heat: 5, destination: 'Shaded Slip', note: 'The market closes at dawn.', color: '#b697d8', icon: '?' },
];
const starfallJobs: Job[] = [
  { id: 'comets', client: 'The Observatory', cargo: 'Comet lenses', kind: 'fragile', shapes: ['square', 'tee'], payout: 540, heat: 3, destination: 'Sky Pier', note: 'One scratch ruins the view.', color: '#a3d7e8', icon: '✧' },
  { id: 'starfruit', client: 'Starlight Orchard', cargo: 'Starfruit baskets', kind: 'perishable', shapes: ['ess', 'ell', 'domino'], payout: 565, heat: 2, destination: 'Orchard Jetty', note: 'Bring the harvest home fresh.', color: '#f2bf70', icon: '✿' },
  { id: 'festivalgrand', client: 'The Grand Regatta', cargo: 'Regatta trophies', kind: 'vip', shapes: ['square', 'square'], payout: 610, heat: 4, destination: 'Champion Dock', note: 'The winner rides in the centre.', color: '#ebd192', icon: '◆' },
  { id: 'meteor', client: 'The Meteor Museum', cargo: 'Meteor fragments', kind: 'bulky', shapes: ['tee', 'ess', 'line3'], payout: 650, heat: 3, destination: 'Crater Quay', note: 'Heavier than they look.', color: '#a6a9cb', icon: '◈' },
  { id: 'cosmic', client: 'Captain Nobody', cargo: 'Cosmic mystery cases', kind: 'hot', shapes: ['square', 'tee', 'domino'], payout: 740, heat: 5, destination: 'Far Point', note: 'The patrol would like a word.', color: '#d99cba', icon: '?' },
];
const generatedJobs: Job[][] = HARBORS.slice(5).map((harbor, offset) => {
  const port = offset + 5;
  const kinds: CargoKind[] = ['standard', 'bulky', 'fragile', 'perishable', 'hot'];
  const shapes: Shape[][] = [['ell', 'domino'], ['tee', 'line3'], ['square', 'domino'], ['ess', 'ell'], ['square', 'tee']];
  const clients = ['Coastal Workshop', 'Festival Guild', 'Harbor Collector', 'Waterside Kitchen', 'The Night Broker'];
  const notes = ['A local commission with a long journey.', 'Awkward shapes need a careful hold.', 'Handle gently; a rough voyage lowers the pay.', 'Fresh cargo needs a quick arrival.', 'Patrols are already curious about these crates.'];
  return harbor.cargo.map((cargo, index) => ({
    id: `harbor-${port}-${index}`, client: `${harbor.name} ${clients[index]}`, cargo,
    kind: kinds[index], shapes: shapes[index], payout: 210 + port * 58 + index * 47,
    heat: Math.min(5, 1 + index), destination: `${harbor.name} ${index % 2 ? 'Jetty' : 'Pier'}`,
    note: notes[index], color: [harbor.color, '#f3c27c', '#a9cbe0', '#b7d4b5', '#d4a5b9'][index],
    icon: ['✿', '▣', '◈', '◒', '?'][index],
  }));
});
const portJobs: Job[][] = [coveJobs, fogJobs, coralJobs, lanternJobs, starfallJobs, ...generatedJobs];

const specialJobs: Job[][] = [
  [{ id: 'pearl', client: 'The Pearl Conservatory', cargo: 'Moonlit pearls', kind: 'fragile', shapes: ['tee', 'domino'], payout: 265, heat: 3, destination: 'Starfish Wharf', note: 'Rare commission · handle every crate gently.', color: '#a8dded', icon: '✧', rare: true },
    { id: 'festival', client: 'Harbour Festival', cargo: 'Firework lanterns', kind: 'vip', shapes: ['square', 'ell'], payout: 295, heat: 4, destination: 'Lantern Pier', note: 'Rare commission · keep the VIP crate centred.', color: '#f8b476', icon: '✦', rare: true }],
  [{ id: 'crown', client: 'The Crown Museum', cargo: 'Lost crown jewels', kind: 'vip', shapes: ['square', 'tee'], payout: 390, heat: 5, destination: 'Royal Slip', note: 'Rare commission · the patrol is watching.', color: '#e2bf73', icon: '✧', rare: true },
    { id: 'starlight', client: 'The Astral Society', cargo: 'Starlight bottles', kind: 'fragile', shapes: ['ess', 'domino'], payout: 360, heat: 3, destination: 'Moonbeam Dock', note: 'Rare commission · a very delicate delivery.', color: '#bca9ec', icon: '✦', rare: true }],
  [{ id: 'reefpearl', client: 'Pearl Divers Union', cargo: 'Rainbow pearls', kind: 'fragile', shapes: ['square', 'ess'], payout: 520, heat: 4, destination: 'Pearl Point', note: 'Rare commission · every shell is precious.', color: '#a6e4d8', icon: '✧', rare: true }],
  [{ id: 'royallantern', client: 'The Royal Lanterns', cargo: 'Golden lanterns', kind: 'vip', shapes: ['square', 'tee', 'single'], payout: 720, heat: 5, destination: 'Palace Pier', note: 'Rare commission · keep the gold centred.', color: '#f2ca75', icon: '✦', rare: true }],
  [{ id: 'constellation', client: 'The Star Cartographers', cargo: 'Constellation charts', kind: 'fragile', shapes: ['square', 'tee', 'ell'], payout: 990, heat: 4, destination: 'North Star Dock', note: 'Rare commission · the charts are one of a kind.', color: '#bed0f1', icon: '★', rare: true }],
];
for (let port = 5; port < HARBORS.length; port++) {
  const harbor = HARBORS[port];
  specialJobs.push([{
    id: `harbor-${port}-rare`, client: `${harbor.name} Cartographers`, cargo: `${harbor.name} secret charts`,
    kind: 'fragile', shapes: ['square', 'tee', 'domino'], payout: 450 + port * 83, heat: 4,
    destination: `${harbor.name} Hidden Dock`, note: 'Rare commission · protect these one-of-a-kind charts.',
    color: harbor.color, icon: '✧', rare: true,
  }]);
}

/** One stable offer per completed run. A better broker increases the offer frequency. */
export function specialOfferFor(save: SaveData): Job | null {
  const seed = ((save.runs + 1) * 1664525 + save.port * 1013904223) >>> 0;
  const roll = ((seed ^ (seed >>> 16)) % 1000) / 1000;
  return roll < rareChance(save) ? specialJobs[save.port][seed % specialJobs[save.port].length] : null;
}
export function jobsForPort(port: number, special: Job | null = null): Job[] { return [...(portJobs[port] || coveJobs), ...(special ? [special] : [])]; }
export function jobById(id: string): Job | undefined { return [...portJobs.flat(), ...specialJobs.flat()].find(job => job.id === id); }

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

export function canPlace(piece: Piece, x: number, y: number, pieces: Piece[], width: number, height: number, blocked: readonly Cell[] = []): boolean {
  const used = new Set(pieces.filter(other => other.id !== piece.id).flatMap(other => occupiedCells(other).map(([cx, cy]) => `${cx},${cy}`)));
  return rotatedCells(piece.shape, piece.rotation).every(([cx, cy]) => {
    const px = x + cx, py = y + cy;
    if (px < 0 || py < 0 || px >= width || py >= height || isBlocked(px, py, blocked) || used.has(`${px},${py}`)) return false;
    if (jobById(piece.jobId)?.kind === 'vip') {
      const centreX = (width - 1) / 2, centreY = (height - 1) / 2;
      if (!rotatedCells(piece.shape, piece.rotation).some(([vx, vy]) => Math.abs(x + vx - centreX) <= 0.5 && Math.abs(y + vy - centreY) <= 0.5)) return false;
    }
    return true;
  });
}

/** Bitmask search keeps job acceptance instant, even when the hold is nearly full. */
export function canFitAll(pieces: Piece[], width: number, height: number, blocked: readonly Cell[] = []): boolean {
  let occupied = 0n;
  for (const [x, y] of blocked) occupied |= 1n << BigInt(y * width + x);
  for (const piece of pieces) for (const [x, y] of occupiedCells(piece)) {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const bit = 1n << BigInt(y * width + x);
    if (occupied & bit) return false;
    occupied |= bit;
  }
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
  return { cash: 80, reputation: 0, boat: 0, ownedBoats: [0], port: 0, unlockedPorts: [0], boatUpgrades: { 0: { engine: 0, hull: 0 } }, boatCondition: { 0: 100 }, yardUpgrades: { repairBay: 0, brokerDesk: 0 }, runs: 0, level: 1, soundTutorialSeen: false, sound: true };
}

export function loadSave(): SaveData {
  try {
    const data = JSON.parse(localStorage.getItem('crate-escape-save-v1') || 'null') as (Partial<SaveData> & { upgrades?: BoatUpgrades }) | null;
    if (!data || typeof data.cash !== 'number') return defaultSave();
    const initial = defaultSave();
    const selected = Number.isInteger(data.boat) && data.boat! >= 0 && data.boat! < BOATS.length ? data.boat! : 0;
    const owned = [...new Set([0, ...(Array.isArray(data.ownedBoats) ? data.ownedBoats : [selected])])].filter(index => Number.isInteger(index) && index >= 0 && index < BOATS.length);
    const boatUpgrades: SaveData['boatUpgrades'] = {};
    const boatCondition: SaveData['boatCondition'] = {};
    for (const index of owned) {
      const previous = data.boatUpgrades?.[index] || (index === selected ? data.upgrades : undefined);
      boatUpgrades[index] = { engine: Math.max(0, Math.min(3, Number(previous?.engine) || 0)), hull: Math.max(0, Math.min(3, Number(previous?.hull) || 0)) };
      boatCondition[index] = Math.max(30, Math.min(100, Number(data.boatCondition?.[index]) || 100));
    }
    const restored: SaveData = { cash: Math.max(0, data.cash), reputation: Number(data.reputation) || 0, boat: owned.includes(selected) ? selected : 0,
      ownedBoats: owned, port: Number.isInteger(data.port) && data.port! >= 0 && data.port! < HARBORS.length ? data.port! : 0,
      unlockedPorts: [...new Set([0, ...(Array.isArray(data.unlockedPorts) ? data.unlockedPorts : data.port === 1 ? [1] : [])])].filter(index => Number.isInteger(index) && index >= 0 && index < HARBORS.length), boatUpgrades, boatCondition,
      yardUpgrades: { repairBay: Math.max(0, Math.min(3, Number(data.yardUpgrades?.repairBay) || 0)), brokerDesk: Math.max(0, Math.min(3, Number(data.yardUpgrades?.brokerDesk) || 0)) },
      runs: Math.max(0, Number(data.runs) || 0), level: Math.max(1, Math.floor(Number(data.level) || (Math.max(0, Number(data.runs) || 0) + 1))),
      soundTutorialSeen: data.soundTutorialSeen === true, sound: typeof data.sound === 'boolean' ? data.sound : initial.sound };
    refreshHarborUnlocks(restored);
    if (!restored.unlockedPorts.includes(restored.port)) restored.port = 0;
    return restored;
  } catch { return defaultSave(); }
}

export function persist(data: SaveData): void {
  try { localStorage.setItem('crate-escape-save-v1', JSON.stringify(data)); } catch { /* Private browsing can block storage. */ }
}
