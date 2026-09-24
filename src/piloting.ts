export interface Point { x: number; z: number }
export interface Motion extends Point { vx: number; vz: number }

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
  const x = motion.x + vx * dt;
  const z = motion.z + vz * dt;
  return { x, z, vx, vz };
}
