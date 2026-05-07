import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Folder
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // Assets
  readAssets: (folder: string) => ipcRenderer.invoke('fs:readAssets', folder),
  fileToDataUrl: (path: string) => ipcRenderer.invoke('fs:fileToDataUrl', path),

  // Project config
  readProjectConfig: (folder: string) => ipcRenderer.invoke('project:readConfig', folder),
  writeProjectConfig: (folder: string, cfg: object) => ipcRenderer.invoke('project:writeConfig', folder, cfg),

  // Scene
  saveScene: (folder: string, objects: object[]) => ipcRenderer.invoke('scene:save', folder, objects),
  loadScene: (folder: string) => ipcRenderer.invoke('scene:load', folder),

  // Dev server
  startDevServer: (folder: string) => ipcRenderer.invoke('devserver:start', folder),
  stopDevServer: () => ipcRenderer.invoke('devserver:stop'),
  onDevServerOutput: (cb: (text: string) => void) =>
    ipcRenderer.on('devserver:output', (_e, text) => cb(text)),
  onDevServerStopped: (cb: () => void) =>
    ipcRenderer.on('devserver:stopped', cb),
  removeDevServerListeners: () => {
    ipcRenderer.removeAllListeners('devserver:output');
    ipcRenderer.removeAllListeners('devserver:stopped');
  },

  // VS Code
  openVSCode: (folder: string) => ipcRenderer.invoke('vscode:open', folder),
});
