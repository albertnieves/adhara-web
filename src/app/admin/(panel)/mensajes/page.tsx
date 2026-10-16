import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { mailConfig } from '@/modules/mail/server';
import {
  CHANNEL_LABELS,
  INBOX_VIEWS,
  INBOX_VIEW_LABELS,
  TOPIC_LABELS,
  conversationStatusBadge,
  inboxViewHref,
  matchesInboxView,
  parseInboxView,
} from '@/modules/messaging';
import {
  inboundConfig,
  listAssignees,
  listConversations,
} from '@/modules/messaging/server';
import { Badge, buttonClass, EmptyState, Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Mensajes' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

const LIMIT = 200;

export default async function Messages({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; borrada?: string }>;
}) {
  const staff = await requirePermission('messages.view');
  const session = { role: staff.role, aal: 'aal2' as const };
  const canCustomers = isAllowed(session, 'customers.view');
  const canReply = isAllowed(session, 'messages.reply');
  const params = await searchParams;
  const view = parseInboxView(params.vista);
  const me = staff.userId ?? '';
  const [conversations, assignees] = await Promise.all([
    listConversations(staff.supabase, { withCustomer: canCustomers }),
    listAssignees(staff.supabase),
  ]);
  const names = new Map(assignees.map((a) => [a.userId, a.name]));
  const visible = conversations.filter((c) => matchesInboxView(c, view, me));
  const views = INBOX_VIEWS.map((v) => ({
    view: v,
    count: conversations.filter((c) => matchesInboxView(c, v, me)).length,
  })).filter(
    ({ view: v, count }) =>
      count > 0 ||
      v === 'por-responder' ||
      v === 'todas' ||
      v === view ||
      (v === 'mias' && canReply),
  );
  const overdueCount = conversations.filter((c) => c.overdue).length;
  const inbound = inboundConfig();

  return (
    <main>
      <PageHeader eyebrow="Web" title="Mensajes">
        {canReply && (
          <Link
            href="/admin/mensajes/plantillas"
            className={buttonClass('outline')}
          >
            Plantillas
          </Link>
        )}
      </PageHeader>
      <p className="text-fg-muted mb-6 max-w-2xl text-sm leading-relaxed">
        Consultas del formulario de contacto de la web y correos de clientes. La
        respuesta sale por email desde la ficha de cada conversación. Una
        consulta está fuera de plazo si lleva más de 24 horas sin respuesta.
      </p>
      {params.borrada === '1' && (
        <p
          role="status"
          className="border-success/30 text-success bg-surface-raised/50 mb-6 max-w-2xl border-l-2 px-4 py-3 text-sm"
        >
          Conversación borrada.
        </p>
      )}
      {(!mailConfig() || !inbound.domain) && (
        <div
          role="note"
          className="border-accent mb-8 max-w-3xl border-l-2 py-1 pl-4 text-sm"
        >
          {!mailConfig() ? (
            <p>
              El correo aún no está configurado: las respuestas se guardan y
              esperan en la cola hasta que lo esté.
            </p>
          ) : (
            <p>
              Las contestaciones de los clientes aún no vuelven aquí: llegan al
              email de la tienda hasta que se configure el subdominio de
              respuestas (INBOUND_EMAIL_DOMAIN).
            </p>
          )}
        </div>
      )}

      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Filtro por estado">
        {views.map(({ view: v, count }) => (
          <Link
            key={v}
            href={inboxViewHref(v)}
            aria-current={view === v ? 'page' : undefined}
            className={buttonClass(view === v ? 'primary' : 'outline')}
          >
            {INBOX_VIEW_LABELS[v]} · {count}
          </Link>
        ))}
      </nav>

      {conversations.length === 0 ? (
        <EmptyState
          title="Aún no hay mensajes"
          description="Cuando un cliente escriba desde el formulario de contacto o por email, su consulta aparecerá aquí."
        />
      ) : visible.length === 0 ? (
        <p className="text-fg-muted py-16 text-center">
          Ninguna conversación en esta vista.
          {overdueCount > 0 && view !== 'por-responder' && (
            <> Hay {overdueCount} fuera de plazo en «Por responder».</>
          )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table caption="Conversaciones" className="md:min-w-[48rem]">
            <thead>
              <tr>
                <th>Consulta</th>
                {canCustomers && <th>Cliente</th>}
                <th>Canal</th>
                <th>Asignada</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, LIMIT).map((conversation) => {
                const badge = conversationStatusBadge(conversation.status);
                return (
                  <tr key={conversation.id}>
                    <td data-primary>
                      <Link
                        href={`/admin/mensajes/${conversation.id}`}
                        className="link-underline font-semibold wrap-anywhere"
                      >
                        {conversation.subject}
                      </Link>
                      <p className="text-fg-muted text-xs tabular-nums">
                        Nº {conversation.number} ·{' '}
                        {DATE.format(new Date(conversation.lastMessageAt))}
                      </p>
                    </td>
                    {canCustomers && (
                      <td
                        data-label="Cliente"
                        className="text-sm wrap-anywhere"
                      >
                        {conversation.customerName ?? '—'}
                      </td>
                    )}
                    <td data-label="Canal" className="text-sm">
                      <span>
                        {CHANNEL_LABELS[conversation.channel]}
                        {conversation.channel === 'web_form' && (
                          <span className="text-fg-muted">
                            {' '}
                            · {TOPIC_LABELS[conversation.topic].toLowerCase()}
                          </span>
                        )}
                      </span>
                    </td>
                    <td data-label="Asignada" className="text-sm">
                      {conversation.assignedTo
                        ? (names.get(conversation.assignedTo) ?? 'Personal')
                        : '—'}
                    </td>
                    <td data-label="Estado">
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                        {conversation.overdue && (
                          <Badge tone="danger">Fuera de plazo</Badge>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {visible.length > LIMIT && (
            <p className="text-fg-muted mt-4 text-sm">
              Se muestran las {LIMIT} más recientes.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
