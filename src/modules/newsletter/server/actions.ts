'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabasePublicClient } from '@/lib/supabase/public';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import type { SubscribeState } from '../domain';
import { CONSENT_VERSION, subscribeInput } from '../domain';
import {
  addToSender,
  deleteFromSender,
  senderConfigured,
  unsubscribeInSender,
} from './sender';

/**
 * Alta pública desde la tienda. Va por la función newsletter_subscribe (la
 * API pública no puede leer ni escribir la tabla) y, si Sender está
 * configurado, se envía también a su lista; si Sender falla, el panel la
 * envía después con «Enviar pendientes a Sender».
 */
export async function subscribeNewsletter(
  _: SubscribeState,
  form: FormData,
): Promise<SubscribeState> {
  // Campo trampa invisible: los bots lo rellenan, las personas no.
  if (String(form.get('company') ?? '').trim()) return { status: 'success' };
  const input = subscribeInput.safeParse({
    email: form.get('email'),
    consent: form.get('consent'),
    locale: form.get('locale'),
  });
  if (!input.success) {
    const consent = input.error.issues.some((i) => i.path[0] === 'consent');
    const email = input.error.issues.some((i) => i.path[0] === 'email');
    if (email) return { status: 'invalidEmail' };
    return { status: consent ? 'consentRequired' : 'error' };
  }
  const supabase = createSupabasePublicClient();
  if (!supabase) return { status: 'error' };
  const { error } = await supabase.rpc('newsletter_subscribe', {
    p_email: input.data.email,
    p_locale: input.data.locale,
    p_consent_version: CONSENT_VERSION,
    p_source: 'web',
  });
  if (error) {
    if (error.code === '54000') return { status: 'busy' };
    if (error.message === 'invalid_email') return { status: 'invalidEmail' };
    console.error('[newsletter] no se pudo guardar el alta', error.code);
    return { status: 'error' };
  }
  if (senderConfigured()) await addToSender(input.data.email);
  return { status: 'success' };
}

const BATCH = 200;

/** Envía a Sender las altas que aún no constan como enviadas. */
export async function syncSubscribersToSender(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  void form;
  const { supabase } = await requirePermission('customers.manage');
  if (!senderConfigured())
    return fail(
      'Sender no está configurado: añade SENDER_API_TOKEN en Vercel (solo servidor) o exporta el CSV e impórtalo en Sender.',
    );
  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('id, email')
    .is('unsubscribed_at', null)
    .is('sender_synced_at', null)
    .order('consented_at')
    .limit(BATCH);
  if (error) return fail(describeDbError(error));
  if (data.length === 0) return ok('No hay altas pendientes de enviar.');
  const sent: string[] = [];
  for (const row of data) {
    if (await addToSender(row.email)) sent.push(row.id);
  }
  if (sent.length > 0) {
    const update = await supabase
      .from('newsletter_subscribers')
      .update({ sender_synced_at: new Date().toISOString() })
      .in('id', sent);
    if (update.error) return fail(describeDbError(update.error));
    await supabase.rpc('record_audit_event', {
      action: 'newsletter.sender_sync',
      entity: 'newsletter_subscribers',
      after: { sent: sent.length, failed: data.length - sent.length },
    });
  }
  revalidatePath('/admin/suscriptores');
  const failed = data.length - sent.length;
  if (sent.length === 0)
    return fail('Sender no aceptó ninguna alta. Revisa el token y el grupo.');
  return ok(
    failed > 0
      ? `Enviadas ${sent.length} a Sender; ${failed} fallaron y siguen pendientes.`
      : `Enviadas ${sent.length} altas a Sender.`,
  );
}

const subscriberAction = z.object({
  id: z.uuid(),
  intent: z.enum(['unsubscribe', 'delete']),
});

/** Baja (deja de recibir) o borrado (derecho de supresión), también en Sender. */
export async function changeSubscriber(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const input = subscriberAction.safeParse(Object.fromEntries(form));
  if (!input.success) return fail('Revisa los datos.');
  const { id, intent } = input.data;
  const { supabase } = await requirePermission('customers.manage');
  const { data: row, error: readError } = await supabase
    .from('newsletter_subscribers')
    .select('email')
    .eq('id', id)
    .maybeSingle();
  if (readError) return fail(describeDbError(readError));
  if (!row) return fail('Ese suscriptor ya no existe.');
  const { error } =
    intent === 'delete'
      ? await supabase.from('newsletter_subscribers').delete().eq('id', id)
      : await supabase
          .from('newsletter_subscribers')
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq('id', id);
  if (error) return fail(describeDbError(error));
  // La auditoría no guarda el email: solo qué se hizo.
  await supabase.rpc('record_audit_event', {
    action:
      intent === 'delete' ? 'newsletter.delete' : 'newsletter.unsubscribe',
    entity: 'newsletter_subscribers',
    entity_id: id,
  });
  revalidatePath('/admin/suscriptores');
  const inSender =
    senderConfigured() &&
    (intent === 'delete'
      ? await deleteFromSender(row.email)
      : await unsubscribeInSender(row.email));
  const done = intent === 'delete' ? 'Suscriptor borrado' : 'Baja registrada';
  if (!senderConfigured()) return ok(`${done}. Hazlo también en Sender.`);
  return inSender
    ? ok(`${done} aquí y en Sender.`)
    : ok(`${done} aquí, pero Sender no respondió: hazlo también allí.`);
}
