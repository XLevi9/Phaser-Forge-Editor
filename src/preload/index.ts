import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readAssets: (folder: string) => ipcRenderer.invoke('fs:readAssets', folder),
  fileToDataUrl: (path: string) => ipcRenderer.invoke('fs:fileToDataUrl', path),
  readProjectConfig: (folder: string) => ipcRenderer.invoke('project:readConfig', folder),
  writeProjectConfig: (folder: string, cfg: object) => ipcRenderer.invoke('project:writeConfig', folder, cfg),
});