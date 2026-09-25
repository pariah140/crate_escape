import { Capacitor } from '@capacitor/core';
import { AppleSignIn, SignInScope } from '@capawesome/capacitor-apple-sign-in';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { SaveData } from './model';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const accountConfigured = Boolean(url && key);
const client: SupabaseClient | null = accountConfigured ? createClient(url, key, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
}) : null;

export interface CloudSave { save_data: SaveData; revision: number; updated_at: string }

function requireClient(): SupabaseClient {
  if (!client) throw new Error('Account service has not been configured yet.');
  return client;
}

export async function currentUser(): Promise<User | null> {
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error && !navigator.onLine) {
    const cached = await client.auth.getSession();
    return cached.data.session?.user ?? null;
  }
  if (error) return null;
  return data.user;
}

export async function signInWithApple(): Promise<User | null> {
  const auth = requireClient().auth;
  if (Capacitor.getPlatform() === 'ios') {
    const random = crypto.getRandomValues(new Uint8Array(32));
    const nonce = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
    const hashedNonce = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    const apple = await AppleSignIn.signIn({ scopes: [SignInScope.Email, SignInScope.FullName], nonce: hashedNonce });
    if (!apple.idToken) throw new Error('Apple did not return an identity token.');
    const { data, error } = await auth.signInWithIdToken({ provider: 'apple', token: apple.idToken, nonce });
    if (error) throw error;
    const name = [apple.givenName, apple.familyName].filter(Boolean).join(' ');
    if (name && !data.user?.user_metadata?.full_name) await auth.updateUser({ data: { full_name: name } });
    return data.user;
  }
  const redirectTo = `${location.origin}${location.pathname}`;
  const { error } = await auth.signInWithOAuth({ provider: 'apple', options: { redirectTo } });
  if (error) throw error;
  return null; // Browser navigation completes OAuth; startup restores the session.
}

export async function signOut(): Promise<void> {
  const { error } = await requireClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function fetchCloudSave(userId: string): Promise<CloudSave | null> {
  const { data, error } = await requireClient().from('player_saves').select('save_data,revision,updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as CloudSave | null;
}

export async function writeCloudSave(userId: string, save: SaveData, expectedRevision: number | null): Promise<number> {
  const table = requireClient().from('player_saves');
  if (expectedRevision === null) {
    const { error } = await table.insert({ user_id: userId, save_data: save, revision: 1 });
    if (error) throw error;
    return 1;
  }
  const { data, error } = await table.update({ save_data: save, revision: expectedRevision + 1, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('revision', expectedRevision).select('revision').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Cloud save changed on another device. Choose which progress to keep.');
  return data.revision;
}

export async function deleteAccount(): Promise<void> {
  const { error } = await requireClient().functions.invoke('delete-account', { body: {} });
  if (error) throw error;
  await requireClient().auth.signOut({ scope: 'local' }).catch(() => undefined);
}
