import type { TToolPlugin, IpcHandler } from '@ttool/plugin-types';
import { clipboard } from 'electron';

const ipcHandlers: IpcHandler[] = [
  {
    channel: 'clipboard-to-table:read-clipboard',
    handler: async () => {
      return clipboard.readText();
    },
  },
  {
    channel: 'clipboard-to-table:write-clipboard',
    handler: async (text: string) => {
      clipboard.writeText(text);
      return true;
    },
  },
];

const clipboardToTablePlugin: TToolPlugin = {
  name: 'clipboard-to-table',
  version: '0.1.0',
  description: '剪贴板转表格插件',
  route: {
    path: '/clipboard-to-table',
    title: '表格转换',
    icon: '\u{1f4cb}',
    order: 1,
  },
  ipcHandlers,
  activate(host) {
    console.log(`[clipboard-to-table] 已激活`);
    host.onReady(() => {
      console.log(`[clipboard-to-table] 基座就绪`);
    });
  },
  deactivate() {
    console.log(`[clipboard-to-table] 已停用`);
  },
};

export default clipboardToTablePlugin;
