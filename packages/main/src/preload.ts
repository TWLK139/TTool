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

  // 显示模式
  displayMode: {
    /** 获取当前显示模式 */
    get: () => ipcRenderer.invoke('display-mode:get'),
    /** 设置显示模式 */
    set: (mode: 'normal' | 'minimal' | 'floatball', path?: string) => ipcRenderer.invoke('display-mode:set', mode, path),
    /** 监听显示模式变化 */
    onChanged: (callback: (mode: 'normal' | 'minimal' | 'floatball', previousPath?: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, mode: 'normal' | 'minimal' | 'floatball', previousPath?: string) => callback(mode, previousPath);
      ipcRenderer.on('display-mode:changed', handler);
      return () => ipcRenderer.off('display-mode:changed', handler);
    },
  },
  // 浮球模式相关 API
  floatball: {
    /** 移动窗口位置 */
    moveWindow: (x: number, y: number) => ipcRenderer.invoke('floatball:move-window', x, y),
    /** 扩大窗口以显示菜单 */
    expandWindow: (width: number, height: number) => ipcRenderer.invoke('floatball:expand-window', width, height),
    /** 恢复窗口到浮球大小 */
    restoreSize: () => ipcRenderer.invoke('floatball:restore-size'),
    /** 获取进入浮球模式前的路径 */
    getPreviousPath: () => ipcRenderer.invoke('floatball:get-previous-path'),
  },
});
