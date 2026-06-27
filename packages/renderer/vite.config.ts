import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
  // 插件前端源码通过 workspace 依赖引入，需确保 Vite 处理这些文件
  optimizeDeps: {
    include: [
      '@ttool/plugin-notepad/frontend',
      '@ttool/plugin-example/frontend',
    ],
  },
});
