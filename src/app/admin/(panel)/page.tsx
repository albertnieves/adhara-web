import Link from 'next/link';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requireStaff } from '@/modules/auth/server';
import {
  getVariantCosts,
  listAdminProducts,
} from '@/modules/catalog/server/admin';
import { MOVEMENT_LABELS } from '@/modules/inventory';
import type { MovementType } from '@/modules/inventory';
import {
  getDefaultLocation,
  listMovements,
  listStock,
} from '@/modules/inventory/server';

function Stat({
  label,
  value,
  href,
  note,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  href?: string;
  note?: string;
  tone?: 'default' | 'alert';
}) {
  const body = (
    <div className="panel-card h-full transition-colors duration-300 hover:bg-white">
      <p className="eyebrow">{label}</p>
      <p
        className={`font-display mt-3 text-5xl font-light lining-nums tabular-nums ${tone === 'alert' ? 'text-danger' : ''}`}
      >
        {value}
      </p>
      {note && <p className="text-smoke mt-2 text-xs">{note}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminHome() {
  const staff = await requireStaff();
  const can = (p: Parameters<typeof isAllowed>[1]) =>
    isAllowed({ role: staff.role, aal: 'aal2' }, p);
  const canCatalog = can('catalog.edit');
  const canStock = can('inventory.view');
  const canCost = canCatalog && can('pricing.view_cost');

  const [products, location] = await Promise.all([
    canCatalog ? listAdminProducts(staff.supabase, canStock) : [],
    canStock ? getDefaultLocation(staff.supabase) : null,
  ]);
  const [stock, movements] = location
    ? await Promise.all([
        listStock(staff.supabase, location.id),
        listMovements(staff.supabase, { limit: 6 }),
      ])
    : [[], []];

  const published = products.filter((p) => p.status === 'published').length;
  const drafts = products.filter((p) => p.status === 'draft').length;
  const missingPrice = products.filter(
    (p) =>
      p.status !== 'archived' &&
      (p.variants.length === 0 ||
        p.variants.some((v) => v.priceCents === null)),
  );
  const low = stock.filter(
    (row) =>
      row.active &&
      (row.onHand - row.reserved <= 0 ||
        (row.reorderPoint !== null &&
          row.onHand - row.reserved <= row.reorderPoint)),
  );
  const units = stock.reduce((sum, row) => sum + row.onHand, 0);

  // Costes: solo con pricing.view_cost (MFA). Formatos activos de perfumes no
  // archivados sin coste registrado, y valor del stock de la tienda a coste.
  const costedVariants = products
    .filter((p) => p.status !== 'archived')
    .flatMap((p) => p.variants.filter((v) => v.active).map((v) => v.id));
  const costs = canCost
    ? await getVariantCosts(staff.supabase, [
        ...new Set([...costedVariants, ...stock.map((row) => row.variantId)]),
      ])
    : new Map<string, { costNetCents: number }>();
  const withoutCost = costedVariants.filter((id) => !costs.has(id)).length;
  const stockAtCost = stock.reduce(
    (sum, row) =>
      sum + row.onHand * (costs.get(row.variantId)?.costNetCents ?? 0),
    0,
  );
  const unitsWithoutCost = stock
    .filter((row) => row.onHand > 0 && !costs.has(row.variantId))
    .reduce((sum, row) => sum + row.onHand, 0);
  const firstName = (staff.displayName ?? staff.email ?? '').split(/[ @]/)[0];

  return (
    <main>
      <PageHeader eyebrow="Panel" title={`Hola, ${firstName}`} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canCatalog && (
          <>
            <Stat label="Publicados" value={published} href="/admin/catalogo" />
            <Stat label="Borradores" value={drafts} href="/admin/catalogo" />
            <Stat
              label="Sin PVP completo"
              value={missingPrice.length}
              href="/admin/catalogo"
              tone={missingPrice.length ? 'alert' : 'default'}
            />
          </>
        )}
        {canStock && (
          <Stat
            label="Stock bajo o agotado"
            value={low.length}
            href="/admin/inventario?filtro=bajo"
            tone={low.length ? 'alert' : 'default'}
          />
        )}
        {canCost && (
          <Stat
            label="Formatos sin coste"
            value={withoutCost}
            href="/admin/catalogo"
            tone={withoutCost ? 'alert' : 'default'}
          />
        )}
        {canCost && canStock && (
          <Stat
            label="Stock a coste"
            value={formatEuros(stockAtCost, 'es')}
            href="/admin/inventario"
            note={
              unitsWithoutCost > 0
                ? `${unitsWithoutCost} ${unitsWithoutCost === 1 ? 'unidad' : 'unidades'} sin coste no suman`
                : 'Coste neto, sin IVA'
            }
          />
        )}
      </section>

      <div className="mt-12 grid gap-10 xl:grid-cols-2">
        {canCatalog && missingPrice.length > 0 && (
          <section>
            <h2 className="mb-4 text-2xl font-light">Pendientes de precio</h2>
            <ul className="divide-line border-line divide-y border-y">
              {missingPrice.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/catalogo/${p.id}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm hover:bg-white/60"
                  >
                    <span>
                      <span className="text-smoke">{p.brandName} · </span>
                      {p.name}
                    </span>
                    <span className="text-smoke text-xs">
                      {p.variants.length === 0
                        ? 'Sin formatos'
                        : p.variants
                            .map((v) =>
                              v.priceCents === null
                                ? `${v.label}: —`
                                : `${v.label}: ${formatEuros(v.priceCents, 'es')}`,
                            )
                            .join(' · ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {canStock && (
          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-2xl font-light">Últimos movimientos</h2>
              <Link
                href="/admin/movimientos"
                className="link-underline text-xs tracking-[0.16em] uppercase"
              >
                Ver todos
              </Link>
            </div>
            {movements.length === 0 ? (
              <p className="text-smoke text-sm">
                Aún no hay movimientos. Registra la primera recepción desde
                Inventario. Unidades en tienda: {units}.
              </p>
            ) : (
              <ul className="divide-line border-line divide-y border-y">
                {movements.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <span>
                      {MOVEMENT_LABELS[m.type as MovementType] ?? m.type}
                      <span className="text-smoke">
                        {' '}
                        · {m.brandName} {m.productName} {m.variantLabel}
                      </span>
                    </span>
                    <span
                      className={`tabular-nums ${m.deltaOnHand < 0 ? 'text-danger' : 'text-success'}`}
                    >
                      {m.deltaOnHand > 0 ? '+' : ''}
                      {m.deltaOnHand}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
