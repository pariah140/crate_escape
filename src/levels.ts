export const MAX_LEVEL = 100;
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
export function channelHalfWidth(plan: LevelPlan, z: number): number {
  return plan.channelWidth + Math.sin(z * .026 + plan.number * .43) * 1.25 + Math.sin(z * .073 + plan.port) * .48;
}
export function clampToChannel(plan: LevelPlan, x: number, z: number, hullRadius = 1.25): number {
  const half = channelHalfWidth(plan, z) - hullRadius;
  return Math.max(-half, Math.min(half, x));
}
export function levelPlan(number: number, port: number): LevelPlan {
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(number)));
  const region = Math.max(0, Math.min(4, Math.floor(port)));
  const tier = (level - 1) / (MAX_LEVEL - 1);
  const channelWidth = 20 - tier * 3.5 - region * .45;
  const rockCount = 4 + Math.floor((level - 1) / 8) + region;
  const sandCount = level < 8 ? 0 : 1 + Math.floor((level - 8) / 14) + Math.floor(region / 2);
  const currentCount = level < 14 ? 0 : 1 + Math.floor((level - 14) / 22) + Math.floor(region / 2);
  const patrolCount = Math.min(10, 2 + Math.floor((level - 1) / 17) + Math.floor(region / 2));
  let weather: Weather = 'clear';
  if (level >= 50 && level % 7 === 0) weather = 'storm';
  else if (level >= 34 && level % 4 === 0) weather = 'fog';
  else if (level >= 25 && level % 3 === 0) weather = 'rain';
  else if (level >= 16 && level % 2 === 0) weather = 'wind';
  const night = level >= 61 && (level % 3 !== 0 || region >= 4);
  const hazards: RouteHazard[] = [];
  for (let i = 0; i < rockCount; i++) {
    const z = 38 + i * 460 / Math.max(rockCount - 1, 1) + (hash(level * 17 + i) - .5) * 14;
    const side = hash(level * 43 + i * 7) > .5 ? 1 : -1;
    const x = side * (3.8 + hash(i * 23 + level) * (channelWidth - 8));
    hazards.push({ x, z, radius: 1.2 + hash(i * 31 + level) * .55, kind: 'rock' });
  }
  for (let i = 0; i < sandCount; i++) {
    const z = 68 + i * 420 / Math.max(sandCount, 1) + (hash(level * 47 + i) - .5) * 19;
    const side = i % 2 ? -1 : 1;
    hazards.push({ x: side * (channelWidth - 4.2 - hash(i * 11 + level) * 2.5), z, radius: 2.15 + tier * .75, kind: 'sandbank' });
  }
  for (let i = 0; i < Math.min(12, 5 + Math.floor(level / 14)); i++) {
    const z = 28 + i * 470 / Math.max(5, 5 + Math.floor(level / 14));
    hazards.push({ x: (i % 2 ? -1 : 1) * (channelWidth - 1.9), z, radius: .55, kind: 'buoy' });
  }
  const currents: CurrentZone[] = Array.from({ length: currentCount }, (_, i) => ({
    x: (i % 2 ? -1 : 1) * (2 + hash(level * 13 + i) * 5),
    z: 92 + i * 365 / Math.max(currentCount, 1) + hash(level * 61 + i) * 28,
    radius: 4.2 + tier * 1.7,
    direction: i % 2 ? -1 : 1,
    strength: 1.6 + tier * 1.8 + region * .2,
  }));
  const patrols: PatrolSlot[] = Array.from({ length: patrolCount }, (_, i) => ({
    x: (i % 2 ? -1 : 1) * (3.7 + hash(level * 7 + i) * 1.5),
    z: 64 + i * 415 / Math.max(patrolCount - 1, 1),
    sound: level >= 26 && (i === Math.floor(patrolCount / 2) || (level >= 55 && i % 4 === 1)),
  }));
  return { number: level, port: region, channelWidth, hazards, currents, patrols, weather, night,
    wind: weather === 'wind' ? 1.3 + tier * 1.7 : weather === 'storm' ? 2.8 + tier * 1.8 : weather === 'rain' ? .55 : 0,
    payoutMultiplier: 1 + Math.floor((level - 1) / 10) * .06,
  };
}
export function currentPush(plan: LevelPlan, x: number, z: number, time: number): number {
  return plan.currents.reduce((force, current) => {
    const distance = Math.hypot(x - current.x, z - current.z);
    const falloff = Math.max(0, 1 - distance / current.radius);
    return force + current.direction * current.strength * falloff * (0.8 + Math.sin(time * 1.3 + current.z) * .2);
  }, 0);
}
export function weatherPush(plan: LevelPlan, time: number): number {
  return plan.wind * (Math.sin(time * .32 + plan.number) * .55 + Math.sin(time * 1.17) * .45);
}
