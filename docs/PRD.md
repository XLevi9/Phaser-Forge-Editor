# Phaser Forge Editor — PRD

> **Tagline:** Stop guessing coordinates. Just drag it.

**Version:** 1.1.0  
**Status:** Draft  
**Date:** 2026-05-06  
**Author:** Personal project — built for myself first  
**Stack:** Electron + React + TypeScript + Phaser 4  
**AI Tooling:** Claude Code + Gemini CLI  

---

## 1. Why This Exists

Developing games with Phaser 4 means constantly writing numbers blind:

```ts
this.add.sprite(340, 127, 'player').setScale(0.8).setRotation(0.3)
```

Then reload. Wrong. Change 340 to 360. Reload. Still wrong. Repeat 20 times.

This editor exists to fix exactly that. I want to drag a sprite to where it looks right, see its x/y/rotation update live, and move on. That's it. Everything else is secondary.

---

## 2. Core Problem (Personal)

| Pain | How Bad |
|------|---------|
| Positioning sprites by guessing coordinates | 🔴 Daily frustration |
| Adjusting rotation/scale by trial & error | 🔴 Daily frustration |
| No visual overview of what's in a scene | 🟠 Annoying |
| Setting up a new Phaser project from scratch | 🟡 Occasional |
| Managing assets across scenes | 🟡 Occasional |

**The #1 problem is always the same: I can't see what I'm building while I build it.**

---

## 3. Goals

### Must Have (v1 — Core Loop)
- [ ] See my Phaser 4 scene rendered live inside the editor
- [ ] Click to select any game object in the viewport
- [ ] Drag to reposition — x/y updates in real time
- [ ] Rotate and scale via handles or inspector fields
- [ ] See a list of all entities in the scene (hierarchy)
- [ ] Edit properties (x, y, rotation, scaleX, scaleY, alpha, tint) from inspector panel
- [ ] Changes reflect immediately in the viewport without manual reload

### Should Have (v1 — Quality of Life)
- [ ] Undo / Redo (Ctrl+Z / Ctrl+Y) — at least 30 steps
- [ ] Snap to grid toggle
- [ ] Multi-select + move multiple objects at once
- [ ] Basic asset browser (see project images, drag to scene)
- [ ] Code preview: see generated Phaser 4 code for current scene layout

### Nice to Have (v2+)
- [ ] Project templates (blank, platformer, top-down)
- [ ] Physics body inspector (expose velocity, gravity, bounce)
- [ ] Animation preview
- [ ] Tilemap integration (import from Tiled)
- [ ] Plugin system

---

## 4. Non-Goals (v1)

These are explicitly out of scope to keep focus:

- ❌ Visual scripting / node graph
- ❌ Built-in tilemap editor (use Tiled externally)
- ❌ Multiplayer / collaborative editing
- ❌ Support for Phaser 3
- ❌ Mobile app version of the editor
- ❌ App store distribution
- ❌ Fancy onboarding for other users (this is for me first)

---

## 5. Editor Layout

Mirip Unity — panel-based layout:

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar: [Select] [Move] [Rotate] [Scale] | [Play] [Save] │
├──────────────┬──────────────────────────┬───────────────┤
│  Hierarchy   │      Viewport            │  Inspector    │
│              │   (Phaser 4 live render) │               │
│  - Scene     │                          │  x: 340       │
│    - Player  │      [game objects       │  y: 127       │
│    - Ground  │       rendered here]     │  rot: 0.0     │
│    - UI      │                          │  scaleX: 1.0  │
│              │                          │  scaleY: 1.0  │
│              │                          │  alpha: 1.0   │
├──────────────┴──────────────────────────┴───────────────┤
│  Assets: [images] [audio] [tilemaps]                    │
└─────────────────────────────────────────────────────────┘
```

### Panel Breakdown

**Viewport**
- Renders Phaser 4 scene inside Electron WebView / iframe
- Click to select object → highlight with bounding box
- Drag selected object to move
- Transform handles for rotate & scale
- Grid overlay (toggleable)

**Hierarchy**
- Tree list of all game objects in active scene
- Click to select (syncs with viewport)
- Right-click: rename, duplicate, delete
- Drag to reorder / reparent

**Inspector**
- Shows properties of selected object
- Editable fields: x, y, rotation, scaleX, scaleY, alpha, tint, visible, texture
- Any field change → immediate update in viewport
- No save required, live sync

**Asset Browser**
- Lists images/audio in project `/assets` folder
- Thumbnail preview for images
- Drag image onto viewport → creates new Sprite at drop position

---

## 6. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Desktop shell | **Electron** | Cross-platform, proven for editors (VS Code, Figma, Phaser Editor 2 itself) |
| UI Framework | **React + TypeScript** | Familiar, great ecosystem, TypeScript = fewer dumb bugs |
| Build tool | **Vite** | Fast, works great with Phaser 4 |
| Game renderer | **Phaser 4.1.0** | The whole point |
| State | **Zustand** | Lightweight, perfect for editor state |
| UI Components | **Radix UI + Tailwind** | Dark theme, accessible, fast to build |
| File system | **Node.js fs via Electron** | Read/write project files directly |
| Code gen | **Custom** | Generate Phaser Scene class from editor state |
| Packaging | **electron-builder** | Output .exe / .dmg / .AppImage |

> **C++ was considered and rejected.** Electron is what Phaser Editor 2 itself uses. The performance ceiling is more than enough for an editor. C++ would add months of complexity for zero benefit.

---

## 7. How the Editor Communicates with Phaser

The trickiest part. Phaser runs in a WebView/iframe inside Electron. The React UI and Phaser instance communicate via `postMessage`:

```
React UI  ──postMessage──▶  WebView (Phaser 4)
          ◀──postMessage──   WebView (Phaser 4)
