import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Imágenes de las escenas 3D (tsconfig paths): Vite devuelve su URL.
      '@pilot-refs': fileURLToPath(
        new URL('./pilot/assets-refs', import.meta.url),
      ),
      '@pilot-drafts': fileURLToPath(
        new URL('./pilot/assets-drafts', import.meta.url),
      ),
    },
  },
  test: { include: ['tests/unit/**/*.test.{ts,tsx}'] },
});
