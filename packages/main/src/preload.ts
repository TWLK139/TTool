import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ttool', {
  // 窗口控制
  toggleAlwaysOnTop: (pin?: boolean) => ipcRenderer.invoke('toggle-always-on-top', pin),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  reload: () => ipcRenderer.invoke('window:reload'),
  openDevTools: () => ipcRenderer.invoke('window:open-devtools'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  // 路由与导航
  routes: {
    /** 获取完整路由表（一级 + 二级） */
    get: () => ipcRenderer.invoke('routes:get'),
    /** 监听路由更新事件 */
    onUpdated: (callback: (routes: unknown[]) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, routes: unknown[]) => callback(routes);
      ipcRenderer.on('routes:updated', handler);
      return () => ipcRenderer.off('routes:updated', handler);
    },
  },

  // 插件管理
  plugin: {
    /** 打开独立窗口插件 */
    openStandalone: (pluginName: string) => ipcRenderer.invoke('plugin:open-standalone', pluginName),
  },

  // 插件 IPC 通用调用（按 channel 调用已注册的 handler）
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
});
