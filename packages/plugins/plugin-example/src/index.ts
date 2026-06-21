import type { TToolPlugin } from '@ttool/plugin-types';

const examplePlugin: TToolPlugin = {
  name: 'example',
  version: '0.1.0',
  description: '示例插件（独立窗口）',
  route: {
    path: '/example',
    title: '示例',
    icon: '🔧',
    order: 100,
  },
  window: {
    title: 'TTool - 示例插件',
    width: 600,
    height: 400,
  },
  activate(host) {
    console.log(`[plugin-example] 已激活`);
    host.onReady(() => {
      console.log(`[plugin-example] 基座就绪`);
    });

    // 示例：运行时注入二级路由
    host.registerSubRoutes('/example', [
      { path: '/example/about', title: '关于', order: 0 },
    ]);
  },
  deactivate() {
    console.log(`[plugin-example] 已停用`);
  },
};

export default examplePlugin;
