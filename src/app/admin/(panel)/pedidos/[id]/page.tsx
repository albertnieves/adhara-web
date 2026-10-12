import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { formatEuros } from '@/lib/money';
import { PageHeader, PrintButton } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { mailConfig } from '@/modules/mail/server';
import { redsysConfig } from '@/modules/payments/server/config';
import {
  FULFILLMENT_LABELS,
  ORDER_EMAIL_LABELS,
  ORDER_EVENT_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_DECISION_LABELS,
  PAYMENT_OUTCOME_LABELS,
  PAYMENT_REASON_LABELS,
  REFUND_STATUS_LABELS,
  orderEmailBadge,
  orderStatusBadge,
  panelTransitions,
  refundOptions,
} from '@/modules/orders';
import type { WebOrderDetail } from '@/modules/orders/server';
import { getWebOrder } from '@/modules/orders/server';
import { OrderActions, RefundActions } from '@/modules/orders/ui';
import { Badge, Eyebrow, Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Pedido web' };

const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});
const TIME = new Intl.DateTimeFormat('es-ES', {
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});
const LOCALES: Record<string, string> = {
  es: 'Español',
  ca: 'Català',
  en: 'English',
};

function Section({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-border border-t py-10 ${className}`}>
      <h2 className="mb-6 text-2xl font-light">{title}</h2>
      {children}
    </section>
  );
}

function euros(cents: number) {
  return formatEuros(cents, 'es');
}

/** Qué pasó en cada evento, sin datos personales (la cronología no los guarda). */
function eventDetail(event: WebOrderDetail['events'][number]): string | null {
  const detail = event.detail ?? {};
  const reason =
    typeof detail.reason === 'string'
      ? (PAYMENT_REASON_LABELS[detail.reason] ??
        (detail.reason === 'expired' ? null : detail.reason))
      : null;
  const parts = [
    event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus
      ? `${ORDER_STATUS_LABELS[event.fromStatus]} → ${ORDER_STATUS_LABELS[event.toStatus]}`
      : null,
    reason,
    typeof detail.amount_cents === 'number' ? euros(detail.amount_cents) : null,
    typeof detail.reference === 'string' ? `ref. ${detail.reference}` : null,
    detail.inventory === 'sale_click_collect' ||
    detail.inventory === 'sale_online'
      ? 'unidades descontadas del stock'
      : null,
  ];
  const text = parts.filter(Boolean).join(' · ');
  return text || null;
}

export default async function WebOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requirePermission('orders.view');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const session = { role: staff.role, aal: 'aal2' as const };
  const canCustomers = isAllowed(session, 'customers.view');
  const detail = await getWebOrder(staff.supabase, id, {
    withCustomer: canCustomers,
  });
  if (!detail) notFound();
  const { order, lines, contact, attempts, payments, refunds, emails, events } =
    detail;
  const tpvReady = redsysConfig() !== null;
  const openRefund = refunds.find(
    (r) => r.status === 'requested' || r.status === 'unknown',
  );
  const refundChoices = tpvReady
    ? refundOptions(order, payments, session, { pending: Boolean(openRefund) })
    : [];
  const canRefund = isAllowed(session, 'orders.refund');
  const badge = orderStatusBadge(order);
  const incidents = payments.filter((p) => p.incidentOpen);
  const actions = panelTransitions(order, session);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <main>
      <PageHeader eyebrow="Pedido web" title={`Nº ${order.number}`}>
        <Link
          href="/admin/pedidos"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase print:hidden"
        >
          Todos los pedidos
        </Link>
        <span className="print:hidden">
          <PrintButton>Imprimir</PrintButton>
        </span>
      </PageHeader>

      <dl className="mb-8 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <Eyebrow as="dt">Estado</Eyebrow>
          <dd className="mt-1">
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Entrega</Eyebrow>
          <dd className="mt-1">
            {FULFILLMENT_LABELS[order.fulfillment]}
            {order.fulfillment === 'click_collect' && order.locationName && (
              <span className="text-fg-muted"> · {order.locationName}</span>
            )}
            {order.trackingReference && (
              <span className="text-fg-muted">
                {' '}
                · seguimiento {order.trackingReference}
              </span>
            )}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Fechas</Eyebrow>
          <dd className="mt-1">
            Creado {DATE_TIME.format(new Date(order.createdAt))}
            {order.paidAt &&
              ` · pagado ${DATE_TIME.format(new Date(order.paidAt))}`}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Total</Eyebrow>
          <dd className="mt-1 font-semibold tabular-nums">
            {euros(order.totalCents)}
            <span className="text-fg-muted font-normal">
              {' '}
              · {units} {units === 1 ? 'artículo' : 'artículos'}
            </span>
          </dd>
        </div>
      </dl>

      {order.status === 'pending_payment' && (
        <p className="text-fg-muted mb-8 max-w-2xl text-sm">
          {order.reservation === 'active'
            ? `Esperando la confirmación del banco. Las unidades quedan reservadas hasta las ${TIME.format(new Date(order.reservedUntil))}; si no llega el pago, vuelven al stock solas.`
            : 'La reserva caducó sin pago y las unidades volvieron al stock. No hay nada que preparar. Si el banco confirmara el pago después, el pedido pasaría a incidencias.'}
        </p>
      )}

      {(order.status === 'needs_attention' || incidents.length > 0) && (
        <div
          role="note"
          className="border-danger mb-8 max-w-3xl border-l-2 py-1 pl-4 text-sm"
        >
          <p className="text-danger font-semibold">Incidencia de pago</p>
          {incidents.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {incidents.map((p) => (
                <li key={p.id}>
                  {(p.reason && PAYMENT_REASON_LABELS[p.reason]) ?? p.reason} ·{' '}
                  {euros(p.amountCents)}
                  {p.currency !== 'EUR' && ` (${p.currency})`} · transacción{' '}
                  {p.transactionId}
                </li>
              ))}
            </ul>
          )}
          <p className="text-fg-muted mt-2">
            {order.status === 'needs_attention'
              ? 'Revisa el cobro en el portal del banco. Si es correcto, «Dar por pagado» lo pasa a la cola de preparación; si no, cancela y devuelve el dinero en «Devoluciones».'
              : 'El pedido sigue su curso. Devuelve lo cobrado de más en «Devoluciones».'}
          </p>
        </div>
      )}

      <div className="mb-10 print:hidden">
        <OrderActions
          orderId={order.id}
          revision={order.revision}
          actions={actions}
        />
      </div>

      <Section title="Artículos">
        <Table caption="Artículos del pedido" className="md:min-w-[36rem]">
          <thead>
            <tr>
              <th>Perfume</th>
              <th>SKU</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Precio</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.variantId}>
                <td data-primary className="text-sm">
                  <span className="text-fg-muted">{line.brandName} · </span>
                  {line.productName}
                  {(line.sizeMl || line.variantLabel) && (
                    <span className="text-fg-muted">
                      {' '}
                      · {line.variantLabel ?? `${line.sizeMl} ml`}
                    </span>
                  )}
                </td>
                <td data-label="SKU" className="text-fg-muted text-sm">
                  {line.sku ?? '—'}
                </td>
                <td
                  data-label="Cantidad"
                  className="text-right font-semibold tabular-nums"
                >
                  {line.quantity}
                </td>
                <td data-label="Precio" className="text-right tabular-nums">
                  {euros(line.unitPriceCents)}
                </td>
                <td data-label="Total" className="text-right tabular-nums">
                  {euros(line.lineTotalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <dl className="mt-4 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt className="text-fg-muted">Artículos</dt>
          <dd className="text-right tabular-nums">{euros(order.itemsCents)}</dd>
          <dt className="text-fg-muted">
            {order.fulfillment === 'click_collect' ? 'Recogida' : 'Envío'}
          </dt>
          <dd className="text-right tabular-nums">
            {order.shippingCents === 0
              ? 'Sin coste'
              : euros(order.shippingCents)}
          </dd>
          <dt className="font-semibold">Total con IVA</dt>
          <dd className="text-right font-semibold tabular-nums">
            {euros(order.totalCents)}
          </dd>
        </dl>
        <p className="text-fg-muted mt-3 text-right text-xs">
          Precios del momento de la compra; un cambio posterior del catálogo no
          los modifica.
        </p>
      </Section>

      <Section title="Cliente">
        {contact ? (
          <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <Eyebrow as="dt">Nombre</Eyebrow>
              <dd className="mt-1 font-semibold">{contact.fullName}</dd>
            </div>
            <div>
              <Eyebrow as="dt">Email</Eyebrow>
              <dd className="mt-1 break-all">
                <a href={`mailto:${contact.email}`} className="link-underline">
                  {contact.email}
                </a>
              </dd>
            </div>
            <div>
              <Eyebrow as="dt">Teléfono</Eyebrow>
              <dd className="mt-1">
                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}
                    className="link-underline"
                  >
                    {contact.phone}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <Eyebrow as="dt">Idioma</Eyebrow>
              <dd className="mt-1">{LOCALES[order.locale] ?? order.locale}</dd>
            </div>
            {contact.address.length > 0 && (
              <div className="sm:col-span-2">
                <Eyebrow as="dt">Dirección de envío</Eyebrow>
                <dd className="mt-1">
                  {contact.address.map((part) => (
                    <span key={part} className="block">
                      {part}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-fg-muted text-sm">
            Los datos del cliente solo los ve quien tiene el permiso de
            clientes.
          </p>
        )}
      </Section>

      <Section title="Pago" className="print:hidden">
        {attempts.length === 0 && payments.length === 0 ? (
          <p className="text-fg-muted text-sm">Sin datos de pago.</p>
        ) : (
          <>
            {payments.length === 0 ? (
              <p className="text-fg-muted mb-6 text-sm">
                Aún no ha llegado ninguna notificación del banco.
              </p>
            ) : (
              <div className="mb-6 overflow-x-auto">
                <Table
                  caption="Notificaciones del banco"
                  className="md:min-w-[44rem]"
                >
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Resultado</th>
                      <th className="text-right">Importe</th>
                      <th>Transacción</th>
                      <th>Efecto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td
                          data-primary
                          className="text-sm whitespace-nowrap tabular-nums"
                        >
                          {DATE_TIME.format(new Date(p.receivedAt))}
                        </td>
                        <td data-label="Resultado" className="text-sm">
                          {PAYMENT_OUTCOME_LABELS[p.outcome] ?? p.outcome}
                        </td>
                        <td
                          data-label="Importe"
                          className="text-right tabular-nums"
                        >
                          {p.currency === 'EUR'
                            ? euros(p.amountCents)
                            : `${p.amountCents} ${p.currency} (céntimos)`}
                        </td>
                        <td
                          data-label="Transacción"
                          className="text-fg-muted text-xs break-all"
                        >
                          {p.provider} · {p.transactionId}
                        </td>
                        <td data-label="Efecto" className="text-sm">
                          <Badge
                            tone={
                              p.decision === 'confirm'
                                ? 'success'
                                : p.incidentOpen
                                  ? 'danger'
                                  : 'neutral'
                            }
                          >
                            {p.incidentOpen === false
                              ? 'Incidencia resuelta'
                              : (PAYMENT_DECISION_LABELS[p.decision] ??
                                p.decision)}
                          </Badge>
                          {p.reason && (
                            <span className="text-fg-muted block text-xs">
                              {PAYMENT_REASON_LABELS[p.reason] ?? p.reason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
            <p className="text-fg-muted text-xs">
              Idas al banco:{' '}
              {attempts
                .map(
                  (a) =>
                    `${DATE_TIME.format(new Date(a.createdAt))} (ref. ${a.reference}, ${euros(a.amountCents)})`,
                )
                .join(' · ')}
              . Nunca se guardan datos de la tarjeta.
            </p>
          </>
        )}
      </Section>

      {(refunds.length > 0 || (canRefund && payments.length > 0)) && (
        <Section title="Devoluciones" className="print:hidden">
          {refunds.length > 0 && (
            <ul className="divide-border border-border mb-6 divide-y border-y text-sm">
              {refunds.map((refund) => {
                const status = REFUND_STATUS_LABELS[refund.status];
                return (
                  <li
                    key={refund.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
                  >
                    <span>
                      <span className="tabular-nums">
                        {euros(refund.amountCents)}
                      </span>
                      <span className="text-fg-muted">
                        {' · '}
                        {refund.toStatus
                          ? ORDER_STATUS_LABELS[refund.toStatus].toLowerCase()
                          : 'cobro de más'}
                        {' · '}
                        {DATE_TIME.format(new Date(refund.createdAt))}
                        {refund.actorName ? ` · ${refund.actorName}` : ''}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {(refund.responseCode || refund.error) && (
                        <span className="text-fg-muted text-xs">
                          {refund.responseCode
                            ? `Código ${refund.responseCode}`
                            : refund.error}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {openRefund?.status === 'unknown' && (
            <p className="text-warning mb-4 text-sm">
              El banco no respondió con claridad a la última devolución.
              Compruébala en el portal de Redsys antes de volver a enviarla.
            </p>
          )}
          {canRefund && tpvReady ? (
            <RefundActions
              orderId={order.id}
              revision={order.revision}
              options={refundChoices}
              unknownRefundId={
                openRefund?.status === 'unknown' ? openRefund.id : null
              }
            />
          ) : (
            canRefund && (
              <p className="text-fg-muted text-sm">
                El TPV aún no está conectado: las devoluciones se hacen en el
                portal del banco.
              </p>
            )
          )}
        </Section>
      )}

      <Section title="Correos al cliente" className="print:hidden">
        {emails.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Aún no hay correos: el primero sale al confirmarse el pago.
          </p>
        ) : (
          <ul className="divide-border border-border divide-y border-y text-sm">
            {emails.map((email) => {
              const status = orderEmailBadge(email);
              return (
                <li
                  key={email.kind}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
                >
                  <span>{ORDER_EMAIL_LABELS[email.kind] ?? email.kind}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span className="text-fg-muted text-xs tabular-nums">
                      {email.sentAt
                        ? DATE_TIME.format(new Date(email.sentAt))
                        : email.lastError
                          ? `Último error: ${email.lastError}`
                          : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {!mailConfig() && (
          <p className="text-fg-muted mt-3 text-xs">
            El correo aún no está configurado: los avisos esperan en la cola y
            saldrán en cuanto se configure el proveedor.
          </p>
        )}
      </Section>

      <Section title="Cronología" className="print:hidden">
        <ol className="divide-border border-border divide-y border-y">
          {events.map((event) => (
            <li
              key={event.id}
              className="grid gap-1 py-3 text-sm sm:grid-cols-[9rem_1fr_auto] sm:gap-4"
            >
              <span className="text-fg-muted tabular-nums">
                {DATE_TIME.format(new Date(event.at))}
              </span>
              <span>
                {ORDER_EVENT_LABELS[event.kind] ?? event.kind}
                {eventDetail(event) && (
                  <span className="text-fg-muted block text-xs">
                    {eventDetail(event)}
                  </span>
                )}
              </span>
              <span className="text-fg-muted text-xs">
                {event.byStaff ? event.actorName : 'Sistema'}
              </span>
            </li>
          ))}
        </ol>
      </Section>
    </main>
  );
}
