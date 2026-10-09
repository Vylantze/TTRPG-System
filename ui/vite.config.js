import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  esbuild: { jsx: 'automatic' },
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('..', import.meta.url)),
      '@test': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
});
