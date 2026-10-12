import 'server-only';
import type { RenderedEmail } from '../domain/order-email';
import type { MailConfig } from './config';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export type SendResult =
  { ok: true; id: string } | { ok: false; error: string };

/**
 * Envía un correo con la API de Resend (sin SDK). La clave de idempotencia
 * hace que un reintento del mismo correo no lo mande dos veces. Los errores
 * se devuelven como código, sin el cuerpo de la respuesta (puede repetir la
 * dirección del cliente).
 */
export async function sendWithResend(
  config: MailConfig,
  email: RenderedEmail & { replyTo: string },
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<SendResult> {
  let response: Response;
  try {
    response = await fetcher(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [email.to],
        reply_to: email.replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: email.attachments.map((file) => ({
          filename: file.filename,
          content: Buffer.from(file.content, 'utf8').toString('base64'),
        })),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: 'network' };
  }
  if (!response.ok) return { ok: false, error: `http_${response.status}` };
  const body = (await response.json().catch(() => null)) as {
    id?: unknown;
  } | null;
  return typeof body?.id === 'string'
    ? { ok: true, id: body.id }
    : { ok: false, error: 'no_id' };
}
