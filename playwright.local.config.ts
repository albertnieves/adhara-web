import { defineConfig, devices } from '@playwright/test';
import { CONSENT_ACCEPTED } from './tests/support/legal-consent';
export default defineConfig({
  testDir: './tests/integration',
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  use: {
    baseURL: 'http://localhost:3000',
    storageState: CONSENT_ACCEPTED,
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'local-tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm start',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: false,
      // Devoluciones contra la API REST simulada (solo con REDSYS_ENVIRONMENT=test).
      env: {
        REDSYS_TEST_REST_URL:
          'http://localhost:3999/sis/rest/trataPeticionREST',
      },
    },
    {
      command: 'node tests/integration/fake-redsys.ts',
      url: 'http://localhost:3999/health',
      reuseExistingServer: false,
    },
  ],
});
