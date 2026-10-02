import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import type { FindingSeverity, StockFinding } from '@/modules/inventory';
import {
  FINDING_LABELS,
  SEVERITY_LABELS,
  describeFinding,
  summarizeFindings,
} from '@/modules/inventory';
import { getDefaultLocation, getStockWatch } from '@/modules/inventory/server';
import { WatchSettingsForm } from '@/modules/inventory/ui';
import { groupProposalsBySupplier } from '@/modules/purchasing';
import {
  listSupplierTerms,
  replenishmentSupplier,
} from '@/modules/purchasing/server';
import type { ProposalGroupView } from '@/modules/purchasing/ui';
import { ProposalsForm } from '@/modules/purchasing/ui';

export const metadata: Metadata = { title: 'Reposición' };

const SEVERITIES: FindingSeverity[] = ['critical', 'warning', 'info'];
const TONE: Record<FindingSeverity, string> = {
  critical: 'text-danger',
  warning: 'text-warning',
  info: 'text-smoke',
};

const REORDER_KINDS = new Set(['out_of_stock', 'below_min', 'low_cover']);

/** Por qué hay (o no hay) cantidad propuesta, con los datos que faltan. */
function proposalNote(
  finding: StockFinding,
  facts: { leadTimeDays: number | null; hasSupplier: boolean } | undefined,
  level: { reorderPoint?: number | null } | undefined,
): string | null {
  if (!REORDER_KINDS.has(finding.kind)) return null;
  const lead =
    facts?.leadTimeDays != null
      ? `plazo ${facts.leadTimeDays} d`
      : facts?.hasSupplier
        ? 'plazo desconocido'
        : 'sin proveedor';
  if (finding.proposal) return lead;
  if (facts?.leadTimeDays == null && level?.reorderPoint == null) {
    return `${lead}; sin punto de pedido: decide una persona`;
  }
  return `${lead}; con lo pedido basta`;
}

