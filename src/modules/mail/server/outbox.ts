import 'server-only';
import { createOrdersClient } from '@/lib/supabase/privileged';
import { STORE_DEFAULTS, storeContent } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { getPathname } from '@/modules/i18n';
import { siteUrl } from '@/modules/i18n/seo';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_COPY,
  LEGAL_ENTITY,
  LEGAL_PATHS,
  LEGAL_UPDATED_AT,
  legalDocumentText,
  resolveValue,
} from '@/modules/legal';
import { legalValues } from '@/modules/legal/server';
import ca from '../../../../messages/ca.json';
import en from '../../../../messages/en.json';
import es from '../../../../messages/es.json';
import type { OrderEmailContext, OrderEmailJob } from '../domain/order-email';
import { renderOrderEmail } from '../domain/order-email';
import { mailConfig } from './config';
import { sendWithResend } from './resend';

type Locale = 'es' | 'ca' | 'en';
const COPY: Record<Locale, Record<string, string>> = {
  es: es.email,
  ca: ca.email,
  en: en.email,
};

export type OutboxResult = {
  configured: boolean;
  sent: number;
  failed: number;
};

/**
 * Envía los correos pendientes de los pedidos (cola order_emails). Lo llaman
 * la tarea programada y, en cuanto se confirma un pago o cambia la entrega,
 * el propio servidor después de responder. Sin proveedor configurado no toma
 * nada: los correos esperan en la cola.
 */
export async function sendOrderEmails(limit = 10): Promise<OutboxResult> {
  const config = mailConfig();
  const supabase = createOrdersClient();
  if (!config || !supabase) return { configured: false, sent: 0, failed: 0 };
  const { data, error } = await supabase.rpc('web_order_emails_claim', {
    p_limit: limit,
  });
  if (error) {
    console.error('[correo] no se pudo leer la cola', error.code);
    return { configured: true, sent: 0, failed: 0 };
  }
  const jobs = (data ?? []) as OrderEmailJob[];
  if (jobs.length === 0) return { configured: true, sent: 0, failed: 0 };

  const contexts = new Map<Locale, Promise<OrderEmailContext>>();
  const contextFor = (locale: Locale) => {
    let context = contexts.get(locale);
    if (!context) {
      context = buildContext(locale);
      contexts.set(locale, context);
    }
    return context;
  };

  let sent = 0;
  let failed = 0;
  for (const job of jobs) {
    let result: { ok: true; id: string } | { ok: false; error: string };
    try {
      const context = await contextFor(job.locale);
      const email = renderOrderEmail(job, context);
      result = await sendWithResend(
        config,
        { ...email, replyTo: context.store.email },
        `order-email-${job.id}`,
      );
    } catch {
      result = { ok: false, error: 'render' };
    }
    const { error: saveError } = await supabase.rpc('web_order_email_result', {
      p_id: job.id,
      p_ok: result.ok,
      ...(result.ok ? { p_provider_id: result.id } : { p_error: result.error }),
    });
    if (saveError)
      console.error('[correo] no se pudo guardar el resultado', saveError.code);
    if (result.ok) sent += 1;
    else {
      failed += 1;
      console.warn('[correo] envío fallido', job.kind, result.error);
    }
  }
  return { configured: true, sent, failed };
}

async function buildContext(locale: Locale): Promise<OrderEmailContext> {
  const data = await readStoreContent('store', 'es');
  const store = data ? storeContent.parse(data.payload) : STORE_DEFAULTS;
  const base = siteUrl();
  const url = (href: (typeof LEGAL_PATHS)[keyof typeof LEGAL_PATHS]) =>
    new URL(getPathname({ locale, href }), base).toString();
  const holder = resolveValue(LEGAL_ENTITY.holder, locale);
  const taxId = resolveValue(LEGAL_ENTITY.taxId, locale);
  const registered = resolveValue(LEGAL_ENTITY.registeredAddress, locale);
  const updated = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${LEGAL_UPDATED_AT}T00:00:00Z`));
  return {
    copy: COPY[locale],
    store: {
      address: [store.address, store.city].filter(Boolean).join(', '),
      hours: store.hours,
      email: store.email || LEGAL_CONTACT_EMAIL,
    },
    seller:
      holder && taxId && registered
        ? { holder, taxId, address: registered }
        : null,
    returnsUrl: url(LEGAL_PATHS.shipping),
    terms: legalDocumentText(
      LEGAL_COPY[locale],
      'terms',
      await legalValues(locale),
      {
        href: (doc, hash) =>
          `${url(LEGAL_PATHS[doc])}${hash ? `#${hash}` : ''}`,
        updated,
      },
    ),
  };
}
