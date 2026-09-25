/** Bearings on the compass follow the camera view: zero is screen up, positive turns clockwise. */
export function screenBearing(dx: number, dz: number, rightX: number, rightZ: number, upX: number, upZ: number): number {
  return Math.atan2(dx * rightX + dz * rightZ, dx * upX + dz * upZ);
}

export function screenArrow(bearing: number): string {
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  return arrows[((Math.round(bearing / (Math.PI / 4)) % 8) + 8) % 8];
}