```

**Example flow:**
1. User drags sprite in viewport → Phaser updates position → sends `{type: 'OBJECT_MOVED', id, x, y}` to React
2. React updates inspector fields
3. User edits `x` in inspector → React sends `{type: 'SET_POSITION', id, x, y}` to Phaser
4. Phaser moves the object

This is the core technical challenge of M0. Everything else builds on top of it.

---

## 8. Milestones

### M0 — Proof of Concept (2 weeks)
**Goal: Validate the core communication loop works**
- [ ] Electron app with React UI running
- [ ] Phaser 4 scene rendering inside WebView
- [ ] Click object in Phaser → inspector shows its x/y
- [ ] Edit x/y in inspector → object moves in Phaser
- [ ] ✅ If this works, everything else is just building on top

### M1 — Editor Shell (3 weeks)
**Goal: The layout looks and feels like an editor**
- [ ] Full panel layout: Hierarchy + Viewport + Inspector + Asset Browser
- [ ] Dark theme UI
- [ ] Scene hierarchy tree with real game objects
- [ ] Inspector with all basic transform properties
- [ ] Toolbar with tool modes (select, move, rotate, scale)

### M2 — Core Editing Loop (4 weeks)
**Goal: Actually useful for day-to-day Phaser work**
- [ ] Drag object in viewport to move
- [ ] Transform handles (rotate, scale)
- [ ] Click to select, bounding box highlight
- [ ] Multi-select
- [ ] Undo/Redo (30 steps min)
- [ ] Snap to grid
- [ ] Auto-save

### M3 — Asset & Project System (3 weeks)
**Goal: Works with real project files**
- [ ] Open existing Phaser 4 project folder
- [ ] Asset browser reads from `/assets` folder
- [ ] Drag image to scene → creates Sprite
- [ ] Save scene layout back to project file
- [ ] One-click: run dev server in background

### M4 — Code Generation (2 weeks)
**Goal: Editor output is real, usable Phaser 4 code**
- [ ] Generate Phaser 4 Scene class from editor state
- [ ] Code preview panel (Monaco Editor)
- [ ] Export scene → writes `.ts` file to project

### M5 — Personal Daily Driver (ongoing)
**Goal: I actually use this instead of doing things manually**
- [ ] Polish rough edges
- [ ] Fix whatever annoys me during real usage
- [ ] Package as installable app (.exe / .dmg / .AppImage)
- [ ] Put on GitHub (MIT license) — if others find it useful, great

---

## 9. Risks

| Risk | Level | Plan |
|------|-------|------|
| postMessage communication is buggy/slow | 🔴 High | Validate in M0, fail fast |
| Scope creep — always adding features | 🟠 Medium | Strict: finish M2 before touching M3 |
| Phaser 4 API changes break editor | 🟡 Low | Pin to 4.1.0, upgrade intentionally |
| Electron app is too heavy | 🟡 Low | Web app fallback always available |

---

## 10. Definition of Done (Personal)

The editor is "done enough" when:

> I open Phaser Forge, drag my sprites into position, set their rotation and scale visually, and the output just works in my Phaser 4 game — without touching a single coordinate manually.

That's the bar. Everything else is bonus.

---

## Open Questions

- Monaco Editor vs CodeMirror for code preview panel?
- Store scene layout as JSON sidecar file, or embed in Scene `.ts` file as comments?
- Physics inspector in v1 or strictly v2?

---

*This is a living document. Update as the project evolves.*