import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Escena three.js: sus objetos (texturas, materiales, grupos) se mutan en
    // useFrame y efectos por diseño de React Three Fiber; la regla del compilador
    // de React los trata como estado inmutable y da falsos positivos.
    files: ['src/modules/unboxing/scene/**/*.tsx'],
    rules: { 'react-hooks/immutability': 'off' },
  },
  globalIgnores([
    '.next/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
    'pilot/animation-prototype/**',
  ]),
]);
