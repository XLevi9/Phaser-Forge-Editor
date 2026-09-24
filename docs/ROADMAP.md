# Phaser Forge — Roadmap & Progress

> Tujuan akhir: Game engine editor untuk Phaser 4, seperti Phaser Editor berbayar — tapi open source dan terhubung ke workflow ngoding nyata (VS Code + Vite HMR).

**Last updated:** 2026-09-24  
**Current branch:** `feature/game-engine-core`  
**Current version:** v0.2.3-dev

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

### 0.2.1 — Dev Server Integration ✅ SELESAI
- [x] Tombol "Run" di toolbar → editor spawn `npm run dev` di project folder
- [x] Detect port dari output Vite — strip ANSI codes sebelum regex match
- [x] Viewport iframe switch ke `localhost:PORT` saat server ready
- [x] Console tab di footer — stream output dev server real-time dengan auto-scroll
- [x] Stop dev server (button + saat app quit) — kill seluruh process tree (`taskkill /T` di Windows, process group di macOS/Linux)
- [x] Pilih dev script dari `package.json` (`dev`, `dev:*`, `*:dev:*`), tersimpan di `.phaser-forge.json`
- [x] LIVE badge di viewport saat game berjalan
- [x] VS Code button — `code [projectFolder]`
- [x] `webSecurity: false` agar iframe bisa load localhost dari file:// protocol

### 0.2.2 — Editor Bridge SDK ✅ SELESAI
> Agar editor bisa "baca" dan "kontrol" object dari game Phaser yang running.
- [x] `src/bridge/phaser-forge-bridge.js` — satu file yang di-copy ke project (tombol Install Bridge)
- [x] Bridge scan `scene.children.list` saat diminta
- [x] Protocol postMessage dua arah (lihat Catatan Arsitektur)
- [x] Hierarchy panel populate dari data bridge
- [x] Inspector terhubung ke object game asli (x, y, rotation, scale, alpha, depth, visible)
- [x] Bridge v0.3: `installForgeBridge(game)` (tanpa perlu `window.game`), laporan `hasGame` + petunjuk di hierarchy, Install Bridge mencetak baris import yang tepat dari entry di `index.html`, plus `.d.ts` untuk project TypeScript
- [ ] `SWITCH_SCENE` — pindah scene aktif di game (sekarang hanya bisa melihat object scene lain)

### 0.2.3 — Visual Overlay ✅ SELESAI
> Gizmos di atas game yang running — bukan di dalam game.
- [x] Overlay DOM transparan di atas iframe game, toggle 🎯 Edit / 🎮 Play
- [x] Click di overlay → bridge hit-test (depth + urutan display list) → select
- [x] Selection box di overlay, refresh tiap 500ms mengikuti object yang bergerak
- [x] Drag object terpilih di overlay → `FORGE_MOVE_OBJECT`

### 0.2.4 — Scene Awareness
- [x] Editor tau scene mana yang aktif (dropdown scene di hierarchy)
- [ ] Switch scene dari hierarchy
- [ ] Hierarchy refresh otomatis saat scene berubah (scene-transition aware)
- [ ] Rotate/scale gizmo di live mode
- [ ] Tulis perubahan live kembali ke kode / scene file

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

### Bridge Protocol (postMessage, semua pesan membawa `forge: true`)
```
Editor → Game:                                  Game → Editor:
FORGE_PING                                      FORGE_PONG / FORGE_READY (saat load)
FORGE_GET_SCENES                                FORGE_SCENES (key, active, visible)
FORGE_GET_OBJECTS (sceneKey)                    FORGE_OBJECTS (list + props)
FORGE_SELECT (id)                               FORGE_SELECTED (props + screenBounds)
FORGE_PICK_OBJECT (viewportX, viewportY)        FORGE_SELECTED / FORGE_DESELECTED
FORGE_SET_PROP (id, prop, value)                FORGE_PROP_SET (props + screenBounds)
FORGE_MOVE_OBJECT (id, startX/Y, dx, dy)        FORGE_SELECTED (reason: move)
```
Belum ada: `SWITCH_SCENE`, `PAUSE` / `RESUME`.

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
