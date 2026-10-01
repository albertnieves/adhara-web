import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { COUNTER_KIND_LABELS } from '@/modules/inventory';
import {
  getDefaultLocation,
  listLevels,
  listRecentStoreSales,
  listVariantDirectory,
  toCounterItems,
} from '@/modules/inventory/server';
import { Counter } from '@/modules/inventory/ui';
import { requirePermission } from '@/modules/auth/server';

export const metadata: Metadata = { title: 'Mostrador' };

const TIME = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

export default async function CounterPage() {
  const { supabase } = await requirePermission('inventory.sell_in_store');
  const location = await getDefaultLocation(supabase);
  if (!location) {
    return (
      <main>
        <PageHeader eyebrow="Tienda" title="Mostrador" />
        <p className="text-smoke">No hay ninguna ubicación activa.</p>
      </main>
    );
  }
  const [directory, levels, sales] = await Promise.all([
    listVariantDirectory(supabase),
    listLevels(supabase, location.id),
    listRecentStoreSales(supabase, location.id),
  ]);
  const items = toCounterItems(directory, levels);

  return (
    <main>
      <PageHeader eyebrow={location.name} title="Mostrador">
        <Link
          href="/admin/movimientos?tipo=SALE_STORE"
          className="border-line hover:border-ink inline-flex min-h-11 items-center border px-5 text-xs font-semibold tracking-[0.18em] uppercase"
        >
          Ventas en el historial
        </Link>
      </PageHeader>

      <Counter items={items} locationId={location.id} />

      <section className="mt-14">
        <h2 className="mb-4 text-2xl font-light">Últimas operaciones</h2>
        {sales.length === 0 ? (
          <p className="text-smoke text-sm">
            Aún no hay ventas ni devoluciones de mostrador.
          </p>
        ) : (
          <ul className="divide-line border-line divide-y border-y">
            {sales.map((sale) => (
              <li
                key={sale.id}
                className="flex flex-wrap items-start justify-between gap-4 py-3 text-sm"
              >
                <div>
                  <p>
                    <span
                      className={
                        sale.kind === 'sale' ? 'text-danger' : 'text-success'
                      }
                    >
                      {COUNTER_KIND_LABELS[sale.kind]}
                    </span>
                    <span className="text-smoke">
                      {' '}
                      · {TIME.format(new Date(sale.createdAt))}
                      {sale.ticketRef && ` · ticket ${sale.ticketRef}`}
                    </span>
                  </p>
                  <ul className="text-smoke mt-1 text-xs">
                    {sale.lines.map((line) => (
                      <li key={line.label}>
                        {line.quantity} × {line.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <span className="tabular-nums">
                  {sale.kind === 'sale' ? '−' : '+'}
                  {sale.units}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
