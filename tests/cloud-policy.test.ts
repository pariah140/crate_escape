import test from 'node:test';
import assert from 'node:assert/strict';
import { incomingCloudRecord } from '../src/cloud-policy';
import { defaultSave } from '../src/model';

test('iCloud comparison ignores this device and already resolved versions', () => {
  const own = { deviceId: 'own', savedAt: 12, save: defaultSave() };
  const older = { deviceId: 'other', savedAt: 10, save: defaultSave() };
  const newer = { deviceId: 'third', savedAt: 13, save: defaultSave() };
  assert.equal(incomingCloudRecord([own, older, newer], 'own', {})?.deviceId, 'third');
  assert.equal(incomingCloudRecord([own, older, newer], 'own', { third: 13 })?.deviceId, 'other');
  assert.equal(incomingCloudRecord([own, older, newer], 'own', { third: 13, other: 10 }), null);
  assert.equal(incomingCloudRecord([own, older, { ...newer, savedAt: 14 }], 'own', { third: 13, other: 10 })?.savedAt, 14);
});
