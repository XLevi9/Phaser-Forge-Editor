# Phaser Forge — Roadmap & Progress

> Tujuan akhir: Game engine editor untuk Phaser 4, seperti Phaser Editor berbayar — tapi open source dan terhubung ke workflow ngoding nyata (VS Code + Vite HMR).

**Last updated:** 2026-05-07  
**Current branch:** `feature/game-engine-core`  
**Current version:** v0.1.0

---

## Visi Arsitektur Akhir

```
┌─────────────────── Phaser Forge Editor ───────────────────────┐
│  Toolbar  │  Hierarchy  │   GAME USER RUNNING (iframe)  │ Inspector │
│           │             │                               │           │
│           │  - Barn     │   ┌───────────────────────┐  │  x: 935   │
│           │  - Chicken  │   │  localhost:3000        │  │  y: 115   │
│           │  - Worker   │   │  (Vite dev server)     │  │  ...      │
│           │             │   │  ← game Phaser 4 asli  │  │           │
│           │             │   └───────────────────────┘  │           │
│  [▶ Play] [⏸ Pause]    │   ← Overlay gizmos di atas   │           │
│  [VS Code ↗] [Terminal] │                               │           │
└───────────────────────────────────────────────────────────────┘
```

**Prinsip utama:**
- Viewport = game user yang beneran jalan, bukan placeholder
- Editor inject bridge kecil ke game untuk komunikasi dua arah
- Code tetap di VS Code, perubahan hot-reload langsung di viewport
- Editor handle visual layout, user handle game logic

---

## Status v0.1.0 — ✅ SELESAI

**Core editor shell yang fungsional:**

- [x] Electron + React + Vite + Phaser 4 stack
- [x] Layout: Hierarchy + Viewport (iframe) + Inspector + Asset Browser
- [x] Viewport dengan canvas size yang match game target (dari `.phaser-forge.json`)
- [x] Drag & drop asset dari browser ke viewport
- [x] Tambah primitive shapes (Rectangle, Circle, Triangle) dari hierarchy
- [x] Inspector: x, y, rotation, scaleX/Y, alpha, tint, visible, depth, origin, flip, scroll factor, display size
- [x] Camera pan (middle mouse) + zoom (scroll) + reset (F)
- [x] Canvas boundary visual (area di luar canvas gelap)
- [x] Hierarchy panel: visibility toggle (👁), lock (🔒), rename, duplicate, delete
- [x] Resizable panels: Hierarchy, Inspector, Asset Browser
- [x] Asset Browser: two-panel (folder tree + contents), view modes (list/grid)
- [x] Undo/Redo (Ctrl+Z/Y), Snap to grid
- [x] Save/Load scene ke `forge-scene.json`
- [x] Per-project config `.phaser-forge.json` (canvas size)
- [x] Build: `win-unpacked` executable

**Keterbatasan v0.1:**
- Viewport menampilkan scene editor kita sendiri (bukan game user)
- Tidak ada koneksi ke game Phaser yang sedang running
- Output cuma koordinat di inspector — user masih manual copy ke kode
- Tidak ada Text object, hanya Sprite dan primitives

---

## v0.2 — Live Bridge Architecture

> **Goal:** Editor bisa terhubung ke game Phaser 4 user yang sedang running. Yang terlihat di viewport = game asli, bukan placeholder.

### 0.2.1 — Dev Server Integration
- [ ] Tombol "Run" di toolbar → editor spawn `npm run dev` di project folder
- [ ] Detect port dari output Vite (parse "Local: http://localhost:XXXX")
- [ ] Viewport iframe load `localhost:PORT` (bukan `phaser.html` kita)
- [ ] Terminal panel kecil di editor untuk lihat output dev server
- [ ] Stop dev server saat editor ditutup atau project diganti

### 0.2.2 — Editor Bridge SDK
- [ ] Buat file `phaser-forge-bridge.js` (satu file, ~100 baris)
- [ ] User import bridge ini ke game mereka (satu baris)
- [ ] Bridge protocol via `window.postMessage`:
  - `GET_SCENE_OBJECTS` → bridge scan `scene.children.list` → kirim ke editor
  - `SELECT_OBJECT` → bridge highlight + return full props
  - `SET_PROPERTIES` → bridge update object live
  - `GET_SCENES` → list semua registered scenes
  - `SWITCH_SCENE` → bridge pindah scene aktif

### 0.2.3 — Visual Overlay
- [ ] Overlay canvas transparan di atas iframe (tidak block game input saat play mode)
- [ ] Selection box rendered di overlay (bukan di dalam game)
- [ ] Gizmo handles di overlay (move, rotate, scale)
- [ ] Click detection: overlay detect klik → tanya bridge object apa yang ada di titik itu

### 0.2.4 — VS Code Integration
- [ ] Tombol "Open VS Code" di toolbar → spawn `code [projectFolder]`
- [ ] File watcher → detect perubahan file → Vite HMR sudah handle reload otomatis
- [ ] Status indicator: "Hot reload detected" di editor

