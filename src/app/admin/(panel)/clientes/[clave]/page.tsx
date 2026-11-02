import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge, Eyebrow, Table, buttonClass } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import {
  NEWSLETTER_LABELS,
  contactLines,
  displayName,
  isCustomerKey,
} from '@/modules/customers';
import { getCustomer } from '@/modules/customers/server';
import { CHANNEL_LABELS, conversationStatusBadge } from '@/modules/messaging';
import { FULFILLMENT_LABELS, orderStatusBadge } from '@/modules/orders';

export const metadata: Metadata = { title: 'Ficha de cliente' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});
const DAY = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long',
  timeZone: 'Europe/Madrid',
});
const LOCALES: Record<string, string> = {
  es: 'Español',
  ca: 'Català',
  en: 'English',
};

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-border border-t py-10">
      <h2 id={id} className="mb-6 text-2xl font-light">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Ficha de cliente (A7, DECISIONS §184): datos de contacto, consentimientos,
 * pedidos y mensajes de un email, y sus derechos. La URL lleva una clave
 * opaca, nunca el email.
 */
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ clave: string }>;
}) {
  const staff = await requirePermission('customers.view');
  const { clave } = await params;
  if (!isCustomerKey(clave)) notFound();
  const customer = await getCustomer(staff.supabase, clave);
  if (!customer) notFound();
  const session = { role: staff.role, aal: 'aal2' as const };
  const canOrders = isAllowed(session, 'orders.view');
  const canMessages = isAllowed(session, 'messages.view');
  const canExport = isAllowed(session, 'customers.manage');
  const name = displayName(customer);
  const contacts = contactLines(customer);
  const { account, newsletter } = customer;
  const paid = customer.orders.filter((order) => order.paid_at !== null);
  const net = paid.reduce(
    (sum, order) => sum + order.total_cents - order.refunded_cents,
    0,
  );

  return (
    <main>
      <PageHeader eyebrow="Clientes" title={name ?? customer.email}>
        <Link href="/admin/clientes" className={buttonClass('outline')}>
          Todos los clientes
        </Link>
        {canExport && (
          // Descarga de un Route Handler: enlace normal, sin precarga.
          <a
            href={`/admin/clientes/${customer.key}/exportar`}
            className={buttonClass('primary')}
          >
            Descargar sus datos
          </a>
        )}
      </PageHeader>

      <dl className="mb-8 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <Eyebrow as="dt">Email</Eyebrow>
          <dd className="mt-1 break-all">{customer.email}</dd>
        </div>
        <div>
          <Eyebrow as="dt">Pedidos</Eyebrow>
          <dd className="mt-1 tabular-nums">
            {customer.orders.length}
            {customer.orders.length > 0 && (
              <span className="text-fg-muted">
                {' '}
                · {paid.length} {paid.length === 1 ? 'pagado' : 'pagados'}
              </span>
            )}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Cobrado</Eyebrow>
          <dd className="mt-1 tabular-nums">
            {paid.length > 0 ? formatEuros(net, 'es') : '—'}
            {paid.length > 0 && (
              <span className="text-fg-muted block text-xs">
                Menos lo devuelto por el banco
              </span>
            )}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Mensajes</Eyebrow>
          <dd className="mt-1 tabular-nums">{customer.conversations.length}</dd>
        </div>
      </dl>

      <Section title="Contacto" id="contacto">
        {contacts.length === 0 ? (
          <p className="text-fg-muted text-sm">Solo el email.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table caption="Datos de contacto" className="md:min-w-[36rem]">
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Valor</th>
                  <th>De dónde sale</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((line) => (
                  <tr key={`${line.label}-${line.value}`}>
                    <td data-label="Dato" className="text-sm">
                      {line.label}
                    </td>
                    <td data-primary className="wrap-anywhere">
                      {line.value}
                    </td>
                    <td
                      data-label="De dónde sale"
                      className="text-fg-muted text-sm"
                    >
                      {line.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="Consentimientos y cuenta" id="consentimientos">
        <dl className="grid max-w-3xl gap-6 text-sm sm:grid-cols-2">
          <div>
            <Eyebrow as="dt">Club L’Atelier</Eyebrow>
            <dd className="mt-2 leading-relaxed">
              {newsletter ? (
                <>
                  <Badge
                    tone={newsletter.unsubscribed_at ? 'neutral' : 'success'}
                  >
                    {
                      NEWSLETTER_LABELS[
                        newsletter.unsubscribed_at
                          ? 'unsubscribed'
                          : 'subscribed'
                      ]
                    }
                  </Badge>
                  <span className="mt-2 block">
                    Alta el {DAY.format(new Date(newsletter.consented_at))} con
                    el texto «{newsletter.consent_version}» (
                    {LOCALES[newsletter.locale] ?? newsletter.locale}).
                  </span>
                  {newsletter.unsubscribed_at && (
                    <span className="block">
                      Baja el {DAY.format(new Date(newsletter.unsubscribed_at))}
                      .
                    </span>
                  )}
                </>
              ) : (
                <span className="text-fg-muted">No se ha unido.</span>
              )}
            </dd>
          </div>
          <div>
            <Eyebrow as="dt">Cuenta de cliente</Eyebrow>
            <dd className="mt-2 leading-relaxed">
              {account ? (
                <>
                  Creada el {DAY.format(new Date(account.created_at))}, en{' '}
                  {LOCALES[account.locale] ?? account.locale}.
                  <span className="text-fg-muted block">
                    {account.last_sign_in_at
                      ? `Último acceso: ${DATE.format(new Date(account.last_sign_in_at))}.`
                      : 'No ha entrado todavía.'}
                  </span>
                </>
              ) : (
                <span className="text-fg-muted">Sin cuenta.</span>
              )}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Pedidos web" id="pedidos">
        {customer.orders.length === 0 ? (
          <p className="text-fg-muted text-sm">Ningún pedido web.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table caption="Pedidos del cliente" className="md:min-w-[44rem]">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Entrega</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Devuelto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => {
                  const badge = orderStatusBadge(order);
                  return (
                    <tr key={order.id}>
                      <td data-primary>
                        {canOrders ? (
                          <Link
                            href={`/admin/pedidos/${order.id}`}
                            className="link-underline font-semibold tabular-nums"
                          >
                            Nº {order.number}
                          </Link>
                        ) : (
                          <span className="font-semibold tabular-nums">
                            Nº {order.number}
                          </span>
                        )}
                        <p className="text-fg-muted text-xs">
                          {DATE.format(new Date(order.created_at))}
                          {order.with_account && ' · con su cuenta'}
                        </p>
                      </td>
                      <td data-label="Entrega" className="text-sm">
                        {FULFILLMENT_LABELS[order.fulfillment]}
                      </td>
                      <td
                        data-label="Total"
                        className="text-right tabular-nums"
                      >
                        {formatEuros(order.total_cents, 'es')}
                      </td>
                      <td
                        data-label="Devuelto"
                        className="text-right tabular-nums"
                      >
                        {order.refunded_cents > 0
                          ? formatEuros(order.refunded_cents, 'es')
                          : '—'}
                      </td>
                      <td data-label="Estado">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="Mensajes" id="mensajes">
        {customer.conversations.length === 0 ? (
          <p className="text-fg-muted text-sm">Ningún mensaje.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table caption="Consultas del cliente" className="md:min-w-[44rem]">
              <thead>
                <tr>
                  <th>Consulta</th>
                  <th>Canal</th>
                  <th>Último mensaje</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {customer.conversations.map((conversation) => {
                  const badge = conversationStatusBadge(conversation.status);
                  return (
                    <tr key={conversation.id}>
                      <td data-primary className="max-w-96">
                        {canMessages ? (
                          <Link
                            href={`/admin/mensajes/${conversation.id}`}
                            className="link-underline font-semibold tabular-nums"
                          >
                            Nº {conversation.number}
                          </Link>
                        ) : (
                          <span className="font-semibold tabular-nums">
                            Nº {conversation.number}
                          </span>
                        )}
                        <p className="text-sm wrap-anywhere">
                          {conversation.subject}
                        </p>
                        {conversation.order_number !== null && (
                          <p className="text-fg-muted text-xs tabular-nums">
                            Pedido Nº {conversation.order_number}
                          </p>
                        )}
                      </td>
                      <td data-label="Canal" className="text-sm">
                        {CHANNEL_LABELS[conversation.channel]}
                      </td>
                      <td
                        data-label="Último mensaje"
                        className="text-sm tabular-nums"
                      >
                        {DATE.format(new Date(conversation.last_message_at))}
                      </td>
                      <td data-label="Estado">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="Derechos del cliente" id="derechos">
        <ul className="max-w-3xl list-disc space-y-3 pl-5 text-sm leading-relaxed">
          <li>
            <strong>Acceso:</strong>{' '}
            {canExport
              ? '«Descargar sus datos» genera un archivo con todo lo que hay de este email (pedidos, mensajes, Club y cuenta). Incluye las notas internas de los mensajes, marcadas como «note»: revisa el archivo antes de enviarlo. La descarga queda en la auditoría.'
              : 'La descarga de sus datos la hace quien tiene el permiso de gestionar clientes.'}
          </li>
          <li>
            <strong>Rectificación:</strong> los datos de la cuenta los cambia el
            cliente en «Mis datos»; los de un pedido ya hecho no se reescriben.
          </li>
          <li>
            <strong>Supresión:</strong> los mensajes se borran desde su consulta
            en Mensajes, la suscripción desde Suscriptores y la cuenta la borra
            el cliente desde «Mis datos». Los pedidos se conservan por las
            obligaciones fiscales y contables; el plazo lo confirma la asesoría.
          </li>
          <li>
            <strong>Oposición a las promociones:</strong> dar de baja la
            suscripción en Suscriptores (y en Sender, si ya se le envió).
          </li>
        </ul>
      </Section>
    </main>
  );
}
