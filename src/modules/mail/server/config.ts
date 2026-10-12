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
