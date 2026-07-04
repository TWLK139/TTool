import type { NavRoute, TToolRendererAPI, DisplayMode } from '@ttool/plugin-types';

export type { NavRoute, DisplayMode } from '@ttool/plugin-types';

declare global {
  interface Window {
    ttool: TToolRendererAPI;
  }
}

export {};
