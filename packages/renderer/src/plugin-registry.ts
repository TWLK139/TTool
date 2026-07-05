import type { ComponentType } from 'react';
import type { PluginFrontendModule } from '@ttool/plugin-types';

/**
 * 插件前端组件注册表
 *
 * 每个插件的前端组件通过 `@ttool/plugin-xxx/frontend` 子路径导入，
 * 路由路径与插件在 plugins.config.ts 中声明的 route.path 一一对应。
 *
 * 新增插件时只需在此添加一行导入和映射。
 */
import Notepad from '@ttool/plugin-notepad/frontend';
import Example from '@ttool/plugin-example/frontend';
import ClipboardToTable from '@ttool/plugin-clipboard-to-table/frontend';

export const pluginComponents: Record<string, ComponentType> = {
  '/notepad': Notepad as PluginFrontendModule['default'],
  '/example': Example as PluginFrontendModule['default'],
  '/clipboard-to-table': ClipboardToTable as PluginFrontendModule['default'],
};
