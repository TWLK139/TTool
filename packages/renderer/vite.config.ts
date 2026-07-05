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
    port: 5400,
    strictPort: false,
  },
  // 插件前端源码通过 workspace 依赖引入，Vite 通过正常模块解析处理，无需 optimizeDeps
});
