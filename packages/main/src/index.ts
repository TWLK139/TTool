import { app, BrowserWindow, Menu, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import pluginConfig from './plugins.config';
import type { TToolPlugin, TToolHost, SubRoute, PluginRegistryEntry } from '@ttool/plugin-types';

// ===== 状态管理 =====

let mainWindow: BrowserWindow | null = null;
let isAlwaysOnTop = false;
let currentDisplayMode: 'normal' | 'minimal' | 'floatball' = 'normal';
let previousWindowBounds: Electron.Rectangle | null = null;
let previousPinState = false;
let previousPath = '';

/** 运行时二级路由表：parentPath -> SubRoute[] */
const runtimeSubRoutes: Map<string, SubRoute[]> = new Map();

/** 已加载的插件实例 */
const loadedPlugins: Map<string, TToolPlugin> = new Map();

/** 独立窗口映射：pluginName -> BrowserWindow */
const standaloneWindows: Map<string, BrowserWindow> = new Map();

/** 插件间事件总线 */
const eventBus: Map<string, ((...args: unknown[]) => void)[]> = new Map();

// ===== 主窗口 =====

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    alwaysOnTop: isAlwaysOnTop,
    frame: false,
    transparent: true,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const rendererPath = path.join(process.resourcesPath, 'renderer/dist/index.html');
    mainWindow.loadFile(rendererPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== 独立窗口 =====

function createStandaloneWindow(entry: PluginRegistryEntry): BrowserWindow {
  const win = new BrowserWindow({
    width: entry.window?.width ?? 600,
    height: entry.window?.height ?? 400,
    title: entry.window?.title ?? `TTool - ${entry.route.title}`,
    frame: false,
    icon: path.join(__dirname, '../build/icon.png'),
    ...entry.window?.options,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 独立窗口加载带 hash 路由的页面，直接定位到该插件
  const routePath = entry.route.path;

  if (!app.isPackaged) {
    win.loadURL(`http://localhost:5173#${routePath}`);
    win.webContents.openDevTools();
  } else {
    const rendererPath = path.join(process.resourcesPath, 'renderer/dist/index.html');
    win.loadFile(rendererPath, { hash: routePath });
  }

  win.on('closed', () => {
    standaloneWindows.delete(entry.name);
  });

  standaloneWindows.set(entry.name, win);
  return win;
}

// ===== 菜单 =====

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '视图',
      submenu: [
        {
          label: '窗口置顶',
          type: 'checkbox',
          checked: isAlwaysOnTop,
          click: (menuItem) => {
            toggleAlwaysOnTop(menuItem.checked);
          },
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function toggleAlwaysOnTop(pin: boolean): void {
  isAlwaysOnTop = pin;
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(pin);
  }
}

// ===== 插件加载器 =====

function createPluginHost(entry: PluginRegistryEntry): TToolHost {
  const readyCallbacks: (() => void)[] = [];

  const host: TToolHost = {
    onReady(callback: () => void): void {
      readyCallbacks.push(callback);
    },
    emit(event: string, ...args: unknown[]): void {
      const listeners = eventBus.get(event) ?? [];
      listeners.forEach((fn) => fn(...args));
    },
    on(event: string, callback: (...args: unknown[]) => void): void {
      const listeners = eventBus.get(event) ?? [];
      listeners.push(callback);
      eventBus.set(event, listeners);
    },
    registerSubRoutes(parentPath: string, routes: SubRoute[]): void {
      runtimeSubRoutes.set(parentPath, routes);
      // 通知渲染进程路由更新
      notifyRoutesChanged();
    },
    unregisterSubRoutes(parentPath: string, paths?: string[]): void {
      if (!paths) {
        runtimeSubRoutes.delete(parentPath);
      } else {
        const existing = runtimeSubRoutes.get(parentPath);
        if (existing) {
          const filtered = existing.filter((r) => !paths.includes(r.path));
          if (filtered.length > 0) {
            runtimeSubRoutes.set(parentPath, filtered);
          } else {
            runtimeSubRoutes.delete(parentPath);
          }
        }
      }
      notifyRoutesChanged();
    },
  };

  return host;
}

/** 通知渲染进程路由发生变化 */
function notifyRoutesChanged(): void {
  const allRoutes = getAllRoutes();
  mainWindow?.webContents.send('routes:updated', allRoutes);
  // 也通知所有独立窗口
  standaloneWindows.forEach((win) => {
    win.webContents.send('routes:updated', allRoutes);
  });
}

/** 获取所有路由（一级 + 二级） */
function getAllRoutes() {
  const enabledPlugins = pluginConfig.plugins.filter((p) => p.enabled);
  return enabledPlugins.map((entry) => ({
    ...entry.route,
    children: runtimeSubRoutes.get(entry.route.path) ?? [],
    standalone: entry.standalone,
  }));
}

/** 加载并激活所有已启用的插件 */
async function loadPlugins(): Promise<void> {
  const enabledPlugins = pluginConfig.plugins.filter((p) => p.enabled);

  for (const entry of enabledPlugins) {
    try {
      // 动态 require 插件包
      const pluginModule = require(entry.packageName);
      const plugin: TToolPlugin = pluginModule.default ?? pluginModule;

      if (!plugin || !plugin.activate) {
        console.warn(`[TTool] 插件 ${entry.packageName} 未导出有效的 TToolPlugin`);
        continue;
      }

      const host = createPluginHost(entry);
      plugin.activate(host);
      loadedPlugins.set(entry.name, plugin);

      // 注册插件的 IPC Handlers
      if (plugin.ipcHandlers) {
        for (const ipc of plugin.ipcHandlers) {
          ipcMain.handle(ipc.channel, (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
            return ipc.handler(...args);
          });
        }
      }

      console.log(`[TTool] 插件 ${plugin.name} v${plugin.version} 已激活`);
    } catch (err) {
      console.error(`[TTool] 加载插件 ${entry.packageName} 失败:`, err);
    }
  }
}

/** 停用所有插件 */
function unloadPlugins(): void {
  for (const [name, plugin] of loadedPlugins) {
    try {
      plugin.deactivate?.();
    } catch (err) {
      console.error(`[TTool] 停用插件 ${name} 失败:`, err);
    }
  }
  loadedPlugins.clear();
}

// ===== IPC 通信 =====

// 窗口置顶
ipcMain.handle('toggle-always-on-top', (_event, pin?: boolean) => {
  if (pin !== undefined) {
    isAlwaysOnTop = pin;
  } else {
    isAlwaysOnTop = !isAlwaysOnTop;
  }
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(isAlwaysOnTop);
  }
  return isAlwaysOnTop;
});

ipcMain.handle('get-always-on-top', () => {
  return isAlwaysOnTop;
});

// 刷新页面
ipcMain.handle('window:reload', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.webContents.reload();
});

// 打开控制台
ipcMain.handle('window:open-devtools', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.webContents.openDevTools();
});

// 窗口最小化
ipcMain.handle('window:minimize', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.minimize();
});

// 窗口最大化/还原
ipcMain.handle('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

// 关闭窗口
ipcMain.handle('window:close', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.close();
});

// 获取窗口是否最大化
ipcMain.handle('window:is-maximized', () => {
  const win = BrowserWindow.getFocusedWindow();
  return win?.isMaximized() ?? false;
});

// 设置窗口位置
ipcMain.handle('window:set-position', (_event, x: number, y: number) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setPosition(x, y);
  }
});

