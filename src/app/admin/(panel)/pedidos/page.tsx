import type { Metadata } from 'next';
import Link from 'next/link';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import {
  FULFILLMENT_LABELS,
  ORDER_VIEWS,
  ORDER_VIEW_LABELS,
  matchesOrderView,
  orderStatusBadge,
  orderViewHref,
  parseOrderFilter,
} from '@/modules/orders';
import type { OrderSearch } from '@/modules/orders';
import { listWebOrders } from '@/modules/orders/server';
import {
  Badge,
  buttonClass,
  EmptyState,
  Eyebrow,
  Input,
  Select,
  Table,
} from '@/components/ui';

export const metadata: Metadata = { title: 'Pedidos web' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

const LIMIT = 200;

export default async function WebOrders({
  searchParams,
}: {
  searchParams: Promise<OrderSearch>;
}) {
  const staff = await requirePermission('orders.view');
  const canCustomers = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'customers.view',
  );
  const filter = parseOrderFilter(await searchParams);
  const orders = await listWebOrders(staff.supabase, filter, {
    withCustomer: canCustomers,
  });
  const visible = orders.filter((order) =>
    matchesOrderView(order, filter.view),
  );
  const views = ORDER_VIEWS.map((view) => ({
    view,
    count: orders.filter((order) => matchesOrderView(order, view)).length,
  })).filter(
    ({ view, count }) =>
      count > 0 ||
      view === 'abiertos' ||
      view === 'todos' ||
      view === filter.view,
  );
  const query = filter.search.toString();

  return (
    <main>
      <PageHeader eyebrow="Web" title="Pedidos web" />
      <p className="text-fg-muted mb-8 max-w-2xl text-sm leading-relaxed">
        Un pedido aparece en «Por preparar» cuando el banco confirma el pago.
        Los que esperan pago o caducaron sin pagar no son trabajo de
        preparación: tienen sus propios filtros. Las incidencias son cobros que
        hay que revisar en el TPV antes de seguir.
      </p>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filtro por estado">
        {views.map(({ view, count }) => (
          <Link
            key={view}
            href={orderViewHref(view, filter.search)}
            aria-current={filter.view === view ? 'page' : undefined}
            className={buttonClass(
              filter.view === view
                ? 'primary'
                : view === 'incidencias'
                  ? 'danger'
                  : 'outline',
            )}
          >
            {ORDER_VIEW_LABELS[view]} · {count}
          </Link>
        ))}
      </nav>

      <form className="border-border mb-8 flex flex-wrap items-end gap-x-6 gap-y-4 border-y py-5">
        {filter.view !== 'abiertos' && (
          <input type="hidden" name="vista" value={filter.view} />
        )}
        <label className="flex flex-col gap-2">
          <Eyebrow as="span">Entrega</Eyebrow>
          <Select
            name="entrega"
            defaultValue={filter.fulfillment ?? ''}
            className="min-w-52"
          >
            <option value="">Todas</option>
            <option value="click_collect">
              {FULFILLMENT_LABELS.click_collect}
            </option>
            <option value="shipping">{FULFILLMENT_LABELS.shipping}</option>
          </Select>
        </label>
        <label className="flex flex-col gap-2">
          <Eyebrow as="span">Desde</Eyebrow>
          <Input
            type="date"
            name="desde"
            defaultValue={filter.search.get('desde') ?? ''}
          />
        </label>
        <label className="flex flex-col gap-2">
          <Eyebrow as="span">Hasta</Eyebrow>
          <Input
            type="date"
            name="hasta"
            defaultValue={filter.search.get('hasta') ?? ''}
          />
        </label>
        <button type="submit" className={buttonClass('outline')}>
          Filtrar
        </button>
        {query && (
          <Link
            href={orderViewHref(filter.view, new URLSearchParams())}
            className="link-underline text-sm"
          >
            Quitar filtros
          </Link>
        )}
      </form>

      {orders.length === 0 && !query ? (
        <EmptyState
          title="Aún no hay pedidos web"
          description="La tienda todavía no cobra con tarjeta. Cuando se active, cada compra pagada aparecerá aquí para prepararla."
        />
      ) : visible.length === 0 ? (
        <p className="text-fg-muted py-16 text-center">
          Ningún pedido con este filtro.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table caption="Pedidos web" className="md:min-w-[48rem]">
            <thead>
              <tr>
                <th>Pedido</th>
                {canCustomers && <th>Cliente</th>}
                <th>Entrega</th>
                <th className="text-right">Artículos</th>
                <th className="text-right">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, LIMIT).map((order) => {
                const badge = orderStatusBadge(order);
                return (
                  <tr key={order.id}>
                    <td data-primary>
                      <Link
                        href={`/admin/pedidos/${order.id}`}
                        className="link-underline font-semibold tabular-nums"
                      >
                        Nº {order.number}
                      </Link>
                      <p className="text-fg-muted text-xs">
                        {DATE.format(new Date(order.createdAt))}
                      </p>
                    </td>
                    {canCustomers && (
                      <td data-label="Cliente" className="text-sm">
                        {order.customerName ?? '—'}
                      </td>
                    )}
                    <td data-label="Entrega" className="text-sm">
                      {FULFILLMENT_LABELS[order.fulfillment]}
                    </td>
                    <td
                      data-label="Artículos"
                      className="text-right tabular-nums"
                    >
                      {order.units}
                    </td>
                    <td data-label="Total" className="text-right tabular-nums">
                      {formatEuros(order.totalCents, 'es')}
                    </td>
                    <td data-label="Estado">
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                        {order.hasIncident &&
                          order.status !== 'needs_attention' && (
                            <Badge tone="danger">Incidencia de pago</Badge>
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
              Se muestran los {LIMIT} más recientes; filtra por fechas para ver
              los demás.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
