import 'server-only';
import { createMessagesClient } from '@/lib/supabase/privileged';
import { STORE_DEFAULTS, storeContent } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { siteUrl } from '@/modules/i18n/seo';
import { LEGAL_CONTACT_EMAIL } from '@/modules/legal';
import type { MessageEmailContext, MessageEmailJob } from '@/modules/mail';
import { renderMessageEmail } from '@/modules/mail';
import type { OutboxResult } from '@/modules/mail/server';
import { mailConfig, sendWithResend } from '@/modules/mail/server';
import ca from '../../../../messages/ca.json';
import en from '../../../../messages/en.json';
import es from '../../../../messages/es.json';
import { replyAddress } from '../domain/inbound';
import { inboundConfig } from './config';

type Locale = 'es' | 'ca' | 'en';
const COPY: Record<Locale, Record<string, string>> = {
  es: es.messageEmail,
  ca: ca.messageEmail,
  en: en.messageEmail,
};

/**
 * Envía las respuestas del panel que esperan en la cola (message_emails). La
 * llaman la respuesta del panel, justo después de guardarse, y la tarea
 * programada de correos. Sin proveedor configurado no toma nada: esperan en
 * la cola. «Responder a» es la dirección de la conversación en el subdominio
 * de Resend Inbound; sin él, el email de la tienda (DECISIONS §155).
 */
export async function sendMessageEmails(limit = 10): Promise<OutboxResult> {
  const config = mailConfig();
  const supabase = createMessagesClient();
  if (!config || !supabase) return { configured: false, sent: 0, failed: 0 };
  const { data, error } = await supabase.rpc('web_message_emails_claim', {
    p_limit: limit,
  });
  if (error) {
    console.error('[respuestas] no se pudo leer la cola', error.code);
    return { configured: true, sent: 0, failed: 0 };
  }
  const jobs = (data ?? []) as MessageEmailJob[];
  if (jobs.length === 0) return { configured: true, sent: 0, failed: 0 };

  const { domain } = inboundConfig();
  const storeData = await readStoreContent('store', 'es');
  const store = storeData
    ? storeContent.parse(storeData.payload)
    : STORE_DEFAULTS;
  const storeEmail = store.email || LEGAL_CONTACT_EMAIL;
  const contextFor = (locale: Locale): MessageEmailContext => ({
    copy: COPY[locale],
    store: { address: [store.address, store.city].filter(Boolean).join(', ') },
    siteUrl: new URL(`/${locale}`, siteUrl()).toString(),
  });

  let sent = 0;
  let failed = 0;
  for (const job of jobs) {
    let result: { ok: true; id: string } | { ok: false; error: string };
    try {
      const email = renderMessageEmail(job, contextFor(job.locale));
      result = await sendWithResend(
        config,
        {
          ...email,
          replyTo: domain ? replyAddress(job.token, domain) : storeEmail,
        },
        `message-email-${job.id}`,
      );
    } catch {
      result = { ok: false, error: 'render' };
    }
    const { error: saveError } = await supabase.rpc(
      'web_message_email_result',
      {
        p_message_id: job.id,
        p_ok: result.ok,
        ...(result.ok
          ? { p_provider_id: result.id }
          : { p_error: result.error }),
      },
    );
    if (saveError)
      console.error(
        '[respuestas] no se pudo guardar el resultado',
        saveError.code,
      );
    if (result.ok) sent += 1;
    else {
      failed += 1;
      console.warn('[respuestas] envío fallido', result.error);
    }
  }
  return { configured: true, sent, failed };
}
