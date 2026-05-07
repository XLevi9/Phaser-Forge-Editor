import * as Phaser from 'phaser';

const params = new URLSearchParams(window.location.search);
const CANVAS_W = parseInt(params.get('w') ?? '1280');
const CANVAS_H = parseInt(params.get('h') ?? '720');

const ARROW_LEN = 65;
const ROT_RADIUS = 60;
const HANDLE_SZ = 14;

class EditorScene extends Phaser.Scene {
  private sprites: Map<string, Phaser.GameObjects.Sprite> = new Map();

  private selectedSprite: Phaser.GameObjects.Sprite | null = null;
  private selectedId: string | null = null;

  private gridGfx!: Phaser.GameObjects.Graphics;
  private selGfx!: Phaser.GameObjects.Graphics;
  private gizmoGfx!: Phaser.GameObjects.Graphics;

  private hX!: Phaser.GameObjects.Rectangle;
  private hY!: Phaser.GameObjects.Rectangle;
  private hRot!: Phaser.GameObjects.Rectangle;
  private hSX!: Phaser.GameObjects.Rectangle;
  private hSY!: Phaser.GameObjects.Rectangle;

  private toolMode = 'select';
  private snapOn = false;
  private SNAP = 32;
  private lockedIds: Set<string> = new Set();

  // Camera pan state
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panScrollX = 0;
  private panScrollY = 0;

  constructor() { super('EditorScene'); }

  preload() {}

