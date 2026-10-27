import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Firma de un aviso de Sendcloud: HMAC-SHA256 en hexadecimal del cuerpo tal
 * como llega, con la clave secreta de la integración (o su «Webhook Signature
 * Key»), en la cabecera Sendcloud-Signature. Comparación en tiempo constante.
 */
export function validSendcloudSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature.trim())) return false;
  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest();
  const received = Buffer.from(signature.trim(), 'hex');
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
