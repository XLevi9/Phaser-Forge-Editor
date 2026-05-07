# ⚡ Phaser Forge Editor

> Stop guessing coordinates. Just drag it.

A visual scene editor for **Phaser 4** games, built with Electron + React. Drag sprites into position, tweak properties in the inspector, and read the values directly into your game code — no more trial-and-error reloading.

![Status](https://img.shields.io/badge/status-early%20development-orange)
![Phaser](https://img.shields.io/badge/Phaser-4.x-blue)
![Electron](https://img.shields.io/badge/Electron-latest-teal)

---

## Why

Developing with Phaser 4 means writing coordinates blind:

```ts
this.add.sprite(340, 127, 'player').setScale(0.8).setRotation(0.3)
```

Then reload. Wrong. Change 340 to 360. Reload. Still wrong. Repeat 20 times.

Phaser Forge lets you drag that sprite to where it looks right, see the numbers update live, and move on.

---

## Features

- **Visual viewport** — Phaser 4 scene rendered at your game's exact canvas resolution (e.g. 1280×720). What you see = what you get.
- **Click to select** — bounding box + gizmo handles appear on selected objects
- **Tool modes** — Select · Move · Rotate · Scale (Q/W/E/R)
- **Inspector** — edit x, y, rotation, scaleX/Y, alpha, tint, visible, depth, originX/Y with live feedback
- **Origin presets** — 9-point grid (TL/TC/TR/CL/C/CR/BL/BC/BR) so origin always matches your game
- **Asset browser** — scan your project's `/assets` folder, drag images onto the viewport
- **Camera pan/zoom** — middle mouse to pan, scroll wheel to zoom toward cursor, F to reset
- **Hierarchy panel** — list of all scene objects, click to select, right-click for rename/duplicate/delete
- **Undo/Redo** — Ctrl+Z / Ctrl+Y, 30+ steps
- **Snap to grid** — toggleable 32px snap
- **Per-project config** — canvas size saved to `.phaser-forge.json` so each project remembers its setup

---

## How It Works

The editor and your game are **separate**. The editor is a design tool — you place objects visually, read the coordinates from the inspector, and write them into your game code.

```
Editor viewport (1280×720 canvas)
  → drag sprite to x=935, y=115
  → inspector shows: x: 935, y: 115, originX: 0.5

Your game code:
  this.add.image(935, 115, 'barn').setOrigin(0.5);  ← exact match ✅
```

No plugins or modifications needed in your game project.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Phaser 4 game project (for the asset browser and coordinate reference)

### Install & Run

```bash
git clone https://github.com/XLevi9/Phaser-Forge-Editor.git
cd Phaser-Forge-Editor
npm install
npm run dev
```

### Open a Project

1. Click **📁 Open Project** in the toolbar
2. Select your Phaser 4 project folder
3. Enter your game's canvas size (e.g. `1280 × 720`) — saved to `.phaser-forge.json` for next time
4. Drag assets from the **Assets** panel onto the viewport

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Desktop shell | Electron |
| UI | React + TypeScript + Tailwind |
| Build | Vite (via electron-vite) |
| Game renderer | Phaser 4 (in iframe) |
| State | Zustand |
| Communication | `postMessage` (React ↔ Phaser iframe) |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Q` | Select tool |
| `W` | Move tool |
| `E` | Rotate tool |
| `R` | Scale tool |
| `F` | Reset camera view |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Del` | Delete selected object |
| `Esc` | Deselect |
| Middle mouse | Pan camera |
| Scroll wheel | Zoom camera |

---

## Roadmap

- [ ] Save / load scene as JSON
- [ ] Code generation — export scene as Phaser 4 `create()` function
- [ ] Multi-select
- [ ] Flip X/Y, setCrop, setDisplaySize in inspector
- [ ] Connect to running game dev server (live bridge)
- [ ] Package as installable app (.exe / .dmg / .AppImage)

---

## License

MIT — built for personal use first, open to whoever finds it useful.
