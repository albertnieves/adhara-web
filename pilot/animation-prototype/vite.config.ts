import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Los drafts viven en ../assets-drafts (fuera de este proyecto). Se importan
// desde el código para que el build solo empaquete los que se usan.
const assetsDrafts = fileURLToPath(new URL('../assets-drafts', import.meta.url));
// Referencias oficiales de marca (uso interno, ver ../assets-refs/PROVENANCE.md).
const assetsRefs = fileURLToPath(new URL('../assets-refs', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@drafts': assetsDrafts, '@refs': assetsRefs } },
  server: { fs: { allow: ['.', assetsDrafts, assetsRefs] } },
  build: { chunkSizeWarningLimit: 1500 },
});
