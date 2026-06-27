import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import type { TToolPlugin, IpcHandler, TToolHost } from '@ttool/plugin-types';

// ===== 插件宿主引用（供 IPC handler 回调使用） =====
let pluginHost: TToolHost | null = null;

// ===== Notes 数据层 =====

function getNotesDir(): string {
  return path.join(app.getPath('userData'), 'notes');
}

function ensureNotesDir(): void {
  const dir = getNotesDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ===== IPC Handlers =====

const ipcHandlers: IpcHandler[] = [
  {
    channel: 'notepad:list',
    handler: async () => {
      ensureNotesDir();
      const dir = getNotesDir();
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
      return files
        .map((f) => {
          const filePath = path.join(dir, f);
          const stat = fs.statSync(filePath);
          return {
            name: f.replace(/\.md$/, ''),
            fileName: f,
            updatedAt: stat.mtimeMs,
            createdAt: stat.birthtimeMs,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
    },
  },
  {
    channel: 'notepad:read',
    handler: async (fileName: string) => {
      const filePath = path.join(getNotesDir(), fileName);
      if (!fs.existsSync(filePath)) return '';
      return fs.readFileSync(filePath, 'utf-8');
    },
  },
  {
    channel: 'notepad:save',
    handler: async (fileName: string, content: string) => {
      ensureNotesDir();
      const filePath = path.join(getNotesDir(), fileName);
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    },
  },
  {
    channel: 'notepad:create',
    handler: async (name: string) => {
      ensureNotesDir();
      const fileName = `${name}.md`;
      const filePath = path.join(getNotesDir(), fileName);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '', 'utf-8');
      }
      return fileName;
    },
  },
  {
    channel: 'notepad:delete',
    handler: async (fileName: string) => {
      const filePath = path.join(getNotesDir(), fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    },
  },
  {
    channel: 'notepad:rename',
    handler: async (oldFileName: string, newFileName: string) => {
      const oldPath = path.join(getNotesDir(), oldFileName);
      const newPath = path.join(getNotesDir(), newFileName);
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
      return true;
    },
  },
  {
    channel: 'notepad:sync-routes',
    handler: async () => {
      if (pluginHost) {
        syncNoteRoutes(pluginHost);
      }
      return true;
    },
  },
];

// ===== 二级路由同步 =====

function syncNoteRoutes(host: TToolHost): void {
  ensureNotesDir();
  const dir = getNotesDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  const notes = files
    .map((f) => {
      const filePath = path.join(dir, f);
      const stat = fs.statSync(filePath);
      return {
        name: f.replace(/\.md$/, ''),
        fileName: f,
        updatedAt: stat.mtimeMs,
        createdAt: stat.birthtimeMs,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const subRoutes = notes.map((note, i) => ({
    path: `/notepad/${encodeURIComponent(note.fileName)}`,
    title: note.name,
    order: i,
  }));

  host.registerSubRoutes('/notepad', subRoutes);
}

// ===== 插件定义 =====

const notepadPlugin: TToolPlugin = {
  name: 'notepad',
  version: '0.1.0',
  description: 'Markdown 记事本插件',
  route: {
    path: '/notepad',
    title: '记事本',
    icon: '📝',
    order: 0,
  },
  ipcHandlers,
  activate(host) {
    console.log(`[notepad] 已激活`);
    pluginHost = host;

    // 初始同步笔记列表到二级路由
    syncNoteRoutes(host);

    host.onReady(() => {
      console.log(`[notepad] 基座就绪`);
    });
  },
  deactivate() {
    console.log(`[notepad] 已停用`);
  },
};

export default notepadPlugin;
