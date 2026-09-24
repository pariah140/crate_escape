export interface PatrolPose { x: number; z: number; heading: number }

export function patrolPose(index: number, time: number, baseX: number, baseZ: number, phase: number): PatrolPose {
  const angle = time * (0.53 + index * 0.025) + phase;
  let x: number; let z: number; let vx: number; let vz: number;
  if (index % 3 === 0) {
    // Long, shallow turns carry this boat across the channel.
    x = baseX + Math.sin(angle) * 5.2;
    z = baseZ + Math.sin(angle * 2) * 1.1;
    vx = Math.cos(angle) * 5.2;
    vz = Math.cos(angle * 2) * 2.2;
  } else if (index % 3 === 1) {
    // This boat runs up and down with a small sideways turn at each end.
    x = baseX + Math.sin(angle * 2) * 1.4;
    z = baseZ + Math.sin(angle) * 8.5;
    vx = Math.cos(angle * 2) * 2.8;
    vz = Math.cos(angle) * 8.5;
  } else {
    // A broader oval lets the remaining boats circle an area.
    x = baseX + Math.cos(angle) * 3.7;
    z = baseZ + Math.sin(angle) * 5.2;
    vx = -Math.sin(angle) * 3.7;
    vz = Math.cos(angle) * 5.2;
  }
  return { x, z, heading: Math.atan2(vx, vz) };
}
