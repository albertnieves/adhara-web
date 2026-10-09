import 'server-only';
import { fetchAll } from '@/lib/supabase/paginate';
import type { StaffContext } from '@/modules/auth/server';
import type { Subscriber } from '../domain';

type Supabase = StaffContext['supabase'];

/** Suscriptores para el panel (RLS: customers.view), los más recientes primero. */
export async function listSubscribers(
  supabase: Supabase,
): Promise<Subscriber[]> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from('newsletter_subscribers')
      .select(
        'id, email, locale, source, consent_version, consented_at, unsubscribed_at, sender_synced_at',
      )
      .order('consented_at', { ascending: false })
      .order('id')
      .range(from, to),
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    locale: row.locale,
    source: row.source,
    consentVersion: row.consent_version,
    consentedAt: row.consented_at,
    unsubscribedAt: row.unsubscribed_at,
    senderSyncedAt: row.sender_synced_at,
  }));
}