  create() {
    this.cameras.main.setBackgroundColor('#0f1117');

    // ── Canvas boundary ──────────────────────────────────────────────────
    // Dark outer area (outside canvas bounds)
    const outerBg = this.add.graphics().setDepth(-2);
    outerBg.fillStyle(0x060810, 1);
    outerBg.fillRect(-4000, -4000, 8000 + CANVAS_W, 8000 + CANVAS_H);
    // "Erase" the canvas area back to scene bg
    const canvasBg = this.add.graphics().setDepth(-1);
    canvasBg.fillStyle(0x111827, 1);
    canvasBg.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Canvas border
    const border = this.add.graphics().setDepth(0);
    border.lineStyle(1, 0x334155, 1);
    border.strokeRect(0, 0, CANVAS_W, CANVAS_H);
    // Corner ticks
    border.lineStyle(2, 0x475569, 1);
    const tk = 16;
    [[0, 0], [CANVAS_W, 0], [0, CANVAS_H], [CANVAS_W, CANVAS_H]].forEach(([cx, cy]) => {
      const sx = cx === 0 ? 1 : -1;
      const sy = cy === 0 ? 1 : -1;
      border.lineBetween(cx, cy, cx + sx * tk, cy);
      border.lineBetween(cx, cy, cx, cy + sy * tk);
    });

    // ── Grid ─────────────────────────────────────────────────────────────
    this.gridGfx = this.add.graphics().setDepth(0);
    this.drawGrid();

    // ── Selection + gizmo layers ─────────────────────────────────────────
    this.selGfx = this.add.graphics().setDepth(997);
    this.gizmoGfx = this.add.graphics().setDepth(998);

    // ── Gizmo handles ────────────────────────────────────────────────────
    const makeHandle = () => {
      const r = this.add.rectangle(0, 0, HANDLE_SZ, HANDLE_SZ, 0xff0000, 0);
      r.setDepth(999).setVisible(false).setInteractive({ draggable: true });
      return r;
    };
    this.hX = makeHandle();
    this.hY = makeHandle();
    this.hRot = makeHandle();
    this.hSX = makeHandle();
    this.hSY = makeHandle();

    // ── Handle drags ─────────────────────────────────────────────────────
    this.hX.on('drag', (_p: any, dx: number) => {
      if (!this.selectedSprite) return;
      this.selectedSprite.x = this.snap(dx);
      this.notify();
    });
    this.hY.on('drag', (_p: any, _dx: number, dy: number) => {
      if (!this.selectedSprite) return;
      this.selectedSprite.y = this.snap(dy);
      this.notify();
    });
    this.hRot.on('drag', (_p: any, dx: number, dy: number) => {
      if (!this.selectedSprite) return;
      this.selectedSprite.rotation = Math.atan2(
        dy - this.selectedSprite.y,
        dx - this.selectedSprite.x
      ) + Math.PI / 2;
      this.notify();
    });
    this.hSX.on('drag', (_p: any, dx: number) => {
      if (!this.selectedSprite) return;
      const dist = dx - this.selectedSprite.x;
      const base = this.selectedSprite.width / 2 + ARROW_LEN;
      this.selectedSprite.scaleX = Math.max(0.05, dist / base);
      this.notify();
    });
    this.hSY.on('drag', (_p: any, _dx: number, dy: number) => {
      if (!this.selectedSprite) return;
      const dist = this.selectedSprite.y - dy;
      const base = this.selectedSprite.height / 2 + ARROW_LEN;
      this.selectedSprite.scaleY = Math.max(0.05, dist / base);
      this.notify();
    });

    const handles = [this.hX, this.hY, this.hRot, this.hSX, this.hSY];
    handles.forEach(h => h.on('dragend', () => {
      window.parent.postMessage({ type: 'PUSH_HISTORY' }, '*');
    }));

    // ── Sprite drag ──────────────────────────────────────────────────────
    this.input.on('drag', (_p: any, go: Phaser.GameObjects.GameObject, dx: number, dy: number) => {
      if (handles.includes(go as any)) return;
      if (this.toolMode !== 'select' && this.toolMode !== 'move') return;
      if (this.isPanning) return;
      const s = go as Phaser.GameObjects.Sprite;
      const id = this.idOf(s);
      if (!id || this.lockedIds.has(id)) return;
      s.x = this.snap(dx);
      s.y = this.snap(dy);
      window.parent.postMessage({ type: 'OBJECT_TRANSFORMED', id, x: s.x, y: s.y }, '*');
    });

    this.input.on('dragend', (_p: any, go: Phaser.GameObjects.GameObject) => {
      if (!handles.includes(go as any)) {
        window.parent.postMessage({ type: 'PUSH_HISTORY' }, '*');
      }
    });

    // ── Selection via click ──────────────────────────────────────────────
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, gos: Phaser.GameObjects.GameObject[]) => {
      // Middle mouse — start pan
      if (p.middleButtonDown()) {
        this.isPanning = true;
        this.panStartX = p.x;
        this.panStartY = p.y;
        this.panScrollX = this.cameras.main.scrollX;
        this.panScrollY = this.cameras.main.scrollY;
        return;
      }
      const targets = gos.filter(g => !handles.includes(g as any));
      if (targets.length > 0) {
        const spr = targets[0] as Phaser.GameObjects.Sprite;
        const id = this.idOf(spr);
        if (id && !this.lockedIds.has(id)) this.selectSprite(id, spr);
      } else if (gos.length === 0) {
        this.deselect();
      }
    });

    // ── Camera pan (middle mouse move) ───────────────────────────────────
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isPanning) return;
      const cam = this.cameras.main;
      cam.scrollX = this.panScrollX - (p.x - this.panStartX) / cam.zoom;
      cam.scrollY = this.panScrollY - (p.y - this.panStartY) / cam.zoom;
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonReleased()) this.isPanning = false;
    });

    // ── Camera zoom (scroll wheel) ───────────────────────────────────────
    this.input.on('wheel', (_ptr: any, _gos: any, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom * (1 - dy * 0.001), 0.15, 8);
      // Zoom toward mouse position
      const worldBefore = cam.getWorldPoint(_ptr?.x ?? CANVAS_W / 2, _ptr?.y ?? CANVAS_H / 2);
      cam.setZoom(newZoom);
      const worldAfter = cam.getWorldPoint(_ptr?.x ?? CANVAS_W / 2, _ptr?.y ?? CANVAS_H / 2);
      cam.scrollX += worldBefore.x - worldAfter.x;
      cam.scrollY += worldBefore.y - worldAfter.y;
    });

    // ── postMessage from React ───────────────────────────────────────────
    window.addEventListener('message', (ev) => {
      const m = ev.data;
      if (!m?.type) return;

      if (m.type === 'SET_TOOL_MODE') this.toolMode = m.mode;
      if (m.type === 'SET_SNAP') this.snapOn = m.enabled;
      if (m.type === 'SET_LOCKED_IDS') this.lockedIds = new Set(m.ids as string[]);

      if (m.type === 'RESET_CAMERA') {
        this.cameras.main.setScroll(0, 0);
        this.cameras.main.setZoom(1);
      }

      if (m.type === 'SET_PROPERTIES') {
        const s = this.sprites.get(m.id);
        if (!s) return;
        if (m.x !== undefined) s.x = m.x;
        if (m.y !== undefined) s.y = m.y;
        if (m.rotation !== undefined) s.rotation = m.rotation;
        if (m.scaleX !== undefined) s.scaleX = m.scaleX;
        if (m.scaleY !== undefined) s.scaleY = m.scaleY;
        if (m.alpha !== undefined) s.alpha = m.alpha;
        if (m.visible !== undefined) s.visible = m.visible;
        if (m.depth !== undefined) s.setDepth(m.depth);
        if (m.tint !== undefined) s.setTint(parseInt(m.tint.replace('#', ''), 16));
        if (m.originX !== undefined || m.originY !== undefined)
          s.setOrigin(m.originX ?? s.originX, m.originY ?? s.originY);
        if (m.flipX !== undefined || m.flipY !== undefined)
          s.setFlip(m.flipX ?? s.flipX, m.flipY ?? s.flipY);
        if (m.scrollFactorX !== undefined || m.scrollFactorY !== undefined)
          s.setScrollFactor(m.scrollFactorX ?? s.scrollFactorX, m.scrollFactorY ?? s.scrollFactorY);
      }

      if (m.type === 'SELECT_OBJECT') {
        const s = this.sprites.get(m.id);
        if (s) this.selectSprite(m.id, s);
      }
      if (m.type === 'DESELECT_ALL') this.deselect();

      if (m.type === 'DELETE_OBJECT') {
        const s = this.sprites.get(m.id);
        if (s) {
          if (this.selectedSprite === s) this.deselect();
          s.destroy();
          this.sprites.delete(m.id);
        }
      }

      if (m.type === 'DUPLICATE_OBJECT') {
        const src = this.sprites.get(m.id);
        if (src) {
          const copy = this.add.sprite(src.x + 20, src.y + 20, src.texture.key);
          copy.setScale(src.scaleX, src.scaleY).setRotation(src.rotation)
              .setAlpha(src.alpha).setVisible(src.visible)
              .setDepth(src.depth).setTint(src.tintTopLeft)
              .setOrigin(src.originX, src.originY)
              .setFlip(src.flipX, src.flipY)
              .setScrollFactor(src.scrollFactorX, src.scrollFactorY);
          copy.setInteractive({ draggable: true });
          this.sprites.set(m.newId, copy);
          const baseName = m.id.replace(/_copy_\d+$/, '');
          window.parent.postMessage({ type: 'OBJECT_ADDED', id: m.newId, name: `${baseName} Copy`, objType: 'Sprite' }, '*');
        }
      }

      if (m.type === 'RENAME_OBJECT') {
        window.parent.postMessage({ type: 'OBJECT_RENAMED', id: m.id, name: m.name }, '*');
      }

      if (m.type === 'ADD_PRIMITIVE') {
        const shape = m.shape as 'rect' | 'circle' | 'triangle';
        const key = `primitive_${shape}_${Date.now()}`;
        const sz = 64;
        const color = 0xffffff;
        const g = this.add.graphics();
        g.fillStyle(color, 1);
        g.lineStyle(2, 0xffffff, 0.3);
        if (shape === 'rect') {
          g.fillRect(2, 2, sz - 4, sz - 4);
          g.strokeRect(2, 2, sz - 4, sz - 4);
        } else if (shape === 'circle') {
          g.fillCircle(sz / 2, sz / 2, sz / 2 - 2);
          g.strokeCircle(sz / 2, sz / 2, sz / 2 - 2);
        } else if (shape === 'triangle') {
          g.fillTriangle(sz / 2, 2, sz - 2, sz - 2, 2, sz - 2);
          g.strokeTriangle(sz / 2, 2, sz - 2, sz - 2, 2, sz - 2);
        }
        g.generateTexture(key, sz, sz);
        g.destroy();

        const spr = this.add.sprite(CANVAS_W / 2, CANVAS_H / 2, key);
        spr.setInteractive({ draggable: true });
        const id = `${shape}_${Date.now()}`;
        this.sprites.set(id, spr);
        const names: Record<string, string> = { rect: 'Rectangle', circle: 'Circle', triangle: 'Triangle' };
        const types: Record<string, string> = { rect: 'Rect', circle: 'Circle', triangle: 'Triangle' };
        window.parent.postMessage({ type: 'OBJECT_ADDED', id, name: names[shape], objType: types[shape] }, '*');
        this.selectSprite(id, spr);
      }

      if (m.type === 'ADD_SPRITE_FROM_ASSET') {
        const { file, x, y } = m;
        const key = `asset_${file.name}`;
        const doAdd = () => {
          const spr = this.add.sprite(x, y, key);
          spr.setInteractive({ draggable: true });
          const id = `${file.name}_${Date.now()}`;
          this.sprites.set(id, spr);
          window.parent.postMessage({ type: 'OBJECT_ADDED', id, name: file.name, objType: 'Sprite' }, '*');
          this.selectSprite(id, spr);
        };

        if (this.textures.exists(key)) {
          doAdd();
        } else if (file.dataUrl) {
          this.textures.once('addtexture-' + key, doAdd);
          this.textures.addBase64(key, file.dataUrl);
        } else {
          // Placeholder if dataUrl not yet loaded
          const g = this.add.graphics();
          g.fillStyle(0x6366f1, 1);
          g.fillRect(0, 0, 64, 64);
          g.lineStyle(1, 0xa5b4fc, 0.5);
          g.strokeRect(2, 2, 60, 60);
          g.generateTexture(key, 64, 64);
          g.destroy();
          doAdd();
        }
      }
    });

    // Ready — empty scene
    window.parent.postMessage({ type: 'SCENE_READY', hierarchy: [] }, '*');
  }

  // ── Update ────────────────────────────────────────────────────────────
  update() {
    if (!this.selectedSprite) {
      this.selGfx.clear();
      this.gizmoGfx.clear();
      this.hideHandles();
      return;
    }
    this.drawSelection(this.selectedSprite);
    this.drawGizmo(this.selectedSprite);
  }

  // ── Selection box ─────────────────────────────────────────────────────
  private drawSelection(s: Phaser.GameObjects.Sprite) {
    const hw = s.displayWidth / 2 + 5;
    const hh = s.displayHeight / 2 + 5;
    this.selGfx.clear();
    this.selGfx.lineStyle(4, 0x3b82f6, 0.25);
    this.selGfx.strokeRect(s.x - hw - 2, s.y - hh - 2, (hw + 2) * 2, (hh + 2) * 2);
    this.selGfx.lineStyle(1.5, 0x60a5fa, 1);
    this.selGfx.strokeRect(s.x - hw, s.y - hh, hw * 2, hh * 2);
    const hs = 5;
    [[s.x - hw, s.y - hh], [s.x + hw, s.y - hh],
     [s.x - hw, s.y + hh], [s.x + hw, s.y + hh]].forEach(([cx, cy]) => {
      this.selGfx.fillStyle(0xffffff, 1);
      this.selGfx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
      this.selGfx.lineStyle(1, 0x3b82f6, 1);
      this.selGfx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
    });
  }

  // ── Gizmo dispatch ────────────────────────────────────────────────────
  private drawGizmo(s: Phaser.GameObjects.Sprite) {
    this.gizmoGfx.clear();
    this.hideHandles();
    const { x, y } = s;
    const hw = s.displayWidth / 2;
    const hh = s.displayHeight / 2;
    if (this.toolMode === 'select' || this.toolMode === 'move') {
      this.drawMoveGizmo(x, y, hw, hh);
    } else if (this.toolMode === 'rotate') {
      this.drawRotateGizmo(s, x, y, hw, hh);
    } else if (this.toolMode === 'scale') {
      this.drawScaleGizmo(x, y, hw, hh);
    }
  }

  private drawMoveGizmo(x: number, y: number, hw: number, hh: number) {
    const tip = ARROW_LEN;
    this.gizmoGfx.lineStyle(3, 0xff4444, 1);
    this.gizmoGfx.lineBetween(x + hw, y, x + hw + tip, y);
    this.gizmoGfx.fillStyle(0xff4444, 1);
    this.gizmoGfx.fillTriangle(x + hw + tip + 10, y, x + hw + tip - 1, y - 6, x + hw + tip - 1, y + 6);
    this.gizmoGfx.lineStyle(3, 0x44ff44, 1);
    this.gizmoGfx.lineBetween(x, y - hh, x, y - hh - tip);
    this.gizmoGfx.fillStyle(0x44ff44, 1);
    this.gizmoGfx.fillTriangle(x, y - hh - tip - 10, x - 6, y - hh - tip + 1, x + 6, y - hh - tip + 1);
    this.gizmoGfx.fillStyle(0xffffff, 0.9);
    this.gizmoGfx.fillRect(x - 6, y - 6, 12, 12);
    this.gizmoGfx.lineStyle(1.5, 0x888888, 1);
    this.gizmoGfx.strokeRect(x - 6, y - 6, 12, 12);
    this.hX.setPosition(x + hw + tip + 5, y).setVisible(true);
    this.hY.setPosition(x, y - hh - tip - 5).setVisible(true);
  }

  private drawRotateGizmo(s: Phaser.GameObjects.Sprite, x: number, y: number, hw: number, hh: number) {
    const R = ROT_RADIUS + Math.max(hw, hh);
    this.gizmoGfx.lineStyle(2, 0xfbbf24, 0.8);
    this.gizmoGfx.strokeCircle(x, y, R);
    const ang = s.rotation - Math.PI / 2;
    const hx = x + Math.cos(ang) * R;
    const hy = y + Math.sin(ang) * R;
    this.gizmoGfx.lineStyle(1.5, 0xfbbf24, 0.7);
    this.gizmoGfx.lineBetween(x, y, hx, hy);
    this.gizmoGfx.fillStyle(0xfbbf24, 1);
    this.gizmoGfx.fillCircle(hx, hy, 7);
    this.gizmoGfx.lineStyle(2, 0xffffff, 0.9);
    this.gizmoGfx.strokeCircle(hx, hy, 7);
    this.gizmoGfx.fillStyle(0xfbbf24, 0.7);
    this.gizmoGfx.fillCircle(x, y, 4);
    this.hRot.setPosition(hx, hy).setVisible(true);
  }

  private drawScaleGizmo(x: number, y: number, hw: number, hh: number) {
    const tip = ARROW_LEN;
    this.gizmoGfx.lineStyle(3, 0xf97316, 1);
    this.gizmoGfx.lineBetween(x + hw, y, x + hw + tip, y);
    this.gizmoGfx.fillStyle(0xf97316, 1);
    this.gizmoGfx.fillRect(x + hw + tip - 6, y - 6, 12, 12);
    this.gizmoGfx.lineStyle(3, 0x22d3ee, 1);
    this.gizmoGfx.lineBetween(x, y - hh, x, y - hh - tip);
    this.gizmoGfx.fillStyle(0x22d3ee, 1);
    this.gizmoGfx.fillRect(x - 6, y - hh - tip - 6, 12, 12);
    this.gizmoGfx.fillStyle(0xffffff, 0.9);
    this.gizmoGfx.fillRect(x - 6, y - 6, 12, 12);
    this.hSX.setPosition(x + hw + tip, y).setVisible(true);
    this.hSY.setPosition(x, y - hh - tip).setVisible(true);
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  private snap(v: number) {
    return this.snapOn ? Math.round(v / this.SNAP) * this.SNAP : v;
  }
  private hideHandles() {
    [this.hX, this.hY, this.hRot, this.hSX, this.hSY].forEach(h => h.setVisible(false));
  }
  private idOf(spr: Phaser.GameObjects.Sprite): string | null {
    for (const [id, s] of this.sprites) if (s === spr) return id;
    return null;
  }

  private selectSprite(id: string, spr: Phaser.GameObjects.Sprite) {
    this.selectedSprite = spr;
    this.selectedId = id;
    window.parent.postMessage({
      type: 'OBJECT_SELECTED', id,
      x: spr.x, y: spr.y,
      rotation: spr.rotation,
      scaleX: spr.scaleX, scaleY: spr.scaleY,
      alpha: spr.alpha,
      tint: '#' + (spr.tintTopLeft || 0xffffff).toString(16).padStart(6, '0'),
      visible: spr.visible,
      depth: spr.depth,
      originX: spr.originX, originY: spr.originY,
      flipX: spr.flipX, flipY: spr.flipY,
      scrollFactorX: spr.scrollFactorX, scrollFactorY: spr.scrollFactorY,
      texW: spr.width, texH: spr.height,
    }, '*');
  }

  private deselect() {
    this.selectedSprite = null;
    this.selectedId = null;
    window.parent.postMessage({ type: 'OBJECT_DESELECTED' }, '*');
  }

  private notify() {
    if (!this.selectedSprite || !this.selectedId) return;
    const s = this.selectedSprite;
    window.parent.postMessage({
      type: 'OBJECT_TRANSFORMED', id: this.selectedId,
      x: s.x, y: s.y, rotation: s.rotation,
      scaleX: s.scaleX, scaleY: s.scaleY,
    }, '*');
  }

  private drawGrid() {
    const C = 32;
    this.gridGfx.lineStyle(1, 0xffffff, 0.04);
    for (let x = 0; x <= CANVAS_W; x += C) this.gridGfx.lineBetween(x, 0, x, CANVAS_H);
    for (let y = 0; y <= CANVAS_H; y += C) this.gridGfx.lineBetween(0, y, CANVAS_W, y);
    // Center axis
    this.gridGfx.lineStyle(1, 0xffffff, 0.1);
    this.gridGfx.lineBetween(CANVAS_W / 2, 0, CANVAS_W / 2, CANVAS_H);
    this.gridGfx.lineBetween(0, CANVAS_H / 2, CANVAS_W, CANVAS_H / 2);
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game-container',
  width: CANVAS_W,
  height: CANVAS_H,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  transparent: true,
  scene: EditorScene,
});