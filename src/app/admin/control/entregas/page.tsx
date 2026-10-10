import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import type { BillingStatus, ControlDelivery } from '@/modules/control';
import {
  BILLING_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  billing,
  dayLabel,
  euros,
  isOverdue,
  isPendingDelivery,
  madridToday,
  projectBalance,
  sortDeliveries,
} from '@/modules/control';
import { listCosts, listDeliveries } from '@/modules/control/server';
import { KeyFigure } from '@/modules/control/ui';
import { Badge, buttonClass, EmptyState, Table } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';

export const metadata: Metadata = { title: 'Entregas' };

const STATUS_TONES: Record<ControlDelivery['status'], BadgeTone> = {
  planned: 'neutral',
  in_progress: 'accent',
  delivered: 'success',
  accepted: 'success',
};

const BILLING_TONES: Record<BillingStatus, BadgeTone> = {
  none: 'neutral',
  pending: 'warning',
  invoiced: 'accent',
  paid: 'success',
};

function isLink(reference: string) {
  return /^https:\/\//.test(reference);
}

export default async function DeliveriesPage() {
  const { supabase } = await requirePermission('business.control');
  const today = madridToday();
  const [deliveries, costs] = await Promise.all([
    listDeliveries(supabase),
    listCosts(supabase),
  ]);
  const sorted = sortDeliveries(deliveries);
  const money = billing(deliveries);
  const project = projectBalance(deliveries, costs, today);
  const pending = sorted.filter(isPendingDelivery).length;

  return (
    <main>
      <PageHeader eyebrow="Proyecto" title="Entregas">
        <Link
          href="/admin/control/entregas/nueva"
          className={buttonClass('primary', 'md')}
        >
          Nueva entrega
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KeyFigure
          label="Por facturar"
          value={euros(money.toInvoiceCents)}
          note="Entregado y aún sin factura"
          tone={money.toInvoiceCents > 0 ? 'alert' : 'default'}
        />
        <KeyFigure
          label="Facturado sin cobrar"
          value={euros(money.invoicedCents)}
        />
        <KeyFigure
          label="Cobrado"
          value={euros(money.paidCents)}
          note={`${euros(money.plannedCents)} en ${pending} entregas pendientes`}
        />
        <KeyFigure
          label="Balance del proyecto"
          value={euros(project.balanceCents)}
          tone={project.balanceCents < 0 ? 'alert' : 'default'}
          note={`Facturado ${euros(project.billedCents)} − costes del proyecto ${euros(project.costsCents)}`}
        />
      </div>
      {money.undecided > 0 && (
        <p className="text-fg-muted mt-3 text-xs">
          {money.undecided} entregas con importe no tienen decidida la
          facturación y no cuentan arriba.
        </p>
      )}

      <section className="mt-14">
        {sorted.length === 0 ? (
          <EmptyState
            title="Aún no hay entregas"
            description="Apunta cada entrega al cliente (una fase, una funcionalidad, una PR) con su fecha, su importe y si está facturada y cobrada."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table
              caption="Entregas del proyecto al cliente"
              stacked={false}
              className="min-w-[52rem]"
            >
              <thead>
                <tr>
                  <th>Entrega</th>
                  <th>Estado</th>
                  <th>Prevista</th>
                  <th>Entregada</th>
                  <th className="text-right">Importe</th>
                  <th>Facturación</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr key={d.id}>
                    <td className="text-sm">
                      <Link
                        href={`/admin/control/entregas/${d.id}`}
                        className="inline-flex min-h-11 items-center hover:underline"
                      >
                        {d.title}
                      </Link>
                      {d.reference && (
                        <span className="text-fg-muted block truncate text-xs">
                          {isLink(d.reference) ? (
                            <a
                              href={d.reference}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              {d.reference.replace(/^https:\/\//, '')}
                            </a>
                          ) : (
                            d.reference
                          )}
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONES[d.status]}>
                        {DELIVERY_STATUS_LABELS[d.status]}
                      </Badge>
                    </td>
                    <td
                      className={`text-sm ${isPendingDelivery(d) && isOverdue(d, today) ? 'text-danger font-semibold' : ''}`}
                    >
                      {d.dueOn ? dayLabel(d.dueOn) : '—'}
                    </td>
                    <td className="text-sm">
                      {d.deliveredOn ? dayLabel(d.deliveredOn) : '—'}
                    </td>
                    <td className="text-right tabular-nums">
                      {d.amountNetCents === null
                        ? '—'
                        : euros(d.amountNetCents)}
                    </td>
                    <td>
                      {d.billingStatus ? (
                        <Badge tone={BILLING_TONES[d.billingStatus]}>
                          {BILLING_STATUS_LABELS[d.billingStatus]}
                        </Badge>
                      ) : (
                        <span className="text-fg-muted text-xs">
                          Sin decidir
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
