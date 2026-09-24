export interface Point { x: number; z: number }
export interface Motion extends Point { vx: number; vz: number }
export const SAILING_BOUNDS = { minX: -11.5, maxX: 11.5, minZ: -8, maxZ: 520 } as const;

export function clampSailingPoint(point: Point): Point {
  return {
    x: Math.max(SAILING_BOUNDS.minX, Math.min(SAILING_BOUNDS.maxX, point.x)),
    z: Math.max(SAILING_BOUNDS.minZ, Math.min(SAILING_BOUNDS.maxZ, point.z)),
  };
}

export function advanceMotion(
  motion: Motion,
  target: Point | null,
  keys: Point,
  maxSpeed: number,
  dt: number,
): Motion {
  let desiredVx = 0;
  let desiredVz = 0;
  const keyLength = Math.hypot(keys.x, keys.z);
  if (target) {
    const dx = target.x - motion.x;
    const dz = target.z - motion.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.05) {
      const speed = Math.min(maxSpeed, Math.max(0, (distance - 0.35) * 1.25));
      desiredVx = dx / distance * speed;
      desiredVz = dz / distance * speed;
    }
  } else if (keyLength) {
    desiredVx = keys.x / keyLength * maxSpeed;
    desiredVz = keys.z / keyLength * maxSpeed;
  }
  const response = target || keyLength ? 2.7 : 1.25;
  let vx = motion.vx + (desiredVx - motion.vx) * Math.min(1, dt * response);
  let vz = motion.vz + (desiredVz - motion.vz) * Math.min(1, dt * response);
  if (Math.abs(vx) < 0.03) vx = 0;
  if (Math.abs(vz) < 0.03) vz = 0;
  const { x, z } = clampSailingPoint({ x: motion.x + vx * dt, z: motion.z + vz * dt });
  if (x === SAILING_BOUNDS.minX || x === SAILING_BOUNDS.maxX) vx = 0;
  if (z === SAILING_BOUNDS.minZ || z === SAILING_BOUNDS.maxZ) vz = 0;
  return { x, z, vx, vz };
}
