import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

const IS_WIN = process.platform === 'win32';
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
const DEV_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+/;
const DEV_SERVER_TIMEOUT_MS = 30000;

let mainWin: BrowserWindow | null = null;
let devProc: ChildProcess | null = null;

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
const sendToRenderer = (channel: string, ...args: unknown[]) => mainWin?.webContents.send(channel, ...args);

function readJson(file: string) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null;
  } catch {
    return null;
  }
}

function writeJson(file: string, data: unknown) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

// `npm run` goes through a shell, so killing the child alone would orphan the dev server.
function stopDevServer() {
  const proc = devProc;
  devProc = null;
  if (!proc?.pid || proc.exitCode !== null) return;
  if (IS_WIN) spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F']).on('error', () => {});
  else try { process.kill(-proc.pid, 'SIGTERM'); } catch { proc.kill(); }
}

function scanAssets(dir: string, base: string): unknown[] {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const results: unknown[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      const children = scanAssets(fullPath, base);
      if (children.length > 0) results.push({ name: entry.name, type: 'folder', path: relPath, children });
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTS.includes(ext)) results.push({ name: entry.name, type: 'file', path: relPath, fullPath, ext });
    }
  }
  return results;
}

function createWindow(): void {
  mainWin = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false, // lets the file:// renderer embed the localhost game iframe
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f1117',
  });

  if (process.env['ELECTRON_RENDERER_URL']) mainWin.loadURL(process.env['ELECTRON_RENDERER_URL']);
  else mainWin.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Phaser Project Folder',
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle('devserver:start', (_e, folder: string, script?: string) => {
    stopDevServer();
    const runScript = script?.trim() || 'dev';

    return new Promise<{ ok: boolean; url?: string; error?: string }>(resolve => {
      let settled = false;
      const settle = (result: { ok: boolean; url?: string; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(
        () => settle({ ok: false, error: `Timeout (${DEV_SERVER_TIMEOUT_MS / 1000}s) — dev server URL not detected.` }),
        DEV_SERVER_TIMEOUT_MS,
      );

      sendToRenderer('devserver:output', `[Running: npm run ${runScript}]\n`);
      const proc = spawn('npm', ['run', runScript], { cwd: folder, shell: true, detached: !IS_WIN });
      devProc = proc;

      const onData = (data: Buffer) => {
        const text = stripAnsi(data.toString());
        sendToRenderer('devserver:output', text);
        const url = text.match(DEV_URL_RE)?.[0];
        if (url) settle({ ok: true, url });
      };
      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onData);

      proc.on('error', err => settle({ ok: false, error: err.message }));
      proc.on('exit', code => {
        settle({ ok: false, error: `Dev server exited (code ${code}) before a URL was detected.` });
        // A restart replaces devProc; only report the stop if this is still the active server.
        if (devProc !== proc) return;
        devProc = null;
        sendToRenderer('devserver:output', `\n[Dev server exited — code ${code}]\n`);
        sendToRenderer('devserver:stopped');
      });
    });
  });

  ipcMain.handle('devserver:stop', () => {
    stopDevServer();
    return { ok: true };
  });

  ipcMain.handle('vscode:open', (_e, folder: string) => {
    // `code` is a .cmd shim on Windows and needs a shell; quotes are safe there since paths can't contain them.
    spawn('code', [IS_WIN ? `"${folder}"` : folder], { shell: IS_WIN, detached: true, stdio: 'ignore' })
      .on('error', () => {})
      .unref();
  });

  ipcMain.handle('bridge:install', (_e, folder: string) => {
    const source = [
      path.join(app.getAppPath(), 'src', 'bridge', 'phaser-forge-bridge.js'),
      path.join(process.resourcesPath, 'bridge', 'phaser-forge-bridge.js'),
    ].find(p => fs.existsSync(p));
    if (!source) return { ok: false, error: 'Bridge SDK source file not found.' };
    try {
      fs.copyFileSync(source, path.join(folder, 'phaser-forge-bridge.js'));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('fs:readAssets', (_e, folder: string) => {
    const assetsDir = path.join(folder, 'assets');
    const root = fs.existsSync(assetsDir) ? assetsDir : folder;
    return scanAssets(root, root);
  });

  ipcMain.handle('fs:fileToDataUrl', (_e, fullPath: string) => {
    try {
      const ext = path.extname(fullPath).slice(1).toLowerCase();
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      return `data:${mime};base64,${fs.readFileSync(fullPath).toString('base64')}`;
    } catch {
      return null;
    }
  });

  ipcMain.handle('scene:save', (_e, folder: string, objects: object[]) =>
    writeJson(path.join(folder, 'forge-scene.json'), { version: 1, objects }));
  ipcMain.handle('scene:load', (_e, folder: string) => readJson(path.join(folder, 'forge-scene.json')));

  ipcMain.handle('project:readConfig', (_e, folder: string) => readJson(path.join(folder, '.phaser-forge.json')));
  ipcMain.handle('project:writeConfig', (_e, folder: string, config: object) =>
    writeJson(path.join(folder, '.phaser-forge.json'), config));

  // Dev-server scripts only: `dev`, `dev:*`, and variants like `engine:dev:fantasy`.
  ipcMain.handle('project:readScripts', (_e, folder: string) => {
    const scripts = readJson(path.join(folder, 'package.json'))?.scripts ?? {};
    return Object.keys(scripts).filter(n => n === 'dev' || n.startsWith('dev:') || /:dev(:|$)/.test(n));
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', stopDevServer);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
