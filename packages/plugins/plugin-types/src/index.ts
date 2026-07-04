import { BrowserWindowConstructorOptions } from 'electron';

// ===== 路由配置 =====

/** 一级路由（对应插件自身） */
export interface PluginRoute {
  /** 路由路径，如 '/notepad' */
  path: string;
  /** 显示名称 */
  title: string;
  /** 图标（可选，用于导航栏） */
  icon?: string;
  /** 排序权重，越小越靠前 */
  order?: number;
}

/** 二级路由（运行时动态注入） */
export interface SubRoute {
  /** 路由路径，如 '/notepad/settings' */
  path: string;
  /** 显示名称 */
  title: string;
  /** 图标 */
  icon?: string;
  /** 排序权重 */
  order?: number;
}

// ===== IPC 注册 =====

/** 插件 IPC Handler 定义 */
export interface IpcHandler {
  /** 通道名，如 'notepad:list' */
  channel: string;
  /** Handler 函数（参数通过 args 数组传入，需自行断言类型） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => any;
}

// ===== 插件宿主 API =====

/** 插件宿主（基座）提供的 API */
export interface TToolHost {
  /** 基座就绪回调 */
  onReady(callback: () => void): void;
  /** 发送消息给其他插件 */
  emit(event: string, ...args: unknown[]): void;
  /** 监听其他插件的消息 */
  on(event: string, callback: (...args: unknown[]) => void): void;
  /** 运行时注入二级路由到主进程 */
  registerSubRoutes(parentPath: string, routes: SubRoute[]): void;
  /** 注销二级路由 */
  unregisterSubRoutes(parentPath: string, paths?: string[]): void;
}

// ===== 插件定义 =====

/** 插件独立窗口配置 */
export interface PluginWindowConfig {
  /** 窗口标题 */
  title?: string;
  /** 窗口尺寸 */
  width?: number;
  height?: number;
  /** 其他 BrowserWindow 构造选项 */
  options?: Omit<BrowserWindowConstructorOptions, 'width' | 'height' | 'title'>;
}

/** 插件定义 */
export interface TToolPlugin {
  /** 插件名称（唯一标识） */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;
  /** 一级路由配置（插件创建时声明，写入配置文件） */
  route: PluginRoute;
  /** 独立窗口配置（可选，不配置则在主窗口内展示） */
  window?: PluginWindowConfig;
  /** IPC Handler 列表（插件激活时注册到主进程） */
  ipcHandlers?: IpcHandler[];
  /** 插件激活时调用 */
  activate(host: TToolHost): void;
  /** 插件停用时调用 */
  deactivate?(): void;
}

// ===== 插件前端模块 =====

/**
 * 插件前端模块约定
 *
 * 每个插件的 `src/frontend/index.tsx` 必须默认导出一个 React 函数组件，
 * 渲染进程通过 `@ttool/plugin-xxx/frontend` 子路径导入此组件。
 *
 * 约定格式：
 * ```tsx
 * // src/frontend/index.tsx
 * export default function MyPluginPage() { ... }
 * ```
 *
 * 对应的 package.json exports 配置：
 * ```json
 * { "exports": { "./frontend": "./src/frontend/index.tsx" } }
 * ```
 */

/** 插件前端模块导出格式（渲染进程消费，default 为 React 函数组件） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PluginFrontendModule {
  /** 默认导出：该插件对应的 React 页面组件（渲染进程侧断言为 React.ComponentType） */
  default: any;
}

// ===== 渲染进程全局类型 =====

/** 一级路由项（从主进程获取，渲染进程侧使用） */
export interface NavRoute {
  path: string;
  title: string;
  icon?: string;
  order?: number;
  children: SubRoute[];
  standalone: boolean;
}

/** 显示模式类型 */
export type DisplayMode = 'normal' | 'minimal' | 'floatball';

/** 渲染进程 window.ttool API 声明 */
export interface TToolRendererAPI {
  toggleAlwaysOnTop: (pin?: boolean) => Promise<boolean>;
  getAlwaysOnTop: () => Promise<boolean>;
  reload: () => Promise<void>;
  openDevTools: () => Promise<void>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  routes: {
    get: () => Promise<NavRoute[]>;
    onUpdated: (callback: (routes: NavRoute[]) => void) => () => void;
  };
  plugin: {
    openStandalone: (pluginName: string) => Promise<boolean>;
  };
  /** 通用 IPC 调用，用于调用插件注册的 handler */
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  /** 显示模式相关 API */
  displayMode: {
    get: () => Promise<DisplayMode>;
    set: (mode: DisplayMode, path?: string) => Promise<void>;
    onChanged: (callback: (mode: DisplayMode, previousPath?: string) => void) => () => void;
  };
  /** 浮球模式相关 API */
  floatball: {
    moveWindow: (x: number, y: number) => Promise<void>;
    expandWindow: (width: number, height: number) => Promise<void>;
    restoreSize: () => Promise<void>;
    getPreviousPath: () => Promise<string>;
  };
}

// ===== 插件注册配置（由 main 管理） =====

/** 插件注册条目 */
export interface PluginRegistryEntry {
  /** 插件包名，如 '@ttool/plugin-notepad' */
  packageName: string;
  /** 插件名称 */
  name: string;
  /** 一级路由 */
  route: PluginRoute;
  /** 是否启用 */
  enabled: boolean;
  /** 是否独立窗口 */
  standalone: boolean;
  /** 独立窗口配置 */
  window?: PluginWindowConfig;
}

/** 插件注册表 */
export interface PluginRegistry {
  plugins: PluginRegistryEntry[];
}
