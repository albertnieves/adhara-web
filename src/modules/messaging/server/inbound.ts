import 'server-only';
import { createMessagesClient } from '@/lib/supabase/privileged';
import { resendApiBase } from '@/modules/mail/server';
import type { InboundEmail } from '../domain/inbound';
import {
  findReplyToken,
  parseReceivedEvent,
  readReceivedEmail,
} from '../domain/inbound';
import { inboundConfig, verifyWebhookSignature } from './config';

/*
 * Correo entrante (A6.1, DECISIONS §155): Resend avisa de cada correo que
 * llega al subdominio con un evento email.received firmado (Svix). Primero la
 * firma; después se lee el correo con su API (el evento no trae el cuerpo) y
 * la base decide si va a la conversación de la clave o abre otra. Hasta que
 * la base lo guarda no se responde 200, así Resend reintenta. Ni el cuerpo ni
 * el remitente se escriben en los registros.
 */

const MAX_BODY = 256 * 1024;

export async function receiveInboundEmail(request: Request): Promise<Response> {
  const { webhookKey, domain } = inboundConfig();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!webhookKey || !apiKey) return new Response(null, { status: 503 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY)
    return new Response(null, { status: 413 });
  const body = await request.text().catch(() => null);
  if (body === null) return new Response(null, { status: 400 });
  if (body.length > MAX_BODY) return new Response(null, { status: 413 });

  const signed = verifyWebhookSignature(
    webhookKey,
    {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    },
    body,
  );
  if (!signed) {
    console.warn('[correo entrante] firma no válida');
    return new Response(null, { status: 400 });
  }

  let event: ReturnType<typeof parseReceivedEvent>;
  try {
    event = parseReceivedEvent(JSON.parse(body));
  } catch {
    console.warn('[correo entrante] evento con otra forma');
    return new Response(null, { status: 400 });
  }
  // Otro tipo de evento del mismo webhook: recibido, sin nada que hacer.
  if (!event) return Response.json({ ok: true, action: 'ignored' });

  const email = await fetchReceivedEmail(apiKey, event.emailId);
  if (!email.ok) {
    console.error('[correo entrante] no se pudo leer el correo', email.error);
    return new Response(null, { status: 502 });
  }
  const supabase = createMessagesClient();
  if (!supabase) return new Response(null, { status: 503 });
  const { data, error } = await supabase.rpc('web_inbound_email_record', {
    p_inbound_id: event.emailId,
    p_token:
      findReplyToken(
        [...event.recipients, ...email.value.recipients],
        domain,
      ) ?? (null as unknown as string),
    p_from_email: email.value.fromEmail,
    p_from_name: email.value.fromName ?? (null as unknown as string),
    p_subject: email.value.subject,
    p_body: email.value.body,
    p_message_id: email.value.messageId ?? undefined,
    p_attachments: email.value.attachments,
    p_trusted: email.value.trusted,
  });
  if (error) {
    // Demasiados correos nuevos en una hora: que Resend lo reintente luego.
    if (error.code === '54000') return new Response(null, { status: 503 });
    // Un remitente sin forma de email no se puede contestar: se descarta.
    if (error.message === 'invalid_email')
      return Response.json({ ok: true, action: 'discarded' });
    console.error('[correo entrante] no se pudo guardar', error.code);
    return new Response(null, { status: 500 });
  }
  const action = (data as { action?: string } | null)?.action ?? 'saved';
  return Response.json({ ok: true, action });
}

type Fetched = { ok: true; value: InboundEmail } | { ok: false; error: string };

/** El correo recibido, de la API de Resend (GET /emails/receiving/:id). */
export async function fetchReceivedEmail(
  apiKey: string,
  emailId: string,
  fetcher: typeof fetch = fetch,
): Promise<Fetched> {
  let response: Response;
  try {
    response = await fetcher(
      `${resendApiBase()}/emails/receiving/${encodeURIComponent(emailId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    return { ok: false, error: 'network' };
  }
  if (!response.ok) return { ok: false, error: `http_${response.status}` };
  try {
    return { ok: true, value: readReceivedEmail(await response.json()) };
  } catch {
    return { ok: false, error: 'shape' };
  }
}
