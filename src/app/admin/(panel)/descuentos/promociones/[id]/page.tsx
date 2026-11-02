import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import type { Promotion, PromotionStatus } from '@/modules/promotions';
import {
  isoToMadridLocal,
  promotionStatus,
  promotionSummary,
} from '@/modules/promotions';
import { getPromotion, listPromotionBrands } from '@/modules/promotions/server';
import { PromotionForm } from '@/modules/promotions/ui';
import type { PromotionFormValues } from '@/modules/promotions/ui';

export const metadata: Metadata = { title: 'Promoción' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** «5,00» para el campo. */
function eurosField(cents: number | null) {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

function formValues(promotion: Promotion): PromotionFormValues {
  return {
    id: promotion.id,
    name: promotion.name,
    kind: promotion.kind,
    value:
      promotion.kind === 'percent'
        ? String((promotion.percentBp ?? 0) / 100).replace('.', ',')
        : eurosField(promotion.amountCents),
    minItems: eurosField(promotion.minItemsCents),
    brandId: promotion.brandId ?? '',
    excludeSaleItems: promotion.excludeSaleItems,
    startsAt: isoToMadridLocal(promotion.startsAt),
    endsAt: isoToMadridLocal(promotion.endsAt),
    active: promotion.active,
  };
}

const STATUS: Record<PromotionStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Activa', tone: 'success' },
  scheduled: { label: 'Programada', tone: 'accent' },
  expired: { label: 'Terminada', tone: 'neutral' },
  inactive: { label: 'Apagada', tone: 'neutral' },
};

export default async function PromotionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creada?: string }>;
}) {
  const { supabase } = await requirePermission('promotions.manage');
  const { id } = await params;
  const { creada } = await searchParams;
  if (!UUID.test(id)) notFound();
  const [promotion, brands] = await Promise.all([
    getPromotion(supabase, id),
    listPromotionBrands(supabase),
  ]);
  if (!promotion) notFound();
  const status = STATUS[promotionStatus(promotion)];

  return (
    <main>
      <PageHeader eyebrow="Promoción automática" title={promotion.name}>
        <Link
          href="/admin/descuentos"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Volver a los descuentos
        </Link>
      </PageHeader>

      {creada && (
        <p
          role="status"
          className="bg-surface-raised/50 border-success/30 text-success mb-8 border-l-2 px-4 py-3 text-sm"
        >
          Promoción creada. La tienda la aplica sola mientras esté activa y
          dentro de sus fechas.
        </p>
      )}

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-fg-muted text-xs">Estado</p>
          <p className="mt-2">
            <Badge tone={status.tone}>{status.label}</Badge>
          </p>
          <p className="text-fg-muted mt-2 text-xs">
            {promotionSummary(promotion)}
          </p>
        </Card>
        <Card>
          <p className="text-fg-muted text-xs">Pedidos (vivos o cobrados)</p>
          <p className="font-display mt-1 text-4xl tabular-nums">
            {promotion.uses}
          </p>
        </Card>
        <Card>
          <p className="text-fg-muted text-xs">Pedidos cobrados</p>
          <p className="font-display mt-1 text-4xl tabular-nums">
            {promotion.paidUses}
          </p>
          <p className="text-fg-muted text-xs">
            {formatEuros(promotion.paidDiscountCents, 'es')} descontados
          </p>
        </Card>
      </div>

      <PromotionForm values={formValues(promotion)} brands={brands} />
    </main>
  );
}