export default async function Replenishment() {
  const staff = await requirePermission('inventory.view');
  const can = (p: Parameters<typeof isAllowed>[1]) =>
    isAllowed({ role: staff.role, aal: 'aal2' }, p);
  const location = await getDefaultLocation(staff.supabase);
  if (!location) {
    return (
      <main>
        <PageHeader eyebrow="Inventario" title="Reposición" />
        <p className="text-smoke">No hay ninguna ubicación activa.</p>
      </main>
    );
  }
  const watch = await getStockWatch(staff.supabase, location.id);
  const summary = summarizeFindings(watch.findings);
  const canPurchase = can('purchasing.manage');
  const canCatalog = can('catalog.edit');

  const label = (variantId: string) => {
    const row = watch.directory.get(variantId);
    return row
      ? `${row.brandName} · ${row.productName} · ${row.variantLabel}`
      : variantId;
  };

  // Propuestas con cantidad → borradores por proveedor (solo con compras).
  const reorders = watch.findings.filter(
    (
      f,
    ): f is StockFinding & {
      proposal: { kind: 'reorder'; quantity: number };
    } => f.proposal?.kind === 'reorder',
  );
  let groups: ProposalGroupView[] = [];
  let withoutSupplier: string[] = [];
  if (canPurchase && reorders.length > 0) {
    const terms = await listSupplierTerms(staff.supabase, {
      variantIds: reorders.map((f) => f.variantId),
    });
    const suppliers = replenishmentSupplier(terms);
    const grouped = groupProposalsBySupplier(
      reorders.map((f) => {
        const term = suppliers.get(f.variantId);
        return {
          variantId: f.variantId,
          quantity: f.proposal.quantity,
          supplier: term
            ? { id: term.supplierId, name: term.supplierName }
            : null,
          packSize: term?.packSize ?? null,
        };
      }),
    );
    const reasons = new Map(
      reorders.map((f) => [
        f.variantId,
        `${FINDING_LABELS[f.kind]}. ${describeFinding(f)}`,
      ]),
    );
    groups = grouped.bySupplier.map((group) => ({
      supplier: group.supplier,
      lines: group.lines.map((line) => ({
        variantId: line.variantId,
        label: label(line.variantId),
        quantity: line.quantity,
        packSize: line.packSize,
        reason: reasons.get(line.variantId) ?? '',
      })),
    }));
    withoutSupplier = grouped.withoutSupplier;
  }

  const productHref = (variantId: string) => {
    const productId = watch.directory.get(variantId)?.productId;
    if (!productId) return null;
    return canCatalog
      ? `/admin/catalogo/${productId}`
      : `/admin/movimientos?perfume=${productId}`;
  };

  return (
    <main>
      <PageHeader eyebrow={location.name} title="Reposición">
        <Link
          href="/admin/inventario"
          className="border-line hover:border-ink tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Inventario
        </Link>
      </PageHeader>
      <p className="text-smoke mb-10 max-w-3xl text-sm leading-relaxed">
        El vigilante revisa el stock cada vez que abres esta página, con las
        ventas de los últimos {watch.settings.salesWindowDays} días, los plazos
        de los proveedores y lo que ya está pedido. No compra ni cambia nada:
        propone, y una persona decide. Sin plazo ni punto de pedido no inventa
        cantidades.
      </p>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SEVERITIES.map((severity) => (
          <div key={severity} className="panel-card">
            <p className="eyebrow">{SEVERITY_LABELS[severity]}</p>
            <p
              className={`font-display mt-3 text-5xl font-light lining-nums tabular-nums ${summary.bySeverity[severity] ? TONE[severity] : ''}`}
            >
              {summary.bySeverity[severity]}
            </p>
          </div>
        ))}
        <div className="panel-card">
          <p className="eyebrow">Propuestas de compra</p>
          <p className="font-display mt-3 text-5xl font-light lining-nums tabular-nums">
            {summary.reorderProposals}
          </p>
        </div>
      </section>

      {canPurchase && (groups.length > 0 || withoutSupplier.length > 0) && (
        <section className="mt-12 space-y-6">
          <h2 className="text-2xl font-light">Proponer pedidos</h2>
          <ProposalsForm groups={groups} />
          {withoutSupplier.length > 0 && (
            <div className="panel-card">
              <p className="eyebrow">Sin proveedor de reposición</p>
              <p className="text-smoke mt-2 text-sm">
                Asigna un proveedor (o marca uno como preferente) en{' '}
                <Link href="/admin/compras/proveedores" className="underline">
                  Proveedores
                </Link>{' '}
                para poder pedirlos:
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {withoutSupplier.map((variantId) => (
                  <li key={variantId}>{label(variantId)}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {watch.findings.length === 0 ? (
        <p className="text-smoke py-16 text-center">
          Todo en orden: ningún formato necesita atención.
        </p>
      ) : (
        SEVERITIES.map((severity) => {
          const rows = watch.findings.filter((f) => f.severity === severity);
          if (rows.length === 0) return null;
          return (
            <section key={severity} className="mt-12">
              <h2 className={`mb-4 text-2xl font-light ${TONE[severity]}`}>
                {SEVERITY_LABELS[severity]} · {rows.length}
              </h2>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[38rem]">
                  <thead>
                    <tr>
                      <th>Perfume</th>
                      <th>Motivo</th>
                      <th className="text-right">Disponible</th>
                      <th className="text-right">
                        Ventas {watch.settings.salesWindowDays} d
                      </th>
                      <th className="text-right">Propuesta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f) => {
                      const level = watch.levels.get(f.variantId);
                      const facts = watch.facts.get(f.variantId);
                      const href = productHref(f.variantId);
                      return (
                        <tr
                          key={`${f.kind}:${f.variantId}`}
                          className="align-top"
                        >
                          <td className="text-sm">
                            {href ? (
                              <Link href={href} className="link-underline">
                                {label(f.variantId)}
                              </Link>
                            ) : (
                              label(f.variantId)
                            )}
                          </td>
                          <td className="text-sm">
                            {FINDING_LABELS[f.kind]}
                            <p className="text-smoke text-xs">
                              {describeFinding(f)}
                            </p>
                          </td>
                          <td className="text-right tabular-nums">
                            {(level?.onHand ?? 0) - (level?.reserved ?? 0)}
                          </td>
                          <td className="text-smoke text-right tabular-nums">
                            {facts?.unitsSold ?? 0}
                          </td>
                          <td className="text-right tabular-nums">
                            {f.proposal?.kind === 'reorder' ? (
                              <span className="font-semibold">
                                {f.proposal.quantity} uds.
                              </span>
                            ) : (
                              '—'
                            )}
                            <p className="text-smoke text-xs font-normal">
                              {proposalNote(f, facts, level)}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      <section className="border-line mt-16 border-t pt-10">
        <h2 className="mb-2 text-2xl font-light">Parámetros del vigilante</h2>
        <p className="text-smoke mb-6 max-w-3xl text-sm">
          Provisionales hasta que los fije el negocio.{' '}
          {can('settings.manage')
            ? 'Los cambios se aplican al momento y quedan en la auditoría.'
            : 'Solo el administrador del sistema puede cambiarlos.'}{' '}
          El punto de pedido de cada formato se fija en Inventario → Alerta.
        </p>
        <WatchSettingsForm
          settings={watch.settings}
          editable={can('settings.manage')}
        />
      </section>
    </main>
  );
}
