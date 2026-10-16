import type { EmailCopy, RenderedEmail } from './order-email';
import { EMAIL_COLORS } from './order-email';
import { escapeHtml, fill } from './text';

/*
 * Respuesta del personal a una consulta (bandeja de mensajes, A6.1). Puro:
 * recibe lo que da la cola de la base (web_message_emails_claim) y los textos
 * del idioma de la conversación. El texto de la respuesta es el que escribió
 * el personal, tal cual; debajo van la firma de la tienda y el último mensaje
 * del cliente, citado.
 */

/** Una fila de web_message_emails_claim. */
export type MessageEmailJob = {
  id: number;
  number: number;
  locale: 'es' | 'ca' | 'en';
  subject: string;
  body: string;
  full_name: string | null;
  email: string;
  token: string;
  quoted: string | null;
  in_reply_to: string | null;
};

export type MessageEmailContext = {
  /** Textos del espacio `messageEmail` de messages/{es,ca,en}.json. */
  copy: EmailCopy;
  store: { address: string };
  siteUrl: string;
};

export type RenderedMessageEmail = RenderedEmail & {
  /** Para que el programa del cliente la encadene con su correo. */
  headers: Record<string, string>;
};

const MESSAGE_ID = /^<[^<>\s]{1,296}>$/;

export function messageEmailSubject(
  subject: string,
  reference: string,
): string {
  const base = subject.replace(/^\s*((re|rv|fw|fwd)\s*:\s*)+/i, '').trim();
  const withReference = base.includes(reference)
    ? base
    : `${base} (${reference})`;
  return `Re: ${withReference}`.slice(0, 250);
}

export function renderMessageEmail(
  job: MessageEmailJob,
  ctx: MessageEmailContext,
): RenderedMessageEmail {
  const t = (key: string, values: Record<string, string> = {}) =>
    fill(ctx.copy[key], values);
  const reference = t('reference', { number: String(job.number) });
  const subject = messageEmailSubject(job.subject, reference);
  const signature = [t('signature'), ctx.store.address, ctx.siteUrl]
    .filter((line) => line.trim())
    .join('\n');
  const quoted = job.quoted?.trim() ?? '';

  const text = [
    job.body.trim(),
    signature,
    t('replyHint'),
    ...(quoted
      ? [
          `${t('quoteIntro')}\n${quoted
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n')}`,
        ]
      : []),
  ].join('\n\n');

  const lines = (s: string) => escapeHtml(s).replace(/\n/g, '<br>');
  const html = `<!doctype html><html lang="${job.locale}"><body style="margin:0;padding:24px;background:${EMAIL_COLORS.ivory};color:${EMAIL_COLORS.ink};font-family:Helvetica,Arial,sans-serif;font-size:15px"><div style="max-width:560px;margin:0 auto;background:${EMAIL_COLORS.paper};padding:32px"><p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px">L’Atelier du Désert</p><p style="margin:0 0 24px;line-height:1.5">${lines(job.body.trim())}</p><p style="margin:0 0 16px;color:${EMAIL_COLORS.smoke};font-size:13px;line-height:1.5">${lines(signature)}</p><p style="margin:0 0 16px;color:${EMAIL_COLORS.smoke};font-size:13px">${escapeHtml(t('replyHint'))}</p>${
    quoted
      ? `<p style="margin:24px 0 8px;color:${EMAIL_COLORS.smoke};font-size:13px">${escapeHtml(t('quoteIntro'))}</p><blockquote style="margin:0;padding:0 0 0 12px;border-left:2px solid ${EMAIL_COLORS.line};color:${EMAIL_COLORS.smoke};line-height:1.5">${lines(quoted)}</blockquote>`
      : ''
  }</div></body></html>`;

  const headers: Record<string, string> = {};
  if (job.in_reply_to && MESSAGE_ID.test(job.in_reply_to)) {
    headers['In-Reply-To'] = job.in_reply_to;
    headers.References = job.in_reply_to;
  }
  return { to: job.email, subject, text, html, attachments: [], headers };
}
