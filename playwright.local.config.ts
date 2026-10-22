import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { CONSENT_ACCEPTED } from './tests/support/legal-consent';

// Correo entrante de la bandeja (A6.1) contra la API de Resend simulada: un
// secreto de firma de un solo uso, que las pruebas leen para firmar los
// eventos. Sin EMAIL_FROM no sale ningún correo (siguen en la cola).
const webhookSecret =
  process.env.RESEND_WEBHOOK_SECRET ??
  `whsec_${randomBytes(24).toString('base64')}`;
const inboundDomain =
  process.env.INBOUND_EMAIL_DOMAIN ?? 'respuestas.example.test';
process.env.RESEND_WEBHOOK_SECRET = webhookSecret;
process.env.INBOUND_EMAIL_DOMAIN = inboundDomain;

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
      // Devoluciones contra la API REST simulada (solo con REDSYS_ENVIRONMENT=test)
      // y correos recibidos contra la de Resend (solo con una URL local).
      env: {
        REDSYS_TEST_REST_URL:
          'http://localhost:3999/sis/rest/trataPeticionREST',
        RESEND_TEST_API_URL: 'http://localhost:3998',
        RESEND_API_KEY: 're_prueba_local',
        RESEND_WEBHOOK_SECRET: webhookSecret,
        INBOUND_EMAIL_DOMAIN: inboundDomain,
      },
    },
    {
      command: 'node tests/integration/fake-redsys.ts',
      url: 'http://localhost:3999/health',
      reuseExistingServer: false,
    },
    {
      command: 'node tests/integration/fake-resend.ts',
      url: 'http://localhost:3998/health',
      reuseExistingServer: false,
    },
  ],
});
