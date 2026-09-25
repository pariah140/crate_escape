import type { CloudRecord } from './cloud';

export function incomingCloudRecord(records: CloudRecord[], currentDeviceId: string, resolved: Record<string, number>): CloudRecord | null {
  return records
    .filter(record => record.deviceId !== currentDeviceId && (resolved[record.deviceId] ?? 0) < record.savedAt)
    .sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}
