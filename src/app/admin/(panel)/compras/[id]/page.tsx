import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { formatEuros } from '@/lib/money';
import { PageHeader, PrintButton } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { listVariantDirectory } from '@/modules/inventory/server';
import {
  ORDER_STATUS_LABELS,
  availableOrderActions,
  canEditLines,
  canReceive,
  isOpenOrder,
  orderCostCents,
} from '@/modules/purchasing';
import {
  getPurchaseOrder,
  listSupplierTerms,
} from '@/modules/purchasing/server';
import {
  OrderHeaderForm,
  OrderLinesEditor,
  OrderStatusActions,
  ReceiveForm,
} from '@/modules/purchasing/ui';
import { Eyebrow, Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Pedido de compra' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeZone: 'Europe/Madrid',
});
const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

function Section({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-border border-t py-10 ${className}`}>
      <h2 className="mb-6 text-2xl font-light">{title}</h2>
      {children}
    </section>
  );
}

export default async function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requirePermission('purchasing.manage');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getPurchaseOrder(staff.supabase, id);
  if (!detail) notFound();
  const { order, lines, receipts } = detail;
  const can = (p: Parameters<typeof isAllowed>[1]) =>
    isAllowed({ role: staff.role, aal: 'aal2' }, p);
  const canCost = can('pricing.view_cost');
  const [directory, terms] = await Promise.all([
    listVariantDirectory(staff.supabase),
    listSupplierTerms(staff.supabase, { supplierId: order.supplierId }),
  ]);
  const variants = directory.map((row) => ({
    variantId: row.variantId,
    productName: row.productName,
    brandName: row.brandName,
    variantLabel: row.variantLabel,
    sku: row.sku,
    ean: row.ean,
  }));
  const byId = new Map(variants.map((v) => [v.variantId, v]));
  const termMap = Object.fromEntries(
    terms.map((t) => [
      t.variantId,
      { supplierSku: t.supplierSku, packSize: t.packSize },
    ]),
  );
  const name = (variantId: string) => {
    const v = byId.get(variantId);
    return v
      ? `${v.brandName} · ${v.productName} · ${v.variantLabel}`
      : 'Formato archivado';
  };
  const total = orderCostCents(
    lines.map((l) => ({
      quantity: l.quantityOrdered,
      unitCostCents: l.unitCostNetCents,
    })),
  );

  const linesTable = (
    <div className="overflow-x-auto">
      <Table
        caption="Líneas del pedido"
        stacked={false}
        className="min-w-[40rem]"
      >
        <thead>
          <tr>
            <th>Perfume</th>
            <th>Ref. proveedor</th>
            <th className="text-right">Pedido</th>
            <th className="text-right">Recibido</th>
            {canCost && <th className="text-right">Coste neto ud.</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.lineId}>
              <td className="text-sm">{name(line.variantId)}</td>
              <td className="text-fg-muted text-sm">
                {line.supplierSku ?? '—'}
              </td>
              <td className="text-right tabular-nums">
                {line.quantityOrdered}
              </td>
              <td
                className={`text-right tabular-nums ${line.quantityReceived < line.quantityOrdered && order.status !== 'draft' ? 'text-danger' : ''}`}
              >
                {line.quantityReceived}
              </td>
              {canCost && (
                <td className="text-right tabular-nums">
                  {line.unitCostNetCents === null
                    ? '—'
                    : formatEuros(line.unitCostNetCents, 'es')}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
      {canCost && (
        <p className="text-fg-muted mt-3 text-right text-sm">
          {total === null
            ? 'Coste total: falta el coste de alguna línea.'
            : `Coste total ${formatEuros(total, 'es')} sin IVA`}
        </p>
      )}
    </div>
  );

  return (
    <main>
      <PageHeader
        eyebrow={`Pedido a ${order.supplierName}`}
        title={order.number}
      >
        <Link
          href="/admin/compras"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase print:hidden"
        >
          Todos los pedidos
        </Link>
        <span className="print:hidden">
          <PrintButton>Imprimir pedido</PrintButton>
        </span>
      </PageHeader>

      <dl className="mb-8 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <Eyebrow as="dt">Estado</Eyebrow>
          <dd className="mt-1 font-semibold">
            {ORDER_STATUS_LABELS[order.status]}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Proveedor</Eyebrow>
          <dd className="mt-1">
            <Link
              href={`/admin/compras/proveedores/${order.supplierId}`}
              className="link-underline"
            >
              {order.supplierName}
            </Link>
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Entrega en</Eyebrow>
          <dd className="mt-1">{order.locationName}</dd>
        </div>
        <div>
          <Eyebrow as="dt">Fechas</Eyebrow>
          <dd className="mt-1">
            Creado {DATE.format(new Date(order.createdAt))}
            {order.orderedAt &&
              ` · pedido ${DATE.format(new Date(order.orderedAt))}`}
            {order.closedAt &&
              ` · cerrado ${DATE.format(new Date(order.closedAt))}`}
          </dd>
        </div>
      </dl>

      <div className="mb-10 print:hidden">
        <OrderStatusActions
          orderId={order.id}
          revision={order.revision}
          actions={availableOrderActions(order.status)}
          canDelete={order.status === 'draft'}
        />
      </div>

      {isOpenOrder(order.status) && (
        <Section title="Datos del pedido" className="print:hidden">
          <OrderHeaderForm
            orderId={order.id}
            revision={order.revision}
            expectedOn={order.expectedOn}
            supplierReference={order.supplierReference}
            notes={order.notes}
          />
        </Section>
      )}

      <Section title="Líneas">
        {canEditLines(order.status) ? (
          <>
            <div className="print:hidden">
              <OrderLinesEditor
                orderId={order.id}
                revision={order.revision}
                lines={lines}
                variants={variants}
                terms={termMap}
                canCost={canCost}
              />
            </div>
            <div className="hidden print:block">{linesTable}</div>
          </>
        ) : lines.length === 0 ? (
          <p className="text-fg-muted text-sm">El pedido no tiene líneas.</p>
        ) : (
          linesTable
        )}
        {(order.expectedOn || order.supplierReference || order.notes) && (
          <p className="text-fg-muted mt-4 hidden text-sm print:block">
            {order.expectedOn &&
              `Llegada prevista: ${DATE.format(new Date(`${order.expectedOn}T12:00:00Z`))}. `}
            {order.supplierReference && `Ref.: ${order.supplierReference}. `}
            {order.notes}
          </p>
        )}
      </Section>

      {(canReceive(order.status) || receipts.length > 0) && (
        <Section title="Recibir mercancía" className="print:hidden">
          <ReceiveForm
            orderId={order.id}
            lines={lines.map((l) => ({
              lineId: l.lineId,
              variantId: l.variantId,
              ordered: l.quantityOrdered,
              received: l.quantityReceived,
              supplierSku: l.supplierSku,
            }))}
            variants={variants}
            canRecordCosts={canCost && can('pricing.edit_cost')}
            receivable={canReceive(order.status)}
          />
        </Section>
      )}

      {receipts.length > 0 && (
        <Section title="Recepciones" className="print:hidden">
          <ul className="divide-border border-border divide-y border-y">
            {receipts.map((receipt) => (
              <li
                key={receipt.id}
                className="flex flex-wrap items-center justify-between gap-4 py-3 text-sm"
              >
                <span>
                  {DATE_TIME.format(new Date(receipt.at))}
                  <span className="text-fg-muted">
                    {receipt.reference && ` · albarán ${receipt.reference}`}
                    {receipt.actorName && ` · ${receipt.actorName}`}
                    {receipt.costsRecorded > 0 &&
                      ` · ${receipt.costsRecorded} ${receipt.costsRecorded === 1 ? 'coste actualizado' : 'costes actualizados'}`}
                  </span>
                </span>
                <span className="text-success tabular-nums">
                  +{receipt.units}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={`/admin/movimientos?tipo=PURCHASE_RECEIPT`}
            className="link-underline tracking-caps mt-4 inline-block text-xs uppercase"
          >
            Ver recepciones en el historial
          </Link>
        </Section>
      )}
    </main>
  );
}
