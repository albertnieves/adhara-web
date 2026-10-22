'use server';

import { getTranslations } from 'next-intl/server';
import { createMessagesClient } from '@/lib/supabase/privileged';
import type { ContactState } from '../domain/contact';
import { contactFieldErrors, contactInput } from '../domain/contact';
import { contactEnabled } from './config';

/*
 * Formulario de contacto de la tienda (A6.1). Todo se comprueba aquí y otra
 * vez en la base (web_contact_submit, solo con la clave privilegiada, §154),
 * que aplica los límites por email y globales. Sin CONTACT_FORM no responde.
 */
export async function submitContact(
  _: ContactState,
  form: FormData,
): Promise<ContactState> {
  if (!contactEnabled()) return { status: 'error', error: 'disabled' };
  // Campo trampa invisible: los bots lo rellenan, las personas no.
  if (String(form.get('company') ?? '').trim())
    return { status: 'sent', number: null };
  const text = (name: string) => String(form.get(name) ?? '');
  const parsed = contactInput.safeParse({
    requestId: text('requestId'),
    locale: text('locale'),
    topic: text('topic'),
    fullName: text('fullName'),
    email: text('email'),
    orderNumber: text('orderNumber'),
    subject: text('subject'),
    message: text('message'),
  });
  if (!parsed.success) {
    const fields = contactFieldErrors(parsed.error.issues);
    return {
      status: 'error',
      error: Object.values(fields)[0] ?? 'generic',
      fields,
    };
  }
  const input = parsed.data;
  const t = await getTranslations({
    locale: input.locale,
    namespace: 'contact',
  });
  const supabase = createMessagesClient();
  if (!supabase) return { status: 'error', error: 'generic' };
  const { data, error } = await supabase.rpc('web_contact_submit', {
    p_request_id: input.requestId,
    p_locale: input.locale,
    p_topic: input.topic,
    p_full_name: input.fullName,
    p_email: input.email,
    p_subject: input.subject || t(`subjects.${input.topic}`),
    p_body: input.message,
    ...(input.orderNumber !== null && { p_order_number: input.orderNumber }),
  });
  if (error) {
    if (error.code === '54000') return { status: 'error', error: 'busy' };
    if (error.message === 'invalid_email')
      return {
        status: 'error',
        error: 'emailInvalid',
        fields: { email: 'emailInvalid' },
      };
    console.error('[contacto] no se pudo guardar la consulta', error.code);
    return { status: 'error', error: 'generic' };
  }
  const number = (data as { number?: unknown } | null)?.number;
  return { status: 'sent', number: typeof number === 'number' ? number : null };
}
