import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import type { PromotionStatus, ShippingPromotion } from '@/modules/promotions';
import {
  isoToMadridLocal,
  promotionStatus,
  shippingPromotionSummary,
} from '@/modules/promotions';
import { getShippingPromotion } from '@/modules/promotions/server';
import { ShippingPromotionForm } from '@/modules/promotions/ui';
import type { ShippingPromotionFormValues } from '@/modules/promotions/ui';

export const metadata: Metadata = { title: 'Envío gratis' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formValues(promotion: ShippingPromotion): ShippingPromotionFormValues {
  return {
    id: promotion.id,
    name: promotion.name,
    minItems:
      promotion.minItemsCents === 0
        ? ''
        : (promotion.minItemsCents / 100).toFixed(2).replace('.', ','),
    zones: promotion.zones,
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

/**
 * Ficha de un envío gratis temporal (DECISIONS §189): estado, pedidos con el
 * envío regalado y lo que se dejó de cobrar, y el mismo formulario del alta.
 */
export default async function ShippingPromotionPage({
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
  const promotion = await getShippingPromotion(supabase, id);
  if (!promotion) notFound();
  const status = STATUS[promotionStatus(promotion)];

  return (
    <main>
      <PageHeader eyebrow="Envío gratis temporal" title={promotion.name}>
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
          Envío gratis creado. La tienda lo aplica solo mientras esté activo y
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
            {shippingPromotionSummary(promotion)}
          </p>
        </Card>
        <Card>
          <p className="text-fg-muted text-xs">Pedidos (vivos o cobrados)</p>
          <p className="font-display mt-1 text-4xl tabular-nums">
            {promotion.uses}
          </p>
          <p className="text-fg-muted text-xs">
            Solo los que pagaban envío sin ella.
          </p>
        </Card>
        <Card>
          <p className="text-fg-muted text-xs">Pedidos cobrados</p>
          <p className="font-display mt-1 text-4xl tabular-nums">
            {promotion.paidUses}
          </p>
          <p className="text-fg-muted text-xs">
            {formatEuros(promotion.paidWaivedCents, 'es')} de envío regalados
          </p>
        </Card>
      </div>

      <ShippingPromotionForm values={formValues(promotion)} />
    </main>
  );
}
