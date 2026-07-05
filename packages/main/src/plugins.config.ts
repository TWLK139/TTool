import type { PluginRegistry } from '@ttool/plugin-types';

/**
 * 插件注册配置
 *
 * 一级目录直接对应各 plugin，在此声明式配置。
 * 新插件创建后需要在此文件中添加条目，main 进程会读取此配置加载导航。
 *
 * 二级路由由各 plugin 在运行时通过 host.registerSubRoutes() 动态注入。
 */
const pluginConfig: PluginRegistry = {
  plugins: [
    {
      packageName: '@ttool/plugin-notepad',
      name: 'notepad',
      route: {
        path: '/notepad',
        title: '记事本',
        icon: '📝',
        order: 0,
      },
      enabled: true,
      standalone: false,
    },
    {
      packageName: '@ttool/plugin-example',
      name: 'example',
      route: {
        path: '/example',
        title: '示例',
        icon: '🔧',
        order: 100,
      },
      enabled: true,
      standalone: true,
      window: {
        title: 'TTool - 示例插件',
        width: 600,
        height: 400,
      },
    },
    {
      packageName: '@ttool/plugin-clipboard-to-table',
      name: 'clipboard-to-table',
      route: {
        path: '/clipboard-to-table',
        title: '表格转换',
        icon: '📋',
        order: 1,
      },
      enabled: true,
      standalone: false,
    },
  ],
};

export default pluginConfig;
