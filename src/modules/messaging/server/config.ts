import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Interruptor del formulario de contacto (DECISIONS §153). Sin CONTACT_FORM=1
 * la página responde 404, la acción no hace nada y el pie no la enlaza. Se lee
 * al generar cada página: cambiarlo exige volver a desplegar.
 */
export function contactEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CONTACT_FORM === '1';
}

export type InboundConfig = {
  /** Subdominio que recibe Resend Inbound (registro MX), o null. */
  domain: string | null;
  /** Secreto de firma del webhook (whsec_…), ya decodificado, o null. */
  webhookKey: Buffer | null;
};

const DOMAIN =
  /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Correo entrante (DECISIONS §155): INBOUND_EMAIL_DOMAIN (p. ej.
 * respuestas.latelierdudesert.com) y RESEND_WEBHOOK_SECRET, solo servidor.
 * Sin el dominio, las respuestas llevan como «Responder a» el email de la
 * tienda; sin el secreto, el webhook no procesa nada.
 */
export function inboundConfig(
  env: Record<string, string | undefined> = process.env,
): InboundConfig {
  const domain = env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase() ?? '';
  const secret = env.RESEND_WEBHOOK_SECRET?.trim() ?? '';
  let webhookKey: Buffer | null = null;
  if (secret.startsWith('whsec_')) {
    const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
    if (key.length >= 16) webhookKey = key;
  }
  return { domain: DOMAIN.test(domain) ? domain : null, webhookKey };
}

/** Margen de la hora firmada frente a la del servidor: 5 minutos. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

/**
 * Firma de los webhooks de Resend (Svix): HMAC-SHA256 en base64 de
 * «id.timestamp.cuerpo» con el secreto decodificado; la cabecera trae una o
 * varias firmas «v1,<base64>» separadas por espacios. Se compara en tiempo
 * constante y se rechaza una hora fuera de margen (repetición).
 */
export function verifyWebhookSignature(
  key: Buffer,
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  },
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !/^[0-9]{1,12}$/.test(timestamp))
    return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS)
    return false;
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest();
  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',', 2);
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