---

## v0.3 — Scene System

> **Goal:** Editor bisa manage multiple scenes, bukan cuma satu.

- [ ] Scene list panel (kiri, di atas hierarchy) — list semua scene di project
- [ ] Buat scene baru dari template (blank, platformer, top-down)
- [ ] Switch scene aktif dari editor
- [ ] Scene data stored di `scenes/[name].forge.json`
- [ ] Hierarchy reflect real scene objects dari game (bukan list manual kita)
- [ ] Hierarchy group by layer/depth

---

## v0.4 — Asset & Preload System

> **Goal:** Editor tau tentang asset yang dipakai game, bisa manage preload.

- [ ] Parse `preload()` scene untuk tau key → file mapping
- [ ] Asset browser tampilkan key Phaser (bukan hanya filename)
- [ ] Drag asset ke scene → auto-suggest key yang benar
- [ ] Preload generator: lihat semua asset yang dipakai di scene, generate `preload()` code
- [ ] Atlas/spritesheet support: drag frame dari atlas ke scene

---

## v0.5 — Game Object Types

> **Goal:** Support semua game object Phaser 4 yang umum dipakai.

- [ ] **Image** — `this.add.image()`, lighter dari Sprite
- [ ] **Text** — `this.add.text()`, dengan font, size, style, word wrap
- [ ] **BitmapText** — `this.add.bitmapText()`
- [ ] **TileSprite** — `this.add.tileSprite()`, tiling texture
- [ ] **Graphics** — shapes dengan fill/stroke
- [ ] **Container** — group objects jadi satu parent
- [ ] **Particle Emitter** — visual config emitter

---

## v0.6 — Animation Editor

> **Goal:** Buat dan preview sprite animations secara visual.

- [ ] Pilih spritesheet → lihat semua frames
- [ ] Drag frames untuk buat animation sequence
- [ ] Set frame rate, repeat, yoyo
- [ ] Preview animation live di viewport
- [ ] Export sebagai `this.anims.create({...})` config

---

## v0.7 — Physics Editor

> **Goal:** Config Arcade Physics body secara visual.

- [ ] Toggle physics body on object
- [ ] Visual body shape editor (rect, circle)
- [ ] Set velocity, gravity, bounce, drag
- [ ] Visualize collision zones
- [ ] Export physics config

---

## v0.8 — Prefab System

> **Goal:** Reusable objects seperti Unity prefab.

- [ ] Buat prefab dari object di scene
- [ ] Prefab stored sebagai `.forge-prefab.json`
- [ ] Instantiate prefab di scene (bisa banyak instance)
- [ ] Override properties per instance
- [ ] Prefab library panel

---

## v0.9 — Play Mode

> **Goal:** Run game beneran di dalam editor, bisa pause/inspect.

- [ ] Play button → game jalan normal (remove editor overlay)
- [ ] Pause button → freeze game, editor bisa inspect state
- [ ] Inspector saat pause: lihat live values semua object
- [ ] Step frame (advance satu frame saat pause)
- [ ] Stop → kembali ke edit mode

---

## v1.0 — Stable Release

> **Goal:** Bisa dipakai sehari-hari untuk develop game Phaser 4 serius.

- [ ] Polish semua UI
- [ ] Documentation untuk bridge SDK
- [ ] Project templates (blank, platformer, top-down, idle game)
- [ ] Proper installer (Windows .exe, Mac .dmg, Linux .AppImage)
- [ ] GitHub Release dengan changelog
- [ ] Example projects

---

## Catatan Arsitektur

### Bridge Protocol (postMessage)
```
Editor → Game:                    Game → Editor:
GET_SCENE_OBJECTS                 SCENE_OBJECTS (list + props)
SELECT_OBJECT (id)                OBJECT_SELECTED (full props)
SET_PROPERTIES (id, props)        OBJECT_UPDATED (new props)
GET_SCENES                        SCENES_LIST
SWITCH_SCENE (key)                SCENE_SWITCHED
PAUSE / RESUME                    PAUSED / RESUMED
```

### File Structure per Project Game User
```
my-phaser-game/
  src/
    scenes/
      GameScene.js       ← game logic (user tulis)
      UIScene.js
    main.js
  forge/                 ← folder ini dikelola editor
    scenes/
      GameScene.forge.json
      UIScene.forge.json
    phaser-forge-bridge.js  ← bridge SDK
  assets/
  package.json
  .phaser-forge.json     ← canvas size + project config
```

### Tech yang Mungkin Ditambah
- Monaco Editor (embedded code editor, seperti VS Code di dalam editor)
- Chokidar (file watcher untuk detect perubahan di luar editor)
- Node.js `child_process` (spawn Vite dev server)
- WebSocket (alternatif postMessage untuk komunikasi yang lebih reliable)
