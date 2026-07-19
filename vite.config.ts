import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const defaultPublicEnv: Record<string, string> = {
  VITE_WORLD_FORGE_SERVICE_URL: ''
};

for (const [name, value] of Object.entries(defaultPublicEnv)) {
  process.env[name] ||= value;
}

export default defineConfig({
  base: './',
  plugins: [react()],
  root: 'apps/desktop',
  envDir: __dirname,
  publicDir: '../../public',
  resolve: {
    alias: {
      '@world-forge/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@world-forge/generator-core': path.resolve(__dirname, 'packages/generator-core/src'),
      '@world-forge/generation-runtime': path.resolve(__dirname, 'packages/generation-runtime/src'),
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
