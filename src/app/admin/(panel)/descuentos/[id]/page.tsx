import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import type { DiscountCode } from '@/modules/promotions';
import { discountStatus, isoToMadridLocal } from '@/modules/promotions';
import { getDiscountCode } from '@/modules/promotions/server';
import { DiscountCodeForm } from '@/modules/promotions/ui';
import type { DiscountCodeFormValues } from '@/modules/promotions/ui';

export const metadata: Metadata = { title: 'Código de descuento' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** «5,00» para el campo; vacío si no hay importe. */
function eurosField(cents: number | null) {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

function formValues(code: DiscountCode): DiscountCodeFormValues {
  return {
    id: code.id,
    code: code.code,
    description: code.description ?? '',
    kind: code.kind,
    value:
      code.kind === 'percent'
        ? String((code.percentBp ?? 0) / 100).replace('.', ',')
        : eurosField(code.amountCents),
    minItems: eurosField(code.minItemsCents),
    startsAt: isoToMadridLocal(code.startsAt),
    endsAt: isoToMadridLocal(code.endsAt),
    maxUses: code.maxUses === null ? '' : String(code.maxUses),
    oncePerEmail: code.oncePerEmail,
    excludeSaleItems: code.excludeSaleItems,
    active: code.active,
  };
}

const STATUS_LABELS = {
  active: 'Activo',
  scheduled: 'Programado',
  expired: 'Caducado',
  exhausted: 'Agotado',
  inactive: 'Apagado',
} as const;

export default async function DiscountCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  const { supabase } = await requirePermission('promotions.manage');
  const { id } = await params;
  const { creado } = await searchParams;
  if (!UUID.test(id)) notFound();
  const code = await getDiscountCode(supabase, id);
  if (!code) notFound();
  const status = discountStatus(code);

  return (
    <main>
      <PageHeader eyebrow="Código de descuento" title={code.code}>
        <Link
          href="/admin/descuentos"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Volver a los códigos
        </Link>
      </PageHeader>

      {creado && (
        <p
          role="status"
          className="bg-surface-raised/50 border-success/30 text-success mb-8 border-l-2 px-4 py-3 text-sm"
        >
          Código creado. Ya puedes ponerlo en la campaña de Sender.
        </p>
      )}

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-fg-muted text-xs">Estado</p>
          <p className="mt-2">
            <Badge tone={status === 'active' ? 'success' : 'neutral'}>
              {STATUS_LABELS[status]}
            </Badge>
          </p>
        </Card>
        <Card>
          <p className="text-fg-muted text-xs">Usos (vivos o cobrados)</p>
          <p className="font-display mt-1 text-4xl tabular-nums">
            {code.uses}
            {code.maxUses !== null && (
              <span className="text-fg-muted text-xl"> / {code.maxUses}</span>
            )}
          </p>
        </Card>
        <Card>
          <p className="text-fg-muted text-xs">Pedidos cobrados</p>
          <p className="font-display mt-1 text-4xl tabular-nums">
            {code.paidUses}
          </p>
          <p className="text-fg-muted text-xs">
            {formatEuros(code.paidDiscountCents, 'es')} descontados
          </p>
        </Card>
      </div>

      <DiscountCodeForm values={formValues(code)} />
    </main>
  );
}
