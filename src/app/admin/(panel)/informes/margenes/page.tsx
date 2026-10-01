import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { getVariantCosts } from '@/modules/catalog/server/admin';
import { PROVISIONAL_PRICING_POLICY, VAT_GENERAL_BP } from '@/modules/pricing';
import { isBelowMin, marginRows, marginsByBrand } from '@/modules/reports';
import { listAllVariants } from '@/modules/reports/server';

export const metadata: Metadata = { title: 'Márgenes' };

const PERCENT = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const pct = (bp: number | null) =>
  bp === null ? '—' : PERCENT.format(bp / 10_000);

export default async function MarginsReport() {
  // Costes: pricing.view_cost con MFA; además, permiso de informes.
  const staff = await requirePermission('pricing.view_cost');
  if (!isAllowed({ role: staff.role, aal: 'aal2' }, 'reports.view')) notFound();
  const variants = [...(await listAllVariants(staff.supabase)).values()].filter(
    (v) => v.active && v.productStatus !== 'archived',
  );
  const costs = await getVariantCosts(
    staff.supabase,
    variants.map((v) => v.variantId),
  );
  const minMarginBp = PROVISIONAL_PRICING_POLICY.minMarginBp;
  const rows = marginRows(
    variants.map((v) => ({
      variantId: v.variantId,
      brandName: v.brandName,
      label: `${v.productName} · ${v.variantLabel}`,
      priceCents: v.priceCents,
      costNetCents: costs.get(v.variantId)?.costNetCents ?? null,
    })),
    VAT_GENERAL_BP,
  );
  const brands = marginsByBrand(rows, minMarginBp);
  const below = rows
    .filter((r) => isBelowMin(r, minMarginBp))
    .sort((a, b) => a.marginBp! - b.marginBp!);
  const pricedWithoutCost = rows.filter(
    (r) => r.priceCents !== null && r.costNetCents === null,
  ).length;
  const productOf = new Map(variants.map((v) => [v.variantId, v.productId]));

  return (
    <main>
      <PageHeader eyebrow="Informes" title="Márgenes" />
      <p className="text-smoke mb-10 max-w-3xl text-sm leading-relaxed">
        Margen teórico: PVP sin IVA ({VAT_GENERAL_BP / 100} %) menos el coste
        neto vigente de cada formato activo, sobre el PVP sin IVA. No incluye
        descuentos, envíos ni comisiones. Margen mínimo provisional:{' '}
        {pct(minMarginBp)}.{' '}
        {pricedWithoutCost > 0 &&
          `${pricedWithoutCost} formatos con PVP no tienen coste y no cuentan.`}
      </p>

      <section>
        <h2 className="mb-4 text-2xl font-light">Por marca</h2>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[36rem]">
            <thead>
              <tr>
                <th>Marca</th>
                <th className="text-right">Formatos</th>
                <th className="text-right">Con PVP</th>
                <th className="text-right">Con coste</th>
                <th className="text-right">Margen medio</th>
                <th className="text-right">Por debajo</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.brandName}>
                  <td className="text-sm">{b.brandName}</td>
                  <td className="text-right tabular-nums">{b.formats}</td>
                  <td className="text-right tabular-nums">{b.withPrice}</td>
                  <td
                    className={`text-right tabular-nums ${b.withCost < b.withPrice ? 'text-danger' : ''}`}
                  >
                    {b.withCost}
                  </td>
                  <td className="text-right font-semibold tabular-nums">
                    {pct(b.averageMarginBp)}
                  </td>
                  <td
                    className={`text-right tabular-nums ${b.belowMin ? 'text-danger' : ''}`}
                  >
                    {b.belowMin}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-2xl font-light">
          Por debajo del margen mínimo · {below.length}
        </h2>
        {below.length === 0 ? (
          <p className="text-smoke text-sm">Ningún formato.</p>
        ) : (
          <ul className="divide-line border-line divide-y border-y">
            {below.map((r) => (
              <li key={r.variantId}>
                <Link
                  href={`/admin/catalogo/${productOf.get(r.variantId)}`}
                  className="flex items-center justify-between gap-4 py-3 text-sm hover:bg-white/60"
                >
                  <span>
                    <span className="text-smoke">{r.brandName} · </span>
                    {r.label}
                  </span>
                  <span className="text-danger tabular-nums">
                    {pct(r.marginBp)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
