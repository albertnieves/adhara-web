import { receiveInboundEmail } from '@/modules/messaging/server';

/**
 * Correo entrante de Resend Inbound (A6.1, DECISIONS §155): el evento
 * email.received del subdominio de respuestas. Firma Svix comprobada antes de
 * leer nada; sin RESEND_WEBHOOK_SECRET y RESEND_API_KEY responde 503.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export function POST(request: Request) {
  return receiveInboundEmail(request);
}
