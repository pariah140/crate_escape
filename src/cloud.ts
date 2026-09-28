import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { parseSave, type SaveData } from './model';

export interface CloudRecord { deviceId: string; savedAt: number; save: SaveData }
export interface TokenWallet { balance: number; discountedHarbors: number[] }
export interface TokenProduct { id: string; amount: number; price: string }
interface NativeCloudRow { key: string; value: string }
interface NativeCloudPlugin {
  readCloud(): Promise<{ available: boolean; records: NativeCloudRow[] }>;
  writeCloud(options: { deviceId: string; value: string }): Promise<void>;
  currentEntitlements(): Promise<{ productIds: string[] }>;
  restorePurchases(): Promise<{ productIds: string[] }>;
  tokenProducts(): Promise<{ products: TokenProduct[] }>;
  tokenWallet(): Promise<TokenWallet>;
  purchaseTokens(options: { productId: string }): Promise<{ status: 'purchased' | 'pending' | 'cancelled'; wallet?: TokenWallet }>;
  discountHarbor(options: { harbor: number }): Promise<{ wallet: TokenWallet }>;
  addListener(eventName: 'cloudChanged', listener: (event: { quotaExceeded: boolean }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'tokenWalletChanged', listener: (wallet: TokenWallet) => void): Promise<PluginListenerHandle>;
}

const native = registerPlugin<NativeCloudPlugin>('CrateNative');
export const cloudSupported = Capacitor.getPlatform() === 'ios';

export function cloudDeviceId(): string {
  const key = 'crate-escape-device-id-v1';
  try {
    const previous = localStorage.getItem(key);
    if (previous) return previous;
    const next = crypto.randomUUID(); localStorage.setItem(key, next); return next;
  } catch { return crypto.randomUUID(); }
}

function decodeRecord(row: NativeCloudRow): CloudRecord | null {
  try {
    const parsed = JSON.parse(row.value) as CloudRecord;
    if (!parsed || typeof parsed.deviceId !== 'string' || !Number.isFinite(parsed.savedAt)
      || !parsed.save || !Number.isFinite(parsed.save.cash) || !Number.isFinite(parsed.save.runs)
      || !Array.isArray(parsed.save.ownedBoats)) return null;
    return { ...parsed, save: parseSave(parsed.save) };
  } catch { return null; }
}

export async function readCloud(): Promise<{ available: boolean; records: CloudRecord[] }> {
  if (!cloudSupported) return { available: false, records: [] };
  const result = await native.readCloud();
  return { available: result.available, records: result.records.map(decodeRecord).filter((item): item is CloudRecord => item !== null) };
}

export async function writeCloudSave(deviceId: string, save: SaveData): Promise<void> {
  if (!cloudSupported) return;
  const record: CloudRecord = { deviceId, savedAt: Date.now(), save: structuredClone(save) };
  await native.writeCloud({ deviceId, value: JSON.stringify(record) });
}

export async function watchCloud(onChange: (event: { quotaExceeded: boolean }) => void): Promise<PluginListenerHandle | null> {
  if (!cloudSupported) return null;
  return native.addListener('cloudChanged', onChange);
}

export async function currentEntitlements(): Promise<string[]> {
  if (!cloudSupported) return [];
  return (await native.currentEntitlements()).productIds;
}

export async function restorePurchases(): Promise<string[]> {
  if (!cloudSupported) return [];
  return (await native.restorePurchases()).productIds;
}

export async function readTokenProducts(): Promise<TokenProduct[]> {
  if (!cloudSupported) return [];
  return (await native.tokenProducts()).products;
}

export async function readTokenWallet(): Promise<TokenWallet> {
  if (!cloudSupported) throw new Error('Chart Tokens are available in the iOS app.');
  return native.tokenWallet();
}

export async function purchaseTokenPack(productId: string): Promise<{ status: 'purchased' | 'pending' | 'cancelled'; wallet?: TokenWallet }> {
  if (!cloudSupported) throw new Error('Chart Tokens are available in the iOS app.');
  return native.purchaseTokens({ productId });
}

export async function buyHarborDiscount(harbor: number): Promise<TokenWallet> {
  if (!cloudSupported) throw new Error('Chart Tokens are available in the iOS app.');
  return (await native.discountHarbor({ harbor })).wallet;
}

export async function watchTokenWallet(onChange: (wallet: TokenWallet) => void): Promise<PluginListenerHandle | null> {
  if (!cloudSupported) return null;
  return native.addListener('tokenWalletChanged', onChange);
}
