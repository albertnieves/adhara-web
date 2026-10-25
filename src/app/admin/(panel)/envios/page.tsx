import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { ORDER_STATUS_LABELS } from '@/modules/orders';
import type { OrderStatus } from '@/modules/orders';
import {
  HANDOVER_LABELS,
  PICKUP_API_CARRIERS,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONES,
  nextWorkingDays,
  weightText,
} from '@/modules/shipping';
import type { BoardShipment } from '@/modules/shipping/server';
import {
  getShippingBoard,
  getShippingSettings,
  listServiceSummaries,
  sendcloudConfig,
} from '@/modules/shipping/server';
import { PickupForm } from '@/modules/shipping/ui';
import { Badge, Card, Eyebrow, Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Envíos' };
export const dynamic = 'force-dynamic';

const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="border-border border-t py-10">
      <h2 className="mb-6 text-2xl font-light">
        {title}{' '}
        <span className="text-fg-muted text-base tabular-nums">({count})</span>
      </h2>
      {children}
    </section>
  );
}

function ShipmentTable({
  caption,
  rows,
}: {
  caption: string;
  rows: BoardShipment[];
}) {
  return (
    <div className="overflow-x-auto">
      <Table caption={caption} className="md:min-w-[48rem]">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Transportista</th>
            <th>Seguimiento</th>
            <th>Estado</th>
            <th>Entrega</th>
            <th>Último aviso</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td data-primary className="text-sm">
                <Link
                  href={`/admin/pedidos/${s.orderId}`}
                  className="link-underline"
                >
                  Nº {s.orderNumber}
                </Link>
                <span className="text-fg-muted block text-xs">
                  {ORDER_STATUS_LABELS[s.orderStatus as OrderStatus] ??
                    s.orderStatus}
                </span>
              </td>
              <td data-label="Transportista" className="text-sm">
                {s.carrierName} · {s.serviceName}
                <span className="text-fg-muted block text-xs">
                  {weightText(s.weightG)}
                </span>
              </td>
              <td data-label="Seguimiento" className="text-sm break-all">
                {s.trackingUrl ? (
                  <a
                    href={s.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-underline"
                  >
                    {s.trackingNumber ?? 'Ver'}
                  </a>
                ) : (
                  (s.trackingNumber ?? '—')
                )}
              </td>
              <td data-label="Estado">
                <Badge tone={SHIPMENT_STATUS_TONES[s.status]}>
                  {SHIPMENT_STATUS_LABELS[s.status]}
                </Badge>
              </td>
              <td data-label="Entrega" className="text-sm">
                {s.handover ? HANDOVER_LABELS[s.handover] : 'Pendiente'}
                {s.pickup && (
                  <span className="text-fg-muted block text-xs">
                    {DATE_TIME.format(new Date(s.pickup.windowStart))}
                    {s.pickup.status === 'by_phone' ? ' · por teléfono' : ''}
                  </span>
                )}
              </td>
              <td data-label="Último aviso" className="text-fg-muted text-xs">
                {s.statusAt ? DATE_TIME.format(new Date(s.statusAt)) : '—'}
                {s.statusMessage && (
                  <span className="block">{s.statusMessage}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/**
 * Panel → Web → Envíos (DECISIONS §174–175): pedidos pagados sin etiqueta,
 * etiquetas por entregar al transportista (con la recogida de todas las de un
 * transportista a la vez), las que van de camino, las incidencias y lo
 * entregado en los últimos 30 días.
 */
export default async function ShippingBoardPage() {
  const staff = await requirePermission('orders.view');
  const canFulfill = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'orders.fulfill',
  );
  const [board, settings, services] = await Promise.all([
    getShippingBoard(staff.supabase),
    getShippingSettings(staff.supabase),
    listServiceSummaries(staff.supabase),
  ]);
  const sendcloudReady = sendcloudConfig() !== null;
  const toHandOver = board.shipments.filter(
    (s) => s.status === 'label_created' && !s.handover,
  );
  const waitingPickup = board.shipments.filter(
    (s) => s.status === 'label_created' && s.handover === 'pickup',
  );
  const moving = board.shipments.filter((s) =>
    ['in_transit', 'out_for_delivery', 'at_pickup_point'].includes(s.status),
  );
  const problems = board.shipments.filter(
    (s) => s.status === 'exception' || s.status === 'returned',
  );
  const delivered = board.shipments.filter((s) => s.status === 'delivered');
  const carriers = [
    ...new Map(toHandOver.map((s) => [s.carrierCode, s.carrierName])).entries(),
  ];
  const workingDays = nextWorkingDays(new Date(), 6);

  return (
    <main>
      <PageHeader eyebrow="Pedidos web" title="Envíos">
        <Link
          href="/admin/pedidos"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Pedidos web
        </Link>
      </PageHeader>

      {problems.length > 0 && (
        <p
          role="note"
          className="border-danger mb-8 max-w-3xl border-l-2 py-1 pl-4 text-sm"
        >
          <span className="text-danger font-semibold">
            {problems.length}{' '}
            {problems.length === 1
              ? 'envío con incidencia'
              : 'envíos con incidencia'}
            .
          </span>{' '}
          Revisa el seguimiento y, si hace falta, llama al transportista o
          escribe al cliente.
        </p>
      )}

      <Section title="Pagados sin etiqueta" count={board.withoutLabel.length}>
        {board.withoutLabel.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Ningún pedido pagado espera etiqueta.
          </p>
        ) : (
          <Table
            caption="Pedidos pagados con envío sin etiqueta"
            className="md:min-w-[36rem]"
          >
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Elegido por el cliente</th>
                <th>Peso</th>
                <th>Pagado</th>
              </tr>
            </thead>
            <tbody>
              {board.withoutLabel.map((o) => (
                <tr key={o.id}>
                  <td data-primary className="text-sm">
                    <Link
                      href={`/admin/pedidos/${o.id}`}
                      className="link-underline"
                    >
                      Nº {o.number}
                    </Link>
                  </td>
                  <td data-label="Elegido" className="text-sm">
                    {o.serviceLabel ?? '—'}
                  </td>
                  <td data-label="Peso" className="text-sm">
                    {o.weightG ? weightText(o.weightG) : '—'}
                  </td>
                  <td data-label="Pagado" className="text-fg-muted text-sm">
                    {o.paidAt ? DATE_TIME.format(new Date(o.paidAt)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section title="Por entregar al transportista" count={toHandOver.length}>
        {toHandOver.length === 0 ? (
          <p className="text-fg-muted text-sm">No hay etiquetas esperando.</p>
        ) : (
          <div className="space-y-8">
            <ShipmentTable
              caption="Etiquetas por entregar al transportista"
              rows={toHandOver}
            />
            {canFulfill &&
              settings &&
              carriers.map(([code, name]) => {
                const rows = toHandOver.filter((s) => s.carrierCode === code);
                const phone =
                  services.find((s) => s.carrierCode === code && s.pickupPhone)
                    ?.pickupPhone ?? null;
                return (
                  <Card as="section" key={code}>
                    <Eyebrow as="h3" className="mb-4">
                      Recogida de {name}: {rows.length}{' '}
                      {rows.length === 1 ? 'paquete' : 'paquetes'}
                    </Eyebrow>
                    <PickupForm
                      carrierCode={code}
                      carrierName={name}
                      shipmentIds={rows.map((s) => s.id)}
                      apiAvailable={
                        sendcloudReady &&
                        rows.every((s) => s.provider === 'sendcloud')
                      }
                      apiLikely={PICKUP_API_CARRIERS.has(code)}
                      phone={phone}
                      workingDays={workingDays}
                      start={settings.pickupStart}
                      end={settings.pickupEnd}
                    />
                  </Card>
                );
              })}
            <p className="text-fg-muted text-xs">
              ¿Lo llevas tú a un punto de entrega? Márcalo en la ficha de cada
              pedido.
            </p>
          </div>
        )}
      </Section>

      <Section title="Recogidas pedidas" count={waitingPickup.length}>
        {waitingPickup.length === 0 ? (
          <p className="text-fg-muted text-sm">No hay recogidas pendientes.</p>
        ) : (
          <ShipmentTable
            caption="Etiquetas con recogida pedida"
            rows={waitingPickup}
          />
        )}
      </Section>

      <Section title="De camino" count={moving.length}>
        {moving.length === 0 ? (
          <p className="text-fg-muted text-sm">Ningún paquete en camino.</p>
        ) : (
          <ShipmentTable caption="Paquetes en camino" rows={moving} />
        )}
      </Section>

      <Section title="Incidencias" count={problems.length}>
        {problems.length === 0 ? (
          <p className="text-fg-muted text-sm">Sin incidencias.</p>
        ) : (
          <ShipmentTable caption="Envíos con incidencia" rows={problems} />
        )}
      </Section>

      <Section title="Entregados (30 días)" count={delivered.length}>
        {delivered.length === 0 ? (
          <p className="text-fg-muted text-sm">Aún no hay entregas.</p>
        ) : (
          <ShipmentTable
            caption="Entregados en los últimos 30 días"
            rows={delivered}
          />
        )}
      </Section>
    </main>
  );
}
