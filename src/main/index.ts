import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

let mainWin: BrowserWindow | null = null;
let devProc: ChildProcess | null = null;

function createWindow(): void {
  mainWin = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false, // allows iframe to load localhost game URLs
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f1117',
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWin.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWin.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // ── dialog: open folder ──────────────────────────────────────────────────
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Phaser Project Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── dev server: start ────────────────────────────────────────────────────
  ipcMain.handle('devserver:start', async (_e, folder: string) => {
    if (devProc) { devProc.kill(); devProc = null; }

    // Strip ANSI escape codes for clean display and regex matching
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*[mGKHF]/g, '');

    return new Promise<{ ok: boolean; url?: string; error?: string }>(resolve => {
      let resolved = false;

      devProc = spawn('npm', ['run', 'dev'], { cwd: folder, shell: true });

      const handleData = (data: Buffer) => {
        const clean = stripAnsi(data.toString());
        mainWin?.webContents.send('devserver:output', clean);

        if (!resolved) {
          const m = clean.match(/https?:\/\/localhost:(\d+)/);
          if (m) {
            const url = `http://localhost:${m[1]}`;
            resolved = true;
            resolve({ ok: true, url });
          }
        }
      };

      devProc.stdout?.on('data', handleData);
      devProc.stderr?.on('data', handleData);

      devProc.on('error', err => {
        if (!resolved) { resolved = true; resolve({ ok: false, error: err.message }); }
      });

      devProc.on('exit', code => {
        devProc = null;
        mainWin?.webContents.send('devserver:output', `\n[Dev server exited — code ${code}]\n`);
        mainWin?.webContents.send('devserver:stopped');
      });

      setTimeout(() => {
        if (!resolved) { resolved = true; resolve({ ok: false, error: 'Timeout (30s) — dev server URL not detected.' }); }
      }, 30000);
    });
  });

  // ── dev server: stop ─────────────────────────────────────────────────────
  ipcMain.handle('devserver:stop', () => {
    if (devProc) { devProc.kill(); devProc = null; }
    return { ok: true };
  });

  // ── VS Code: open folder ─────────────────────────────────────────────────
  ipcMain.handle('vscode:open', (_e, folder: string) => {
    exec(`code "${folder}"`);
  });

  // ── Bridge: install phaser-forge-bridge.js to project ───────────────────
  ipcMain.handle('bridge:install', async (_e, folder: string) => {
    const bridgeCode = `// phaser-forge-bridge.js — Phaser Forge Editor Bridge v0.2
// Add to your game entry point:  import './phaser-forge-bridge.js'
// Docs: github.com/XLevi9/Phaser-Forge-Editor

if (window.parent !== window) {
  let _idCounter = 0;
  const _objMap = new Map();

  function ensureId(obj) {
    if (!obj.__forgeId) {
      obj.__forgeId = 'forge_' + (_idCounter++);
      _objMap.set(obj.__forgeId, obj);
    }
    return obj.__forgeId;
  }

  function getProps(obj) {
    const p = {
      id: ensureId(obj),
      name: obj.name || '',
      type: obj.type || obj.constructor?.name || 'Unknown',
      x: obj.x ?? 0, y: obj.y ?? 0,
      rotation: obj.rotation ?? 0,
      scaleX: obj.scaleX ?? 1, scaleY: obj.scaleY ?? 1,
      alpha: obj.alpha ?? 1,
      visible: obj.visible ?? true,
      depth: obj.depth ?? 0,
      originX: obj.originX ?? 0.5, originY: obj.originY ?? 0.5,
    };
    if (obj.texture?.key && obj.texture.key !== '__DEFAULT' && obj.texture.key !== '__MISSING')
      p.textureKey = obj.texture.key;
    if (typeof obj.text === 'string') p.text = obj.text;
    if (obj.displayWidth) p.displayWidth = Math.round(obj.displayWidth);
    if (obj.displayHeight) p.displayHeight = Math.round(obj.displayHeight);
    return p;
  }

  function getGame() {
    return window.game || window.__phaserGame ||
      Object.values(window).find(v => v?.constructor?.name === 'Game');
  }

  function getBounds(obj) {
    // Fallback: center-based bounds from display size
    const dw = obj.displayWidth ?? obj.width ?? 32;
    const dh = obj.displayHeight ?? obj.height ?? 32;
    const ox = obj.originX ?? 0.5;
    const oy = obj.originY ?? 0.5;
    let bounds = { x: (obj.x ?? 0) - dw * ox, y: (obj.y ?? 0) - dh * oy, width: dw, height: dh };
    try { const b = obj.getBounds?.(); if (b && b.width > 0) bounds = b; } catch (_) {}
    return bounds;
  }

  function getScreenBounds(scene, bounds) {
    const canvas = scene?.game?.canvas;
    const cam = scene?.cameras?.main;
    if (!canvas || !cam) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    const x = (bounds.x - cam.scrollX) * cam.zoom;
    const y = (bounds.y - cam.scrollY) * cam.zoom;
    const width = bounds.width * cam.zoom;
    const height = bounds.height * cam.zoom;
    return {
      x: rect.left + x * scaleX,
      y: rect.top + y * scaleY,
      width: width * scaleX,
      height: height * scaleY,
    };
  }

  function sendSelected(scene, obj) {
    const bounds = getBounds(obj);
    window.parent.postMessage({
      forge: true,
      type: 'FORGE_SELECTED',
      id: ensureId(obj),
      props: getProps(obj),
      bounds,
      screenBounds: getScreenBounds(scene, bounds),
    }, '*');
  }

  function pickObject(scene, gameX, gameY) {
    const cam = scene.cameras?.main;
    const point = cam?.getWorldPoint ? cam.getWorldPoint(gameX, gameY) : { x: gameX, y: gameY };
    const list = scene.children?.list ?? [];
    const objects = list
      .filter(obj => !obj.__forgeInternal && obj.active !== false && obj.visible !== false)
      .slice()
      .sort((a, b) => ((b.depth ?? 0) - (a.depth ?? 0)) || (list.indexOf(b) - list.indexOf(a)));
    return objects.find(obj => {
      const b = getBounds(obj);
      return point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height;
    });
  }

  window.addEventListener('message', (ev) => {
    if (!ev.data?.forge) return;
    const m = ev.data;
    const game = getGame();

    if (m.type === 'FORGE_PING') {
      window.parent.postMessage({ forge: true, type: 'FORGE_PONG', version: '0.2' }, '*');
    }

    if (m.type === 'FORGE_GET_SCENES') {
      if (!game) return;
      const scenes = game.scene.scenes
        .filter(s => s.sys.settings.status > 0)
        .map(s => ({
          key: s.sys.settings.key,
          active: s.sys.isActive(),
          visible: s.sys.isVisible(),
        }));
      window.parent.postMessage({ forge: true, type: 'FORGE_SCENES', scenes }, '*');
    }

    if (m.type === 'FORGE_GET_OBJECTS') {
      if (!game) return;
      const scene = game.scene.getScene(m.sceneKey);
      if (!scene) return;
      const objects = scene.children.list
        .filter(obj => !obj.__forgeInternal && obj.active !== false)
        .map(getProps);
      window.parent.postMessage({ forge: true, type: 'FORGE_OBJECTS', sceneKey: m.sceneKey, objects }, '*');
    }

    if (m.type === 'FORGE_SET_PROP') {
      const obj = _objMap.get(m.id);
      if (!obj) return;
      const v = m.value;
      const prop = m.prop;
      if (prop === 'x')        obj.x = v;
      else if (prop === 'y')   obj.y = v;
      else if (prop === 'rotation') obj.rotation = v;
      else if (prop === 'scaleX')   obj.scaleX = v;
      else if (prop === 'scaleY')   obj.scaleY = v;
      else if (prop === 'alpha')    obj.alpha = v;
      else if (prop === 'visible')  obj.visible = v;
      else if (prop === 'depth')    obj.setDepth?.(v);
      window.parent.postMessage({ forge: true, type: 'FORGE_PROP_SET', id: m.id, prop, value: v }, '*');
    }

    if (m.type === 'FORGE_SELECT') {
      const obj = _objMap.get(m.id);
      if (!obj) return;
      sendSelected(obj.scene, obj);
    }

    if (m.type === 'FORGE_PICK_OBJECT') {
      if (!game) return;
      const canvas = game.canvas;
      const rect = canvas.getBoundingClientRect();
      const gameX = (m.viewportX - rect.left) * (canvas.width / rect.width);
      const gameY = (m.viewportY - rect.top) * (canvas.height / rect.height);
      const preferred = m.sceneKey ? game.scene.getScene(m.sceneKey) : null;
      const scenes = [
        preferred,
        ...game.scene.scenes.filter(s => s !== preferred && s.sys?.isActive?.() && s.sys?.isVisible?.()),
      ].filter(Boolean);
      const picked = scenes
        .map(scene => ({ scene, hit: pickObject(scene, gameX, gameY) }))
        .find(r => r.hit);
      if (picked) sendSelected(picked.scene, picked.hit);
      else window.parent.postMessage({ forge: true, type: 'FORGE_DESELECTED' }, '*');
    }
  });

  // Announce when ready
  const _announce = () => window.parent.postMessage({ forge: true, type: 'FORGE_READY' }, '*');
  if (document.readyState === 'complete') setTimeout(_announce, 800);
  else window.addEventListener('load', () => setTimeout(_announce, 800));
}
`;
    try {
      fs.writeFileSync(path.join(folder, 'phaser-forge-bridge.js'), bridgeCode);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

  // ── fs: scan assets ───────────────────────────────────────────────────────
  ipcMain.handle('fs:readAssets', async (_e, folderPath: string) => {
    const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    function scanDir(dir: string, base: string): any[] {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const results: any[] = [];
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(base, fullPath).replace(/\\/g, '/');
          if (entry.isDirectory()) {
            const children = scanDir(fullPath, base);
            if (children.length > 0) results.push({ name: entry.name, type: 'folder', path: relPath, children });
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (IMAGE_EXTS.includes(ext)) results.push({ name: entry.name, type: 'file', path: relPath, fullPath, ext });
          }
        }
        return results;
      } catch { return []; }
    }
    const assetsDir = path.join(folderPath, 'assets');
    const scanRoot = fs.existsSync(assetsDir) ? assetsDir : folderPath;
    return scanDir(scanRoot, scanRoot);
  });

  // ── scene: save / load ───────────────────────────────────────────────────
  ipcMain.handle('scene:save', async (_e, folderPath: string, objects: object[]) => {
    try {
      fs.writeFileSync(path.join(folderPath, 'forge-scene.json'), JSON.stringify({ version: 1, objects }, null, 2));
      return true;
    } catch { return false; }
  });

  ipcMain.handle('scene:load', async (_e, folderPath: string) => {
    try {
      const p = path.join(folderPath, 'forge-scene.json');
      if (!fs.existsSync(p)) return null;
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { return null; }
  });

  // ── project config ───────────────────────────────────────────────────────
  ipcMain.handle('project:readConfig', async (_e, folderPath: string) => {
    try {
      const configPath = path.join(folderPath, '.phaser-forge.json');
      if (!fs.existsSync(configPath)) return null;
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch { return null; }
  });

  ipcMain.handle('project:writeConfig', async (_e, folderPath: string, config: object) => {
    try {
      fs.writeFileSync(path.join(folderPath, '.phaser-forge.json'), JSON.stringify(config, null, 2));
      return true;
    } catch { return false; }
  });

  // ── fs: file to data url ─────────────────────────────────────────────────
  ipcMain.handle('fs:fileToDataUrl', async (_e, fullPath: string) => {
    try {
      const buf = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath).slice(1).toLowerCase();
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch { return null; }
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (devProc) { devProc.kill(); devProc = null; }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
