import 'server-only';

export type SendcloudConfig = {
  publicKey: string;
  secretKey: string;
  /** Firma de los avisos: la «Webhook Signature Key» o, si no, la secreta. */
  webhookSecret: string;
  apiBase: string;
};

/**
 * Plataforma multitransportista (DECISIONS §171): SENDCLOUD_PUBLIC_KEY y
 * SENDCLOUD_SECRET_KEY de la integración de API, solo de servidor y como
 * «Sensitive» en Vercel. SENDCLOUD_WEBHOOK_SECRET solo si la integración firma
 * los avisos con una clave propia. Sin ellas el panel funciona con los
 * servicios manuales y no compra etiquetas.
 */
export function sendcloudConfig(
  env: Record<string, string | undefined> = process.env,
): SendcloudConfig | null {
  const publicKey = env.SENDCLOUD_PUBLIC_KEY?.trim() ?? '';
  const secretKey = env.SENDCLOUD_SECRET_KEY?.trim() ?? '';
  if (!publicKey || !secretKey) return null;
  return {
    publicKey,
    secretKey,
    webhookSecret: env.SENDCLOUD_WEBHOOK_SECRET?.trim() || secretKey,
    apiBase: sendcloudApiBase(env),
  };
}

/**
 * Base de la API v3. Las pruebas de extremo a extremo apuntan a una API
 * simulada con SENDCLOUD_TEST_API_URL, que solo se acepta si es una dirección
 * local: fuera de las pruebas no cambia nada.
 */
export function sendcloudApiBase(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env.SENDCLOUD_TEST_API_URL?.trim();
  if (override) {
    try {
      const url = new URL(override);
      if (
        url.protocol === 'http:' &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
      )
        return url.toString().replace(/\/$/, '');
    } catch {
      // Una URL mal escrita se ignora.
    }
  }
  return 'https://panel.sendcloud.sc/api/v3';
}
