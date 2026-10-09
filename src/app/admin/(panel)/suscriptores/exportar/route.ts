import { toCsv } from '@/lib/csv';
import { requirePermission } from '@/modules/auth/server';
import { LOCALE_NAMES, subscriberStatus } from '@/modules/newsletter';
import { listSubscribers } from '@/modules/newsletter/server';

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Madrid',
});

const STATUS = {
  synced: 'En Sender',
  pending: 'Pendiente',
  unsubscribed: 'Baja',
} as const;

/** CSV de suscriptores activos y bajas, para importarlo en Sender o en Excel. */
export async function GET() {
  const { supabase } = await requirePermission('customers.view');
  const subscribers = await listSubscribers(supabase);
  await supabase.rpc('record_audit_event', {
    action: 'newsletter.export',
    entity: 'newsletter_subscribers',
    after: { rows: subscribers.length },
  });
  const csv = toCsv([
    ['email', 'Idioma', 'Alta', 'Consentimiento', 'Origen', 'Estado'],
    ...subscribers.map((s) => [
      s.email,
      LOCALE_NAMES[s.locale] ?? s.locale,
      DATE.format(new Date(s.consentedAt)),
      s.consentVersion,
      s.source,
      STATUS[subscriberStatus(s)],
    ]),
  ]);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="suscriptores-${day}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
