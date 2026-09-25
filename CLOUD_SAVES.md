# iCloud saves and App Store purchases

Crate Escape does not require an in-game account. The browser keeps its existing local save. On iPhone and iPad, the native app writes the same game progress into Apple's iCloud key-value store when iCloud is available. The local save remains playable offline.

Each installation has its own iCloud key. This keeps one device from silently replacing another device's data during a delayed iCloud sync. When different progress arrives, **Save progress** shows both copies and asks which one to continue with. The choice is remembered for the current versions of those saves; a later update on another device can prompt again.

## Apple Developer setup

1. Enable the **iCloud** capability for the App ID `com.pariah140.crateescape` in Apple Developer/Xcode, selecting **Key-value storage**. The entitlement is already present in `ios/App/App/App.entitlements`.
2. Select the correct signing team in Xcode. Build and test on physical devices signed into the same iCloud account. iCloud key-value storage requires an App Store-distributed app for production use.
3. Test an existing device save migrating to iCloud, an empty second device restoring it, divergent saves requiring a choice, offline play, and delayed sync after reconnecting.
4. The GitHub Pages version intentionally has no iCloud bridge. Its progress stays in that browser; cross-platform progress sharing would require a separate backend.

## Purchases

The native bridge reads StoreKit's verified current entitlements and exposes a user-triggered **Restore purchases** action. No in-app products have been created or sold yet, so there is nothing to unlock until product IDs and purchase screens are designed in App Store Connect. Permanent unlocks can be restored by StoreKit on a new device. Spent currency or other consumables belong in the iCloud game save; StoreKit does not include consumed purchases in current entitlements.

## Technical notes

- Native bridge: `ios/App/App/CrateNativePlugin.swift` and `CrateViewController.swift`.
- Web adapter and save record format: `src/cloud.ts`.
- Existing browser save key stays `crate-escape-save-v1` to retain player progress.
- iCloud key-value storage has a 1 MB total quota. The native bridge rejects an individual save over 64 KB to leave room for multiple devices and future fields.
