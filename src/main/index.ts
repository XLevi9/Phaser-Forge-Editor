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
