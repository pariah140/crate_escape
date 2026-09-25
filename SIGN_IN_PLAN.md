# Crate Escape sign-in and cloud progress

## Player flow

1. The game opens immediately as a guest. Existing device progress remains in `crate-escape-save-v1`.
2. **Account → Sign in with Apple** uses Apple's native sheet in the iOS app. The browser version uses Apple's web OAuth through Supabase.
3. On first sign-in, device progress is copied to the player's account. If both device and cloud have progress, the player explicitly chooses which copy to keep.
4. Signed-in progress saves locally and syncs to the account. If another device changed the cloud revision, the player is asked to choose; a later save cannot silently overwrite it.
5. Sign-out returns to the untouched guest save. Account deletion removes the user and cloud save (the database foreign key cascades), and clears that account's device save.

## Production setup required

1. Create a Supabase project. Run `supabase/migrations/202609250001_player_saves.sql` in its SQL editor or apply the migration with the Supabase CLI. Deploy `supabase/functions/delete-account` with JWT verification enabled. Keep the service role key exclusively in Supabase's server environment.
2. In Supabase Authentication → Providers, enable Apple. For browser sign-in, create an Apple **Services ID** and configure Apple's Return URL to `https://YOUR_PROJECT.supabase.co/auth/v1/callback`. Set the Services ID first in Supabase's Apple client ID list and add the native bundle ID `com.pariah140.crateescape`. Configure the Apple OAuth secret required by Supabase for web sign-in and rotate it before expiration.
3. In Apple Developer, enable Sign in with Apple on the App ID for `com.pariah140.crateescape`. Register the Services ID and associate it with this App ID. The Xcode project already has `App.entitlements`; choose the correct signing team in Xcode and confirm the entitlement is present in the signed build.
4. In Supabase Authentication → URL Configuration, add `https://pariah140.github.io/crate_escape/` to allowed redirect URLs. Set the production site URL appropriately.
5. Copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are client configuration values, not a service-role key. Add the same two values as build secrets for GitHub Pages deployment. Rebuild and run `npm run ios:sync` before the iOS release.
6. Complete the App Store privacy details: account data, optional email from Apple (which may be a private relay address), and cloud game progress. Provide a privacy policy and support contact. Apple's account-deletion guidance recommends revoking Apple tokens when possible; arrange server-side revocation once the Apple client credentials are provisioned. The in-app deletion flow removes Crate Escape's account and data even if Apple token revocation is not yet configured.

## Release checks

- Guest progress survives an upgrade and remains after sign-out.
- Native Apple sheet works on a signed physical iPhone build; account progress restores on a second device.
- Browser OAuth returns to the GitHub Pages path with a valid session.
- Conflicting saves display both summaries and respect the chosen copy.
- Offline gameplay persists locally; after connectivity returns, **Sync progress** succeeds.
- An account can be deleted in-app, then the same Apple ID can create a fresh account with no old cloud save.
- Database RLS rejects reads and writes for another user's save, and the delete function rejects missing or invalid JWTs.

The code is intentionally configured to leave guest play working when the Supabase values have not been supplied. Sign-in cannot work in production until the external setup above is complete.
