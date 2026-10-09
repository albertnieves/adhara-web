import type { Metadata } from 'next';
import { Badge, Card, EmptyState, Table, buttonClass } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { LOCALE_NAMES, subscriberStatus } from '@/modules/newsletter';
import {
  SubscriberActions,
  SyncToSenderButton,
  listSubscribers,
  senderConfigured,
} from '@/modules/newsletter/server';

export const metadata: Metadata = { title: 'Suscriptores' };

/** Descarga de un Route Handler: enlace normal, no navegación del cliente. */
const EXPORT_URL = '/admin/suscriptores/exportar';

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

const STATUS: Record<
  ReturnType<typeof subscriberStatus>,
  { label: string; tone: BadgeTone }
> = {
  synced: { label: 'En Sender', tone: 'success' },
  pending: { label: 'Pendiente', tone: 'warning' },
  unsubscribed: { label: 'Baja', tone: 'neutral' },
};

/** Lista de suscriptores a promociones (sección antes del pie de la tienda). */
export default async function Subscribers() {
  const staff = await requirePermission('customers.view');
  const subscribers = await listSubscribers(staff.supabase);
  const canManage = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'customers.manage',
  );
  const active = subscribers.filter((s) => !s.unsubscribedAt);
  const pending = active.filter((s) => !s.senderSyncedAt).length;
  const sender = senderConfigured();
  return (
    <main>
      <PageHeader eyebrow="Web" title="Suscriptores a promociones">
        <a href={EXPORT_URL} className={buttonClass('outline')}>
          Exportar CSV
        </a>
      </PageHeader>

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-fg-muted text-xs">Suscritos</p>
          <p className="font-display mt-1 text-4xl tabular-nums">
            {active.length}
          </p>
        </Card>
        <Card>
          <p className="text-fg-muted text-xs">Pendientes de enviar a Sender</p>
          <p className="font-display mt-1 text-4xl tabular-nums">{pending}</p>
        </Card>
        <Card>
          <p className="text-fg-muted text-xs">Bajas</p>
          <p className="font-display mt-1 text-4xl tabular-nums">
            {subscribers.length - active.length}
          </p>
        </Card>
      </div>

      <Card className="mb-10">
        <p className="text-sm leading-relaxed">
          Las altas llegan desde la sección «Club L’Atelier» de la tienda, con
          el consentimiento expreso de cada persona.{' '}
          {sender
            ? 'Sender está conectado: cada alta se envía al momento y las que fallen quedan pendientes.'
            : 'Sender no está conectado: añade SENDER_API_TOKEN (y opcionalmente SENDER_GROUP_ID) en Vercel, solo servidor, o exporta el CSV e impórtalo en Sender.'}{' '}
          Las bajas que se hagan desde los correos de Sender se gestionan en
          Sender.
        </p>
        {canManage && sender && (
          <div className="mt-6">
            <SyncToSenderButton pending={pending} />
          </div>
        )}
      </Card>

      {subscribers.length === 0 ? (
        <EmptyState title="Todavía no hay suscriptores." />
      ) : (
        <div className="overflow-x-auto">
          <Table caption="Suscriptores" className="min-w-[44rem]">
            <thead>
              <tr>
                <th>Email</th>
                <th>Idioma</th>
                <th>Alta</th>
                <th>Estado</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {subscribers.map((subscriber) => {
                const status = STATUS[subscriberStatus(subscriber)];
                return (
                  <tr key={subscriber.id}>
                    <td className="break-all">{subscriber.email}</td>
                    <td className="text-sm">
                      {LOCALE_NAMES[subscriber.locale] ?? subscriber.locale}
                    </td>
                    <td className="text-sm tabular-nums">
                      {DATE.format(new Date(subscriber.consentedAt))}
                    </td>
                    <td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    {canManage && (
                      <td>
                        <SubscriberActions
                          id={subscriber.id}
                          email={subscriber.email}
                          active={!subscriber.unsubscribedAt}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </main>
  );
}
