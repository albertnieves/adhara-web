import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { mailConfig } from '@/modules/mail/server';
import {
  CHANNEL_LABELS,
  MESSAGE_KIND_LABELS,
  TOPIC_LABELS,
  conversationStatusBadge,
  messageEmailBadge,
  statusActions,
} from '@/modules/messaging';
import type { ConversationMessage } from '@/modules/messaging/server';
import {
  getConversation,
  inboundConfig,
  listAssignees,
  listMessageTemplates,
} from '@/modules/messaging/server';
import {
  AssignForm,
  DeleteConversationForm,
  NoteForm,
  OrderLinkForm,
  ReplyForm,
  StatusForm,
} from '@/modules/messaging/ui';
import { Badge, Eyebrow } from '@/components/ui';

export const metadata: Metadata = { title: 'Conversación' };

const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});
const LOCALES: Record<string, string> = {
  es: 'Español',
  ca: 'Català',
  en: 'English',
};
const SOURCES: Record<ConversationMessage['source'], string> = {
  web_form: 'formulario web',
  email: 'email',
  panel: 'panel',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border border-t py-10">
      <h2 className="mb-6 text-2xl font-light">{title}</h2>
      {children}
    </section>
  );
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requirePermission('messages.view');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const session = { role: staff.role, aal: 'aal2' as const };
  const canCustomers = isAllowed(session, 'customers.view');
  const canReply = isAllowed(session, 'messages.reply');
  const canDelete = isAllowed(session, 'customers.manage');
  const canOrders = isAllowed(session, 'orders.view');
  const [detail, assignees, templates] = await Promise.all([
    getConversation(staff.supabase, id, { withCustomer: canCustomers }),
    listAssignees(staff.supabase),
    canReply
      ? listMessageTemplates(staff.supabase, { onlyActive: true })
      : Promise.resolve([]),
  ]);
  if (!detail) notFound();
  const { conversation, contact, messages, order } = detail;
  const names = new Map(assignees.map((a) => [a.userId, a.name]));
  const badge = conversationStatusBadge(conversation.status);
  const mailReady = mailConfig() !== null;
  const repliesReturn = inboundConfig().domain !== null;

  return (
    <main>
      <PageHeader
        eyebrow="Mensajes"
        title={`Consulta nº ${conversation.number}`}
      >
        <Link
          href="/admin/mensajes"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Todos los mensajes
        </Link>
      </PageHeader>
      <p className="font-display mb-8 max-w-3xl text-2xl font-light wrap-anywhere">
        {conversation.subject}
      </p>

      <dl className="mb-8 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <Eyebrow as="dt">Estado</Eyebrow>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {conversation.overdue && (
              <Badge tone="danger">Fuera de plazo</Badge>
            )}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Cliente</Eyebrow>
          <dd className="mt-1 wrap-anywhere">
            {contact ? (
              <>
                {contact.fullName ?? 'Sin nombre'}
                <span className="text-fg-muted block">{contact.email}</span>
              </>
            ) : (
              <span className="text-fg-muted">
                Visible con permiso de clientes
              </span>
            )}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Canal</Eyebrow>
          <dd className="mt-1">
            {CHANNEL_LABELS[conversation.channel]}
            {conversation.channel === 'web_form' && (
              <span className="text-fg-muted">
                {' '}
                · {TOPIC_LABELS[conversation.topic].toLowerCase()}
              </span>
            )}
            <span className="text-fg-muted">
              {' '}
              · {LOCALES[conversation.locale]}
            </span>
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Pedido</Eyebrow>
          <dd className="mt-1">
            {order ? (
              canOrders ? (
                <Link
                  href={`/admin/pedidos/${order.id}`}
                  className="link-underline font-semibold tabular-nums"
                >
                  Nº {order.number}
                </Link>
              ) : (
                <span className="tabular-nums">Nº {order.number}</span>
              )
            ) : (
              <span className="text-fg-muted">Sin pedido enlazado</span>
            )}
          </dd>
        </div>
      </dl>

      <Section title="Conversación">
        <ol className="flex max-w-3xl flex-col gap-4">
          {messages.map((message) => {
            const email =
              message.kind === 'reply'
                ? messageEmailBadge(message.emailStatus)
                : null;
            const author =
              message.kind === 'customer'
                ? (contact?.fullName ?? 'Cliente')
                : message.authorId
                  ? (names.get(message.authorId) ?? 'Personal')
                  : 'Personal';
            return (
              <li
                key={message.id}
                className={`border-l-2 px-4 py-3 ${
                  message.kind === 'customer'
                    ? 'border-border-strong'
                    : message.kind === 'reply'
                      ? 'border-accent bg-surface-raised/50'
                      : 'border-warning bg-surface-raised/50'
                }`}
              >
                <p className="text-fg-muted mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="text-fg font-semibold">
                    {MESSAGE_KIND_LABELS[message.kind]}
                  </span>
                  <span>· {author}</span>
                  <span>· {DATE_TIME.format(new Date(message.createdAt))}</span>
                  {message.kind === 'customer' && (
                    <span>· por {SOURCES[message.source]}</span>
                  )}
                  {message.attachments > 0 && (
                    <span>
                      · {message.attachments}{' '}
                      {message.attachments === 1
                        ? 'adjunto no guardado'
                        : 'adjuntos no guardados'}
                    </span>
                  )}
                  {email && <Badge tone={email.tone}>{email.label}</Badge>}
                </p>
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {message.body}
                </p>
              </li>
            );
          })}
        </ol>
      </Section>

      {canReply && (
        <Section title="Responder">
          {!mailReady && (
            <p className="text-fg-muted mb-6 max-w-2xl text-sm">
              El correo aún no está configurado: la respuesta se guarda y saldrá
              cuando lo esté.
            </p>
          )}
          {mailReady && !repliesReturn && (
            <p className="text-fg-muted mb-6 max-w-2xl text-sm">
              Si el cliente contesta, su correo llegará al email de la tienda,
              no aquí, hasta que se configure el subdominio de respuestas.
            </p>
          )}
          <ReplyForm
            conversationId={conversation.id}
            revision={conversation.revision}
            locale={conversation.locale}
            templates={templates.map(
              ({ id: templateId, title, locale, body }) => ({
                id: templateId,
                title,
                locale,
                body,
              }),
            )}
            disabled={
              conversation.status === 'spam'
                ? 'Está marcada como spam: reábrela si no lo es para poder responder.'
                : undefined
            }
          />
          <div className="mt-10">
            <NoteForm conversationId={conversation.id} />
          </div>
        </Section>
      )}

      {canReply && (
        <Section title="Gestión">
          <div className="grid max-w-4xl gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Eyebrow as="h3">Estado</Eyebrow>
              <StatusForm
                conversationId={conversation.id}
                revision={conversation.revision}
                actions={statusActions(conversation.status)}
              />
            </div>
            <AssignForm
              conversationId={conversation.id}
              revision={conversation.revision}
              assignedTo={conversation.assignedTo}
              assignees={assignees}
            />
            {canOrders && (
              <OrderLinkForm
                conversationId={conversation.id}
                revision={conversation.revision}
                orderNumber={order?.number ?? null}
              />
            )}
            {canDelete && (
              <div className="flex flex-col gap-3">
                <Eyebrow as="h3">Borrar</Eyebrow>
                <DeleteConversationForm
                  conversationId={conversation.id}
                  revision={conversation.revision}
                  number={conversation.number}
                />
              </div>
            )}
          </div>
        </Section>
      )}
    </main>
  );
}
