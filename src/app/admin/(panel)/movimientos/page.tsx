import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import {
  MOVEMENT_LABELS,
  MOVEMENT_TYPES,
  parseMovementFilter,
} from '@/modules/inventory';
import type { MovementSearch, MovementType } from '@/modules/inventory';
import { listMovements } from '@/modules/inventory/server';

export const metadata: Metadata = { title: 'Movimientos' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

const LIMIT = 200;

export default async function Movements({
  searchParams,
}: {
  searchParams: Promise<MovementSearch>;
}) {
  const { supabase } = await requirePermission('inventory.view');
  const params = await searchParams;
  const filter = parseMovementFilter(params);
  const movements = await listMovements(supabase, { ...filter, limit: LIMIT });
  const query = filter.search.toString();
  const product = filter.productId
    ? movements.find((m) => m.productId === filter.productId)
    : undefined;

  return (
    <main>
      <PageHeader eyebrow="Inventario" title="Movimientos">
        <a
          href={`/admin/movimientos/exportar${query ? `?${query}` : ''}`}
          className="border-line hover:border-ink inline-flex min-h-11 items-center border px-5 text-xs font-semibold tracking-[0.18em] uppercase"
        >
          Exportar CSV
        </a>
      </PageHeader>
      <p className="text-smoke mb-8 max-w-2xl text-sm leading-relaxed">
        Registro de solo lectura: los movimientos no se editan ni se borran. Un
        error se corrige con un ajuste que queda también registrado. La
        exportación incluye todos los movimientos del filtro (para Excel).
      </p>

      <form className="border-line mb-8 flex flex-wrap items-end gap-x-6 gap-y-4 border-y py-5">
        {filter.productId && (
          <input type="hidden" name="perfume" value={filter.productId} />
        )}
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Tipo</span>
          <select
            name="tipo"
            defaultValue={filter.type ?? ''}
            className="input min-w-52"
          >
            <option value="">Todos</option>
            {MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {MOVEMENT_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={filter.search.get('desde') ?? ''}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={filter.search.get('hasta') ?? ''}
            className="input"
          />
        </label>
        <button
          type="submit"
          className="border-ink hover:bg-ink hover:text-ivory min-h-11 border px-5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors"
        >
          Filtrar
        </button>
        {query && (
          <Link href="/admin/movimientos" className="link-underline text-sm">
            Quitar filtros
          </Link>
        )}
      </form>
      {filter.productId && (
        <p className="mb-6 text-sm">
          Perfume:{' '}
          <Link
            href={`/admin/catalogo/${filter.productId}`}
            className="link-underline font-semibold"
          >
            {product ? `${product.brandName} ${product.productName}` : 'ficha'}
          </Link>
        </p>
      )}

      {movements.length === 0 ? (
        <p className="text-smoke py-16 text-center">
          {query
            ? 'Ningún movimiento con estos filtros.'
            : 'Aún no hay movimientos.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table stack-table md:min-w-[48rem]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th>Perfume</th>
                <th className="text-right">Cambio</th>
                <th className="text-right">Queda</th>
                <th>Motivo / referencia</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td
                    data-label="Fecha"
                    className="text-smoke text-xs whitespace-nowrap"
                  >
                    {DATE.format(new Date(m.createdAt))}
                  </td>
                  <td data-label="Movimiento" className="text-sm">
                    {MOVEMENT_LABELS[m.type as MovementType] ?? m.type}
                  </td>
                  <td data-primary className="text-sm">
                    <Link
                      href={`/admin/catalogo/${m.productId}`}
                      className="link-underline"
                    >
                      {m.productName}
                    </Link>{' '}
                    <span className="text-smoke">
                      · {m.brandName} · {m.variantLabel}
                    </span>
                  </td>
                  <td
                    data-label="Cambio"
                    className={`text-right tabular-nums ${m.deltaOnHand < 0 ? 'text-danger' : m.deltaOnHand > 0 ? 'text-success' : 'text-smoke'}`}
                  >
                    {m.deltaOnHand > 0 ? '+' : ''}
                    {m.deltaOnHand}
                  </td>
                  <td data-label="Queda" className="text-right tabular-nums">
                    {m.onHandAfter}
                  </td>
                  <td data-label="Motivo" className="text-smoke text-xs">
                    {[m.reason, m.reference].filter(Boolean).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === LIMIT && (
            <p className="text-smoke mt-4 text-sm">
              Se muestran los {LIMIT} más recientes; filtra por fechas o exporta
              el CSV para verlos todos.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
