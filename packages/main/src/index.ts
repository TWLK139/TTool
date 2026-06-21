import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let isAlwaysOnTop = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    alwaysOnTop: isAlwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发环境加载 dev server，生产环境加载构建产物
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const rendererPath = app.isPackaged
      ? path.join(process.resourcesPath, 'renderer/dist/index.html')
      : path.join(__dirname, '../renderer/dist/index.html');
    mainWindow.loadFile(rendererPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

// IPC 通信：渲染进程请求切换置顶
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

// IPC 通信：获取当前置顶状态
ipcMain.handle('get-always-on-top', () => {
  return isAlwaysOnTop;
});

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
