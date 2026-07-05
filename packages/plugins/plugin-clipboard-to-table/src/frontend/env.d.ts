import type { TToolRendererAPI } from '@ttool/plugin-types';

declare global {
  interface Window {
    ttool: TToolRendererAPI;
  }
}

export {};
