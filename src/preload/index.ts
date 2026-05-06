import { contextBridge } from 'electron';

// Custom APIs for renderer
const api = {};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      // Add electron apis here if needed
    });
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = {
    // Add electron apis here if needed
  };
  // @ts-ignore (define in dts)
  window.api = api;
}
