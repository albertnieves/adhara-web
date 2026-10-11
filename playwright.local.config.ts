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
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: false,
  },
});
