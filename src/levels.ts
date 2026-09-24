import { HARBORS } from './harbors';

export const ROUTE_END = 520;
export type Weather = 'clear' | 'wind' | 'rain' | 'fog' | 'storm';
export type HazardKind = 'rock' | 'buoy' | 'sandbank';
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
export function channelCenter(plan: LevelPlan, z: number): number {
  const harbor = HARBORS[plan.port];
  const main = Math.sin(z * harbor.frequency + harbor.phase) - Math.sin(harbor.phase);
  const detail = Math.sin(z * (harbor.frequency * 1.9) + harbor.phase * 1.7) - Math.sin(harbor.phase * 1.7);
  return harbor.bend * (main * .8 + detail * .18);
}
export function channelHalfWidth(plan: LevelPlan, z: number): number {
  return plan.channelWidth + Math.sin(z * .026 + plan.port * .43) * 1.05 + Math.sin(z * .073 + plan.port) * .45;
}
export function clampToChannel(plan: LevelPlan, x: number, z: number, hullRadius = 1.25): number {
  const center = channelCenter(plan, z);
  const half = channelHalfWidth(plan, z) - hullRadius;
  return Math.max(center - half, Math.min(center + half, x));
}
export function destinationX(plan: LevelPlan): number { return channelCenter(plan, 532) - 1.8; }

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
  const night = level >= 61 && ((level + harborIndex) % 3 !== 0 || harborIndex >= 20);
  const plan: LevelPlan = { number: level, port: harborIndex, channelWidth, hazards: [], currents: [], patrols: [], weather, night,
    wind: weather === 'wind' ? 1.3 + tier * 1.7 : weather === 'storm' ? 2.8 + tier * 1.8 : weather === 'rain' ? .55 : 0,
    payoutMultiplier: 1 + Math.log2(level) * .085 + harborIndex * .018,
  };
  for (let i = 0; i < rockCount; i++) {
    const seed = harborIndex * 613 + i * 17 + (i >= 4 ? level * 37 : 0);
    const z = 38 + i * 460 / Math.max(rockCount - 1, 1) + (hash(seed) - .5) * 12;
    const side = hash(seed + 77) > .5 ? 1 : -1;
    const x = channelCenter(plan, z) + side * (3.5 + hash(seed + 13) * (channelWidth - 8));
    plan.hazards.push({ x, z, radius: 1.2 + hash(seed + 31) * .55, kind: 'rock' });
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
