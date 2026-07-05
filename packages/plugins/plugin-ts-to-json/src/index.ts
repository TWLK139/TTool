import type { TToolPlugin } from '@ttool/plugin-types';

const tsToJsonPlugin: TToolPlugin = {
  name: 'ts-to-json',
  version: '0.1.0',
  description: 'TS对象转JSON插件',
  route: {
    path: '/ts-to-json',
    title: 'TS转JSON',
    icon: '🔄',
    order: 2,
  },
  activate(host) {
    console.log(`[ts-to-json] 已激活`);
    host.onReady(() => {
      console.log(`[ts-to-json] 基座就绪`);
    });
  },
  deactivate() {
    console.log(`[ts-to-json] 已停用`);
  },
};

export default tsToJsonPlugin;
