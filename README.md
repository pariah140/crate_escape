# Crate Escape

A playable browser MVP of a colorful isometric cargo-packing boat game. Pack a boat's hold, take silly deliveries, steer past rocks and fictional Harbour Patrol, and earn a faster boat.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The game saves progress in local storage. The iOS build bundles all game assets and needs no network connection for gameplay.

## Controls

- **Packing:** select a crate, tap a grid cell to place it, or drag it onto the hold. Rotate with the button or `R`. Tap a placed crate to pick it up.
- **Driving:** tap a spot on the water to move there, or drag across the water to pull the boat in that direction. The boat eases into motion and coasts after release. It stays still until you steer. Arrow keys / WASD also work.
- **Goal:** reach the destination with hull left. A full hold earns a 10% Perfect Pack bonus.

## Build

```sh
npm run check
npm run build
```

The included Capacitor config prepares an iOS wrapper. To generate the native project on a Mac with Xcode:

```sh
npm run ios:sync
npm run ios:open
```

The generated `ios/` project includes original app icon and splash art. Ads, purchases, Game Center, iCloud sync, and App Store submission require production accounts, SDK configuration, and a later release phase.

## Design and scope

The attached game design spec informed the mechanics. This implementation includes two boats, two ports, cargo packing, multiple job types, patrol searchlights, rocks, hull and heat, payouts, upgrades, persistence, sound, and touch/keyboard controls. Art is original procedural Three.js geometry; there are no remote game assets.
