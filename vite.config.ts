import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: 'apps/desktop',
  publicDir: '../../public',
  resolve: {
    alias: {
      '@world-forge/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@world-forge/generator-core': path.resolve(__dirname, 'packages/generator-core/src'),
      '@world-forge/renderer': path.resolve(__dirname, 'packages/renderer/src'),
      '@world-forge/exporters': path.resolve(__dirname, 'packages/exporters/src')
    }
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  test: {
    environment: 'node',
    include: ['../../packages/**/*.test.ts', 'src/**/*.test.ts']
  }
});
