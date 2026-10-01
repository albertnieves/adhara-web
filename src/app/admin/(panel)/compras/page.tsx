import type { Metadata } from 'next';
import Link from 'next/link';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import {
  ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUSES,
  isOpenOrder,
  isPurchaseOrderStatus,
} from '@/modules/purchasing';
import { listPurchaseOrders, listSuppliers } from '@/modules/purchasing/server';
import { NewOrderForm } from '@/modules/purchasing/ui';

export const metadata: Metadata = { title: 'Compras' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeZone: 'Europe/Madrid',
});

export default async function Purchases({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const staff = await requirePermission('purchasing.manage');
  const { estado = 'abiertos' } = await searchParams;
  const canCost = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'pricing.view_cost',
  );
  const [orders, suppliers] = await Promise.all([
    listPurchaseOrders(staff.supabase),
    listSuppliers(staff.supabase),
  ]);
  const visible = orders.filter((order) =>
    estado === 'todos'
      ? true
      : estado === 'abiertos'
        ? isOpenOrder(order.status)
        : order.status === estado,
  );
  const filters = [
    {
      value: 'abiertos',
      label: 'Abiertos',
      count: orders.filter((o) => isOpenOrder(o.status)).length,
    },
    { value: 'todos', label: 'Todos', count: orders.length },
    ...PURCHASE_ORDER_STATUSES.filter((status) =>
      orders.some((o) => o.status === status),
    ).map((status) => ({
      value: status,
      label: ORDER_STATUS_LABELS[status],
      count: orders.filter((o) => o.status === status).length,
    })),
  ];

  return (
    <main>
      <PageHeader eyebrow="Compras" title="Pedidos a proveedor">
        <Link
          href="/admin/compras/proveedores"
          className="border-line hover:border-ink inline-flex min-h-11 items-center border px-5 text-xs font-semibold tracking-[0.18em] uppercase"
        >
          Proveedores
        </Link>
        <Link
          href="/admin/reposicion"
          className="border-line hover:border-ink inline-flex min-h-11 items-center border px-5 text-xs font-semibold tracking-[0.18em] uppercase"
        >
          Reposición
        </Link>
      </PageHeader>

      <section className="panel-card mb-10">
        <p className="eyebrow mb-4">Nuevo pedido</p>
        <NewOrderForm
          suppliers={suppliers
            .filter((s) => s.active)
            .map((s) => ({
              id: s.id,
              name: s.name,
              leadTimeDays: s.leadTimeDays,
            }))}
        />
      </section>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filtro por estado">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={
              f.value === 'abiertos'
                ? '/admin/compras'
                : `/admin/compras?estado=${f.value}`
            }
            aria-current={estado === f.value ? 'page' : undefined}
            className={`border px-3 py-2 text-xs tracking-[0.12em] uppercase ${estado === f.value ? 'border-ink bg-ink text-ivory' : 'border-line hover:border-ink'}`}
          >
            {f.label} · {f.count}
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p className="text-smoke py-16 text-center">
          {orders.length === 0
            ? 'Aún no hay pedidos. Crea uno arriba o desde las propuestas de Reposición.'
            : 'Ningún pedido con este filtro.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[48rem]">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th className="text-right">Unidades</th>
                {canCost && <th className="text-right">Coste neto</th>}
                <th>Llegada prevista</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link
                      href={`/admin/compras/${order.id}`}
                      className="link-underline font-semibold"
                    >
                      {order.number}
                    </Link>
                    <p className="text-smoke text-xs">
                      {DATE.format(new Date(order.createdAt))}
                    </p>
                  </td>
                  <td className="text-sm">{order.supplierName}</td>
                  <td className="text-sm">
                    {isPurchaseOrderStatus(order.status)
                      ? ORDER_STATUS_LABELS[order.status]
                      : order.status}
                  </td>
                  <td className="text-right tabular-nums">
                    {order.unitsReceived > 0
                      ? `${order.unitsReceived} / ${order.unitsOrdered}`
                      : order.unitsOrdered}
                  </td>
                  {canCost && (
                    <td className="text-right tabular-nums">
                      {order.totalCostNetCents === null
                        ? '—'
                        : formatEuros(order.totalCostNetCents, 'es')}
                    </td>
                  )}
                  <td className="text-smoke text-sm">
                    {order.expectedOn
                      ? DATE.format(new Date(`${order.expectedOn}T12:00:00Z`))
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
