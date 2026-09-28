# iCloud saves and App Store purchases

Crate Escape does not require an in-game account. The browser keeps its existing local save. On iPhone and iPad, the native app writes the same game progress into Apple's iCloud key-value store when iCloud is available. The local save remains playable offline.

Each installation has its own iCloud key. This keeps one device from silently replacing another device's data during a delayed iCloud sync. When different progress arrives, **Save progress** shows both copies and asks which one to continue with. The choice is remembered for the current versions of those saves; a later update on another device can prompt again.

## Apple Developer setup

1. Enable the **iCloud** capability for the App ID `com.pariah140.crateescape` in Apple Developer/Xcode, selecting **Key-value storage**. The entitlement is already present in `ios/App/App/App.entitlements`.
2. Select the correct signing team in Xcode. Build and test on physical devices signed into the same iCloud account. iCloud key-value storage requires an App Store-distributed app for production use.
3. Test an existing device save migrating to iCloud, an empty second device restoring it, divergent saves requiring a choice, offline play, and delayed sync after reconnecting.
4. The GitHub Pages version intentionally has no iCloud bridge. Its progress stays in that browser; cross-platform progress sharing would require a separate backend.

## Chart Token purchases

The iOS app now has a StoreKit 2 purchase flow for three consumable packs. It reads prices from App Store Connect; it does not display a guessed price or show a purchase button when Apple has no product to sell. Create these **Consumable** products in App Store Connect before testing purchases:

| Product ID | Chart Tokens |
| --- | ---: |
| `com.pariah140.crateescape.charttokens30` | 30 |
| `com.pariah140.crateescape.charttokens90` | 90 |
| `com.pariah140.crateescape.charttokens220` | 220 |

Choose and approve the real-money prices in App Store Connect. Chart Tokens can buy a permanent 50% cash discount for one locked harbour or one unowned boat. Harbour charts begin with harbour 3 and cost at least 5 tokens, otherwise one token per $200 of the original outfitting fee, rounded up. Boat charts cost at least 5 tokens, otherwise one per $300 of the original boat price, rounded up. These discounts do not waive any delivery, cargo variety, clean-run or hold requirements, and no boat handling, ability or hold is exclusive to payment. The cost and effect are displayed with a second confirmation before tokens are spent.

The iOS store also supports these **Non-Consumable** products, subject to App Store Connect configuration:

| Product ID | Permanent content |
| --- | --- |
| `com.pariah140.crateescape.welcomeaboard` | Exclusive Harbour Festival boat paint and a once-only grant of 30 Chart Tokens |
| `com.pariah140.crateescape.paint.coral` | Coral Sunset boat paint |
| `com.pariah140.crateescape.paint.moon` | Moonlit Tide boat paint |
| `com.pariah140.crateescape.yard.festival` | Festival Dockyard theme |

Purchased paints recolour the fleet's hulls and sails and add a pennant and accent stripe. The dockyard theme changes its concrete, workshop trim and bunting. Players equip owned looks in the shipyard. StoreKit entitlements determine ownership, while the selected look travels with the existing voyage save. If an entitlement is revoked, the app uses the original look. The Welcome Aboard token grant is recorded by verified transaction ID in the same CloudKit wallet, so restoring or reinstalling does not grant it twice.

The token wallet is one record in the player's **private CloudKit database**, independent of the selectable game save. It records each verified StoreKit transaction ID once, each refunded grant once, and each harbour discount once. Its balance is derived from these records. CloudKit change tags reject a stale write so simultaneous devices reload and retry instead of silently overwriting a spend. The app finishes a consumable StoreKit transaction only after CloudKit confirms the grant. It listens to new and unfinished transactions on launch; an iCloud failure leaves the purchase unfinished for later recovery. Purchasing or spending tokens requires a working iCloud account and network connection. Harbours can still be opened at their full game-cash fee without iCloud. The browser build keeps its free game progress but offers no App Store purchases.

The existing **Restore permanent purchases** button checks StoreKit current entitlements. It does not claim to restore spent consumables. The token wallet follows the player's iCloud account; switching iCloud accounts or deleting that account's app data can make the wallet inaccessible. This client-managed solution is less resistant to a modified app than a server-owned balance. If paid token volume or fraud grows, move the wallet and grant validation to a backend.

### Apple Developer and release setup

1. Enable **iCloud Key-value storage and CloudKit** for `com.pariah140.crateescape`. Register `iCloud.com.pariah140.crateescape` and confirm the Xcode entitlements match the App ID. Configure In-App Purchase for the App ID as well.
2. Create the three consumable and four non-consumable products above in App Store Connect, with localisation, prices and review assets. Sign the build with the correct team. Pick real-money prices only after checking the complete offers in a sandbox build.
3. In the CloudKit development environment, create a wallet by using a sandbox purchase, then deploy the `CrateTokenWallet` record type and `payload` field schema to production before release.
4. Test on two physical iOS devices with the same iCloud account: token packs and Welcome Aboard purchase, cancellation, Ask to Buy, app termination between payment and grant, delayed iCloud access, simultaneous discount attempts, refund, reinstall and recovery. Verify that permanent looks restore, the 30-token bundle grant is counted once, and choosing either voyage save leaves the token wallet unchanged.
5. Submit the IAP products and app together for App Review. Paid tokens are not ready for sale until the signed build and sandbox scenarios pass.

## Technical notes

- Native bridge: `ios/App/App/CrateNativePlugin.swift` and `CrateViewController.swift`.
- Web adapter and save record format: `src/cloud.ts`.
- Existing browser save key stays `crate-escape-save-v1` to retain player progress.
- iCloud key-value storage has a 1 MB total quota. The native bridge rejects an individual save over 64 KB to leave room for multiple devices and future fields.
