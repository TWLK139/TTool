import type { TToolPlugin } from '@ttool/plugin-types';

const examplePlugin: TToolPlugin = {
  name: 'plugin-example',
  version: '0.1.0',
  description: '示例插件',
  activate(host) {
    console.log(`[plugin-example] 已激活`);
    host.onReady(() => {
      console.log(`[plugin-example] 基座就绪`);
    });
  },
  deactivate() {
    console.log(`[plugin-example] 已停用`);
  },
};

export default examplePlugin;
