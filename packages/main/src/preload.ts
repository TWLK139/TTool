import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ttool', {
  toggleAlwaysOnTop: (pin?: boolean) => ipcRenderer.invoke('toggle-always-on-top', pin),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
});
