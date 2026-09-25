import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { screenArrow, screenBearing } from '../src/navigation';

test('view compass follows the angled camera rather than treating map north as screen up', () => {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 200);
  camera.position.set(16, 31, -14);
  camera.lookAt(0, 0, 5);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const bearing = (dx: number, dz: number) => screenBearing(dx, dz, right.x, right.z, up.x, up.z);
  assert.notEqual(screenArrow(bearing(0, 1)), '↑');

  // Solve the camera's ground-plane axes for a movement seen down and to the right.
  const determinant = right.x * up.z - right.z * up.x;
  const dx = (up.z + right.z) / determinant;
  const dz = (-right.x - up.x) / determinant;
  assert.equal(screenArrow(bearing(dx, dz)), '↘');
  assert.equal(screenArrow(bearing(-dx, -dz)), '↖');
});
