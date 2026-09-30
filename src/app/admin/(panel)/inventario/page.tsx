import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { MOVEMENT_PERMISSIONS, MOVEMENT_TYPES } from '@/modules/inventory';
import { getDefaultLocation, listStock } from '@/modules/inventory/server';
import { StockActions } from '@/modules/inventory/ui';

export const metadata: Metadata = { title: 'Inventario' };

export default async function Inventory({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string }>;
}) {
  const staff = await requirePermission('inventory.view');
  const { filtro = '', q = '' } = await searchParams;
  const location = await getDefaultLocation(staff.supabase);
  const can = (p: Parameters<typeof isAllowed>[1]) =>
    isAllowed({ role: staff.role, aal: 'aal2' }, p);
  const movementTypes = MOVEMENT_TYPES.filter((type) => {
    const permission = MOVEMENT_PERMISSIONS[type];
    return permission !== null && can(permission);
  });

  if (!location) {
    return (
      <main>
        <PageHeader eyebrow="Inventario" title="Stock" />
        <p className="text-smoke">No hay ninguna ubicación activa.</p>
      </main>
    );
  }
  const rows = await listStock(staff.supabase, location.id);
  const needle = q.trim().toLowerCase();
  const isLow = (r: (typeof rows)[number]) =>
    r.onHand - r.reserved <= 0 ||
    (r.reorderPoint !== null && r.onHand - r.reserved <= r.reorderPoint);
  const visible = rows
    .filter((r) => filtro !== 'bajo' || (r.active && isLow(r)))
    .filter(
      (r) =>
        !needle ||
        `${r.brandName} ${r.productName} ${r.sku ?? ''}`
          .toLowerCase()
          .includes(needle),
    );
  const units = rows.reduce((sum, r) => sum + r.onHand, 0);

  return (
    <main>
      <PageHeader eyebrow={location.name} title="Inventario">
        <Link
          href="/admin/movimientos"
          className="border-line hover:border-ink inline-flex min-h-11 items-center border px-5 text-xs font-semibold tracking-[0.18em] uppercase"
        >
          Historial
        </Link>
      </PageHeader>

      <form className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex gap-2" aria-label="Filtro">
          {[
            { value: '', label: `Todo · ${rows.length}` },
            {
              value: 'bajo',
              label: `Bajo o agotado · ${rows.filter((r) => r.active && isLow(r)).length}`,
            },
          ].map((f) => (
            <Link
              key={f.value}
              href={
                f.value
                  ? `/admin/inventario?filtro=${f.value}`
                  : '/admin/inventario'
              }
              aria-current={filtro === f.value ? 'page' : undefined}
              className={`border px-3 py-2 text-xs tracking-[0.12em] uppercase ${filtro === f.value ? 'border-ink bg-ink text-ivory' : 'border-line hover:border-ink'}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {filtro && <input type="hidden" name="filtro" value={filtro} />}
        <div className="flex items-center gap-6">
          <p className="text-smoke text-xs tracking-[0.14em] uppercase">
            {units} uds. en tienda
          </p>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar perfume, marca o SKU"
            className="input sm:w-64"
          />
        </div>
      </form>

      {visible.length === 0 ? (
        <p className="text-smoke py-16 text-center">
          {rows.length === 0
            ? 'No hay formatos todavía: añádelos desde el catálogo.'
            : 'Nada que mostrar con este filtro.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[48rem]">
            <thead>
              <tr>
                <th>Perfume</th>
                <th>Formato</th>
                <th className="text-right">En tienda</th>
                <th className="text-right">Reservado</th>
                <th className="text-right">Disponible</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const available = r.onHand - r.reserved;
                return (
                  <tr key={r.variantId} className="align-top">
                    <td>
                      <Link
                        href={`/admin/catalogo/${r.productId}`}
                        className="link-underline"
                      >
                        {r.productName}
                      </Link>
                      <p className="text-smoke text-xs">{r.brandName}</p>
                    </td>
                    <td className="text-sm">
                      {r.variantLabel}
                      {r.sku && <p className="text-mist text-xs">{r.sku}</p>}
                      {!r.active && (
                        <p className="text-mist text-xs">inactivo</p>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{r.onHand}</td>
                    <td className="text-smoke text-right tabular-nums">
                      {r.reserved}
                    </td>
                    <td
                      className={`text-right font-semibold tabular-nums ${isLow(r) ? 'text-danger' : ''}`}
                    >
                      {available}
                      {r.reorderPoint !== null && (
                        <p className="text-mist text-[0.6875rem] font-normal">
                          aviso ≤ {r.reorderPoint}
                        </p>
                      )}
                    </td>
                    <td>
                      <StockActions
                        variantId={r.variantId}
                        locationId={location.id}
                        onHand={r.onHand}
                        reserved={r.reserved}
                        reorderPoint={r.reorderPoint}
                        movementTypes={movementTypes}
                        canStocktake={can('inventory.stocktake')}
                        canAdjust={can('inventory.adjust')}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
