import type { NavRoute, TToolRendererAPI } from '@ttool/plugin-types';

export type { NavRoute } from '@ttool/plugin-types';

declare global {
  interface Window {
    ttool: TToolRendererAPI;
  }
}

export {};
