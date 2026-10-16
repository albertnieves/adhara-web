import 'server-only';

export type MailConfig = { apiKey: string; from: string };

/**
 * Proveedor de correo transaccional (STATUS, pendiente 7; recomendado Resend,
 * DECISIONS §138). Solo variables de servidor: RESEND_API_KEY y EMAIL_FROM
 * (p. ej. «L’Atelier du Désert <pedidos@latelierdudesert.com>», con el
 * dominio verificado en Resend: SPF y DKIM). Sin ellas los correos se quedan
 * en la cola y salen cuando se configuren.
 */
export function mailConfig(
  env: Record<string, string | undefined> = process.env,
): MailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim() ?? '';
  const from = env.EMAIL_FROM?.trim() ?? '';
  // «Nombre <dirección>» o solo la dirección.
  const address = /<([^<>\s]+)>$/.exec(from)?.[1] ?? from;
  if (!apiKey || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) return null;
  return { apiKey, from };
}

/**
 * Base de la API de Resend. Las pruebas de extremo a extremo apuntan a una
 * API simulada con RESEND_TEST_API_URL, que solo se acepta si es una
 * dirección local: fuera de las pruebas no cambia nada.
 */
export function resendApiBase(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env.RESEND_TEST_API_URL?.trim();
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
  return 'https://api.resend.com';
}
