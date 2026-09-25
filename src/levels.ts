import { HARBORS } from './harbors';

export const ROUTE_END = 520;
export type Weather = 'clear' | 'wind' | 'rain' | 'fog' | 'storm' | 'snow';
export type HazardKind = 'rock' | 'buoy' | 'sandbank' | 'iceberg';
export interface RouteHazard { x: number; z: number; radius: number; kind: HazardKind }
export interface CurrentZone { x: number; z: number; radius: number; direction: number; strength: number }
export interface PatrolSlot { x: number; z: number; sound: boolean }
export interface LevelPlan {
  number: number; port: number; channelWidth: number; hazards: RouteHazard[];
  currents: CurrentZone[]; patrols: PatrolSlot[]; weather: Weather; night: boolean;
  wind: number; payoutMultiplier: number;
}
const hash = (seed: number): number => {
  const value = Math.sin(seed * 91.417 + 17.3) * 43758.5453;
  return value - Math.floor(value);
};

/** The centreline and coast shape belong to the harbour, so repeat visits feel familiar. */
export function harborCourseSlope(port: number): number {
  const rank = (port * 7 + 16) % HARBORS.length;
  return rank < 12 ? -.215 - (11 - rank) * .02 : .215 + (rank - 12) * .02;
}
export function channelCenter(plan: LevelPlan, z: number): number {
  const harbor = HARBORS[plan.port];
  const main = Math.sin(z * harbor.frequency + harbor.phase) - Math.sin(harbor.phase);
  const detail = Math.sin(z * (harbor.frequency * 1.9) + harbor.phase * 1.7) - Math.sin(harbor.phase * 1.7);
  return harborCourseSlope(plan.port) * z + harbor.bend * (main * .8 + detail * .18);
}
export function channelHalfWidth(plan: LevelPlan, z: number): number {
  return plan.channelWidth + Math.sin(z * .026 + plan.port * .43) * 1.05 + Math.sin(z * .073 + plan.port) * .45;
}
export function offshoreState(plan: LevelPlan, x: number, z: number): { distance: number; side: number; zone: 'charted' | 'warning' | 'rough' | 'danger'; push: number; drag: number; swell: number } {
  const offset = x - channelCenter(plan, z);
  const distance = Math.max(0, Math.abs(offset) - channelHalfWidth(plan, z));
  const side = Math.sign(offset) || 1;
  const zone = distance < .1 ? 'charted' : distance < 8 ? 'warning' : distance < 20 ? 'rough' : 'danger';
  const swell = Math.min(1, distance / 28);
  return { distance, side, zone, push: -side * Math.min(10, distance * .2 + Math.max(0, distance - 8) * .12), drag: Math.min(.5, distance * .012), swell };
}
export function offshoreWaveStrength(plan: LevelPlan, x: number, z: number): number {
  const t = Math.min(1, offshoreState(plan, x, z).distance / 42);
  return t * t * (3 - 2 * t);
}
export function roughWaterPush(plan: LevelPlan, x: number, z: number, time: number): { x: number; z: number } {
  const swell = offshoreState(plan, x, z).swell;
  return { x: swell * (Math.sin(time * 2.7 + z * .16) * 2.7 + Math.sin(time * 1.4 + x * .12) * 1.5),
    z: swell * (Math.cos(time * 2.25 + x * .18) * 1.8) };
}
export function destinationX(plan: LevelPlan): number { return channelCenter(plan, 532) - 1.8; }
export function canDock(plan: LevelPlan, x: number, z: number): boolean {
  return z >= ROUTE_END && Math.abs(x - destinationX(plan)) <= 8;
}

