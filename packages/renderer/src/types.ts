import type { SubRoute } from '@ttool/plugin-types';

/** 一级路由项（从主进程获取） */
export interface NavRoute {
  path: string;
  title: string;
  icon?: string;
  order?: number;
  children: SubRoute[];
  standalone: boolean;
}

declare global {
  interface Window {
    ttool: {
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
    };
  }
}

export {};
