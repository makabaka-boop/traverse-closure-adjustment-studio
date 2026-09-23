import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 完全离线：构建期不外联任何 CDN，产物为纯静态文件。
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false
  }
});