export function levelPlan(number: number, port: number): LevelPlan {
  const level = Number.isFinite(number) ? Math.max(1, Math.floor(number)) : 1;
  const harborIndex = Math.max(0, Math.min(HARBORS.length - 1, Math.floor(port)));
  const harbor = HARBORS[harborIndex];
  const region = Math.floor(harborIndex / 5);
  const tier = Math.min(1, (level - 1) / 99);
  const channelWidth = 20 - tier * 3.3 - region * .35 + (harborIndex % 3) * .3;
  const rockCount = Math.min(18, 4 + Math.floor((level - 1) / 9) + region + (harbor.biome === 'cliff' || harbor.biome === 'volcanic' ? 2 : 0));
  const sandCount = level < 8 && harborIndex < 2 ? 0 : Math.min(9, 1 + Math.floor(Math.max(0, level - 8) / 15) + Math.floor(region / 2) + (harbor.biome === 'reef' ? 2 : harbor.biome === 'ice' ? 1 : 0));
  const currentCount = level < 14 && harborIndex < 5 ? 0 : Math.min(7, 1 + Math.floor(Math.max(0, level - 14) / 25) + Math.floor(region / 2) + (harbor.biome === 'marsh' ? 2 : 0));
  const patrolCount = Math.min(10, 2 + Math.floor((level - 1) / 17) + Math.floor(region / 2));
  let weather: Weather = 'clear';
  if (level >= 50 && (level + harborIndex) % 7 === 0) weather = 'storm';
  else if (level >= 34 && (level + harborIndex) % 4 === 0) weather = 'fog';
  else if (level >= 25 && (level + harborIndex) % 3 === 0) weather = 'rain';
  else if (level >= 16 && (level + harborIndex) % 2 === 0) weather = 'wind';
  if (harbor.biome === 'ice' && (level + harborIndex) % 4 !== 0) weather = 'snow';
  const night = level >= 61 && ((level + harborIndex) % 3 !== 0 || harborIndex >= 20);
  const plan: LevelPlan = { number: level, port: harborIndex, channelWidth, hazards: [], currents: [], patrols: [], weather, night,
    wind: weather === 'wind' ? 1.3 + tier * 1.7 : weather === 'storm' ? 2.8 + tier * 1.8 : weather === 'snow' ? .8 + tier : weather === 'rain' ? .55 : 0,
    payoutMultiplier: 1 + Math.log2(level) * .085 + harborIndex * .018,
  };
  for (let i = 0; i < rockCount; i++) {
    const seed = harborIndex * 613 + i * 17 + (i >= 4 ? level * 37 : 0);
    const z = 38 + i * 460 / Math.max(rockCount - 1, 1) + (hash(seed) - .5) * 12;
    const side = hash(seed + 77) > .5 ? 1 : -1;
    const x = channelCenter(plan, z) + side * (3.5 + hash(seed + 13) * (channelWidth - 8));
    plan.hazards.push({ x, z, radius: harbor.biome === 'ice' ? 1.6 + hash(seed + 31) * .7 : 1.2 + hash(seed + 31) * .55, kind: harbor.biome === 'ice' ? 'iceberg' : 'rock' });
  }
  for (let i = 0; i < sandCount; i++) {
    const seed = harborIndex * 127 + i * 11 + (i >= 2 ? level * 47 : 0);
    const z = 68 + i * 420 / Math.max(sandCount, 1) + (hash(seed) - .5) * 19;
    const side = (i + harborIndex) % 2 ? -1 : 1;
    plan.hazards.push({ x: channelCenter(plan, z) + side * (channelWidth - 4.2 - hash(seed + 7) * 2.5), z, radius: 2.15 + tier * .75, kind: 'sandbank' });
  }
  const buoyCount = Math.min(12, 5 + Math.floor(level / 14));
  for (let i = 0; i < buoyCount; i++) {
    const z = 28 + i * 470 / buoyCount;
    plan.hazards.push({ x: channelCenter(plan, z) + (i % 2 ? -1 : 1) * (channelHalfWidth(plan, z) - 1.9), z, radius: .55, kind: 'buoy' });
  }
  // Sparse offshore hazards give each coast its own readable character beyond the marked route.
  if (['reef', 'cliff', 'volcanic', 'ice'].includes(harbor.biome)) {
    for (let i = 0; i < 6; i++) {
      const z = 65 + i * 79 + hash(harborIndex * 91 + i) * 18;
      const side = i % 2 ? -1 : 1;
      const kind: HazardKind = harbor.biome === 'reef' ? 'sandbank' : harbor.biome === 'ice' ? 'iceberg' : 'rock';
      plan.hazards.push({ x: channelCenter(plan, z) + side * (channelHalfWidth(plan, z) + 14 + hash(i * 13 + harborIndex) * 6), z,
        radius: kind === 'sandbank' ? 2.5 : kind === 'iceberg' ? 2.1 : 1.7, kind });
    }
  }
  plan.currents = Array.from({ length: currentCount }, (_, i) => {
    const z = 92 + i * 365 / Math.max(currentCount, 1) + hash(level * 61 + i + harborIndex * 9) * 28;
    return { x: channelCenter(plan, z) + (i % 2 ? -1 : 1) * (2 + hash(level * 13 + i) * 5), z,
      radius: 4.2 + tier * 1.7, direction: i % 2 ? -1 : 1, strength: 1.6 + tier * 1.8 + region * .2 };
  });
  plan.patrols = Array.from({ length: patrolCount }, (_, i) => {
    const z = 64 + i * 415 / Math.max(patrolCount - 1, 1);
    return { x: channelCenter(plan, z) + (i % 2 ? -1 : 1) * (3.7 + hash(harborIndex * 73 + i) * 1.5), z,
      sound: level >= 26 && (i === Math.floor(patrolCount / 2) || (level >= 55 && i % 4 === 1)) };
  });
  return plan;
}
export function currentPush(plan: LevelPlan, x: number, z: number, time: number): number {
  return plan.currents.reduce((force, current) => {
    const distance = Math.hypot(x - current.x, z - current.z);
    const falloff = Math.max(0, 1 - distance / current.radius);
    return force + current.direction * current.strength * falloff * (.8 + Math.sin(time * 1.3 + current.z) * .2);
  }, 0);
}
export function weatherPush(plan: LevelPlan, time: number): number {
  return plan.wind * (Math.sin(time * .32 + plan.number) * .55 + Math.sin(time * 1.17) * .45);
}
