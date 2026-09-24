export interface Point { x: number; z: number }
export interface Motion extends Point { vx: number; vz: number }
export interface Handling { turnRate: number; acceleration: number; coast: number }

export function advanceMotion(
  motion: Motion,
  target: Point | null,
  keys: Point,
  maxSpeed: number,
  dt: number,
  handling: Handling = { turnRate: 3.8, acceleration: 2.7, coast: 1.25 },
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
  const moving = Math.hypot(motion.vx, motion.vz);
  const desired = Math.hypot(desiredVx, desiredVz);
  let vx: number, vz: number;
  if (desired > 0 && moving > 0.03) {
    const heading = Math.atan2(motion.vx, motion.vz);
    const wanted = Math.atan2(desiredVx, desiredVz);
    const difference = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
    const turn = Math.max(-handling.turnRate * dt, Math.min(handling.turnRate * dt, difference));
    const speed = moving + (desired - moving) * Math.min(1, dt * handling.acceleration);
    vx = Math.sin(heading + turn) * speed;
    vz = Math.cos(heading + turn) * speed;
  } else {
    const response = desired > 0 ? handling.acceleration : handling.coast;
    vx = motion.vx + (desiredVx - motion.vx) * Math.min(1, dt * response);
    vz = motion.vz + (desiredVz - motion.vz) * Math.min(1, dt * response);
  }
  if (Math.abs(vx) < 0.03) vx = 0;
  if (Math.abs(vz) < 0.03) vz = 0;
  const x = motion.x + vx * dt;
  const z = motion.z + vz * dt;
  return { x, z, vx, vz };
}
