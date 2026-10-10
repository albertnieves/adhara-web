import { defineConfig, devices } from '@playwright/test';
import { CONSENT_ACCEPTED } from './tests/support/legal-consent';
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    storageState: CONSENT_ACCEPTED,
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: false,
  },
});
