/// <reference types="vite/client" />

interface AssetFile {
  name: string;
  type: 'file';
  path: string;
  fullPath: string;
  ext: string;
}

interface AssetFolder {
  name: string;
  type: 'folder';
  path: string;
  children: AssetEntry[];
}

type AssetEntry = AssetFile | AssetFolder;

interface ElectronAPI {
  openFolder: () => Promise<string | null>;
  readAssets: (folder: string) => Promise<AssetEntry[]>;
  fileToDataUrl: (path: string) => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}