// 获取窗口位置
ipcMain.handle('window:get-position', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    const bounds = win.getBounds();
    return { x: bounds.x, y: bounds.y };
  }
  return { x: 0, y: 0 };
});

// 获取导航路由表（渲染进程启动时请求）
ipcMain.handle('routes:get', () => {
  return getAllRoutes();
});

// 打开独立窗口插件
ipcMain.handle('plugin:open-standalone', (_event, pluginName: string) => {
  const entry = pluginConfig.plugins.find((p) => p.name === pluginName && p.standalone);
  if (!entry) {
    console.warn(`[TTool] 未找到独立窗口插件: ${pluginName}`);
    return false;
  }

  // 如果窗口已存在，聚焦它
  const existing = standaloneWindows.get(pluginName);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return true;
  }

  createStandaloneWindow(entry);
  return true;
});

// 显示模式相关 IPC

ipcMain.handle('display-mode:get', () => {
  return currentDisplayMode;
});

ipcMain.handle('display-mode:set', (_event, mode: 'normal' | 'minimal' | 'floatball', path?: string) => {
  if (!mainWindow) return;

  if (mode === 'floatball') {
    previousWindowBounds = mainWindow.getBounds();
    previousPinState = isAlwaysOnTop;
    previousPath = path ?? '';

    mainWindow.setAlwaysOnTop(true);
    mainWindow.setBounds({
      width: 60,
      height: 60,
      x: previousWindowBounds.x + (previousWindowBounds.width - 60) / 2,
      y: previousWindowBounds.y + (previousWindowBounds.height - 60) / 2,
    });
  } else if (currentDisplayMode === 'floatball') {
    if (previousWindowBounds) {
      mainWindow.setBounds(previousWindowBounds);
      mainWindow.setAlwaysOnTop(previousPinState);
    }
  }

  currentDisplayMode = mode;

  mainWindow.webContents.send('display-mode:changed', mode, previousPath);
  standaloneWindows.forEach((win) => {
    win.webContents.send('display-mode:changed', mode, previousPath);
  });

  hostEmit('display-mode-changed', mode);
});

ipcMain.handle('floatball:move-window', (_event, x: number, y: number) => {
  if (!mainWindow || currentDisplayMode !== 'floatball') return;
  mainWindow.setPosition(x, y);
});

ipcMain.handle('floatball:expand-window', (_event, width: number, height: number) => {
  if (!mainWindow || currentDisplayMode !== 'floatball') return;

  const bounds = mainWindow.getBounds();
  mainWindow.setBounds({
    width: width,
    height: height,
    x: Math.max(0, bounds.x - (width - bounds.width) / 2),
    y: Math.max(0, bounds.y - (height - bounds.height) / 2),
  });
});

ipcMain.handle('floatball:restore-size', () => {
  if (!mainWindow || currentDisplayMode !== 'floatball') return;

  const bounds = mainWindow.getBounds();
  mainWindow.setBounds({
    width: 60,
    height: 60,
    x: bounds.x + (bounds.width - 60) / 2,
    y: bounds.y + (bounds.height - 60) / 2,
  });
});

ipcMain.handle('floatball:get-previous-path', () => {
  return previousPath;
});

function hostEmit(event: string, ...args: unknown[]): void {
  const listeners = eventBus.get(event) ?? [];
  listeners.forEach((fn) => fn(...args));
}

// ===== 应用启动 =====

app.whenReady().then(async () => {
  createMainWindow();
  Menu.setApplicationMenu(null);
  await loadPlugins();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  unloadPlugins();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
