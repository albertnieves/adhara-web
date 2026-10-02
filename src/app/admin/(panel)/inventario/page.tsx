import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { SearchField } from '@/modules/admin/ui/SearchField';
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
        <Link href="/admin/movimientos" className="panel-btn">
          Historial
        </Link>
      </PageHeader>

      <form className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-2" aria-label="Filtro">
          {[
            { value: '', label: `Todo · ${rows.length}` },
            {
              value: 'bajo',
              label: `Bajo o agotado · ${rows.filter((r) => r.active && isLow(r)).length}`,
            },
          ].map((f) => (
            <Link
              key={f.value}
              href={`/admin/inventario${
                f.value || q
                  ? `?${new URLSearchParams({
                      ...(f.value && { filtro: f.value }),
                      ...(q && { q }),
                    })}`
                  : ''
              }`}
              aria-current={filtro === f.value ? 'page' : undefined}
              className={`tracking-caps-sm inline-flex min-h-10 items-center border px-3 text-xs uppercase ${filtro === f.value ? 'border-ink bg-ink text-ivory' : 'border-line hover:border-ink'}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {filtro && <input type="hidden" name="filtro" value={filtro} />}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <p className="text-smoke tracking-caps-sm text-xs uppercase">
            {units} uds. en tienda
          </p>
          <SearchField
            defaultValue={q}
            placeholder="Buscar perfume, marca o SKU"
            label="Buscar en el inventario"
            className="w-full sm:w-64"
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
          <table className="data-table stack-table md:min-w-[48rem]">
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
                  <tr key={r.variantId}>
                    <td data-primary>
                      <Link
                        href={`/admin/catalogo/${r.productId}`}
                        className="link-underline"
                      >
                        {r.productName}
                      </Link>
                      <p className="text-smoke text-xs">{r.brandName}</p>
                    </td>
                    <td data-label="Formato" className="text-sm">
                      <span>
                        {r.variantLabel}
                        {r.sku && (
                          <p className="text-fg-muted text-xs">{r.sku}</p>
                        )}
                        {!r.active && (
                          <p className="text-fg-muted text-xs">inactivo</p>
                        )}
                      </span>
                    </td>
                    <td
                      data-label="En tienda"
                      className="text-right tabular-nums"
                    >
                      {r.onHand}
                    </td>
                    <td
                      data-label="Reservado"
                      className="text-smoke text-right tabular-nums"
                    >
                      {r.reserved}
                    </td>
                    <td
                      data-label="Disponible"
                      className={`text-right font-semibold tabular-nums ${isLow(r) ? 'text-danger' : ''}`}
                    >
                      <span>
                        {available}
                        {r.reorderPoint !== null && (
                          <p className="text-fg-muted text-2xs font-normal">
                            aviso ≤ {r.reorderPoint}
                          </p>
                        )}
                      </span>
                    </td>
                    <td>
                      <StockActions
                        title={`${r.productName} · ${r.variantLabel}`}
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
