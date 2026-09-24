---
version: alpha
colors:
  primary: "#ff804e"
  sea: "#117b91"
  deepSea: "#0d5260"
  ink: "#103b47"
  paper: "#fff5da"
  orange: "#ff804e"
  yellow: "#ffd85a"
  mint: "#9ae2bf"
typography:
  display:
    fontFamily: "'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif"
  body:
    fontFamily: "'Trebuchet MS', Arial, sans-serif"
  utility:
    fontFamily: "ui-monospace, 'SFMono-Regular', monospace"
rounded:
  panel: "24px"
  button: "14px"
  chip: "999px"
spacing:
  unit: "8px"
components:
  panel:
    backgroundColor: "#fff5da"
  primaryButton:
    backgroundColor: "#ff804e"
---

## Overview

Crate Escape is a playful miniature harbor for short, one-handed runs. Its signature is a live low-poly diorama behind a compact chart-like game interface. The mood is colorful and mischievous, with no real-world law-enforcement insignia.

## Colors

Sea and deepSea own the world. Paper and ink carry readable interface content. Orange marks the next action, yellow marks reward, mint marks safe cargo placement. Red is reserved for danger and invalid placement. CSS custom properties in `src/style.css` implement these values; this document is their durable source.

## Typography

Rounded Trebuchet gives the title a toy-box voice while keeping buttons legible. Monospaced utility text marks run telemetry and labels. Use system fallbacks so the game loads fully offline.

## Layout

On phones, the scene fills the viewport and the current task sits in a scrollable bottom panel. On wider screens, the scene remains prominent and the task panel sits to the right. The HUD stays visible during runs.

## Sailing motion

During a run, open screen space steers directly to the tapped water point; dragging moves the target, and release preserves a little boat inertia. The camera follows the boat beyond the central route. Patrol boats travel through varied turns and loops. A successful run ends with a close view of the boat docking and cargo crossing onto the pier before the result appears.

## Elevation & Depth

The 3D world uses simple directional shadows and layered pastel landforms. UI panels use one dark offset shadow; avoid glass blur and translucent text surfaces.

## Shapes

Rounded rectangular controls echo boat hulls and cargo stickers. Crates use square cells so the packing problem remains clear.

## Components

All actions are buttons. Primary actions are orange, secondary actions are paper with ink outlines. Feedback appears in the same status slot across board, packing, and result screens. Keyboard focus uses a high-contrast yellow outline.

## Do's and Don'ts

Do make the next game action obvious and leave the world visible. Do give a tap alternative to dragging. Do not use dark neon crime imagery, real agencies, or decorative controls without an action.

## Fleet and shipyard

Each boat has a different low poly hull silhouette, cabin equipment, cargo footprint, acceleration and turn rate. Larger hulls move deliberately through turns. The shipyard is a distinct quay scene displaying owned boats at berths. Fleet cards repeat the exact usable cell footprint from the packing view and make speed, handling, condition and prices legible. Boat refits stay with that boat; the workshop and broker's desk benefit the whole fleet.
