import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import fs from 'fs';
import path from 'path';

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f1117',
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // IPC: open folder dialog
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Phaser Project Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // IPC: read directory tree (images only)
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
            if (children.length > 0) {
              results.push({ name: entry.name, type: 'folder', path: relPath, children });
            }
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (IMAGE_EXTS.includes(ext)) {
              results.push({ name: entry.name, type: 'file', path: relPath, fullPath, ext });
            }
          }
        }
        return results;
      } catch {
        return [];
      }
    }

    // Look for /assets subfolder first, fallback to root
    const assetsDir = path.join(folderPath, 'assets');
    const scanRoot = fs.existsSync(assetsDir) ? assetsDir : folderPath;
    return scanDir(scanRoot, scanRoot);
  });

  // IPC: save / load scene
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

  // IPC: read .phaser-forge.json from project folder
  ipcMain.handle('project:readConfig', async (_e, folderPath: string) => {
    try {
      const configPath = path.join(folderPath, '.phaser-forge.json');
      if (!fs.existsSync(configPath)) return null;
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch { return null; }
  });

  // IPC: write .phaser-forge.json to project folder
  ipcMain.handle('project:writeConfig', async (_e, folderPath: string, config: object) => {
    try {
      const configPath = path.join(folderPath, '.phaser-forge.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return true;
    } catch { return false; }
  });

  // IPC: get file as base64 (for thumbnail)
  ipcMain.handle('fs:fileToDataUrl', async (_e, fullPath: string) => {
    try {
      const buf = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath).slice(1).toLowerCase();
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});