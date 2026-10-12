import type { Metadata } from 'next';
import Link from 'next/link';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { SHIPPING_ZONE_LABELS, SHIPPING_ZONES } from '@/modules/checkout';
import { listShippingRates } from '@/modules/checkout/server';
import { ShippingRateForm } from '@/modules/checkout/ui';
import { Badge, Card, Eyebrow } from '@/components/ui';

export const metadata: Metadata = { title: 'Envíos' };

const ZONE_NOTES = {
  peninsula:
    'Códigos postales de la península: del 01 al 50, salvo 07 (Baleares) y 35 y 38 (Canarias).',
  baleares: 'Códigos postales que empiezan por 07.',
} as const;

/** «4,95» para el campo; vacío si no hay importe. */
function eurosField(cents: number | null | undefined) {
  return cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Tarifas de envío de la tienda online (P03, DECISIONS §136). Sin tarifa
 * activa, la tienda no ofrece el envío a esa zona; la recogida en tienda es
 * siempre gratis. Canarias, Ceuta y Melilla no tienen envío.
 */
export default async function ShippingSettings() {
  const { supabase } = await requirePermission('settings.manage');
  const rates = await listShippingRates(supabase);
  const byZone = new Map(rates.map((rate) => [rate.zone, rate]));

  return (
    <main>
      <PageHeader eyebrow="Configuración" title="Envíos">
        <Link
          href="/admin/configuracion"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Datos de la tienda
        </Link>
      </PageHeader>
      <p className="text-fg-muted mb-8 max-w-2xl text-sm leading-relaxed">
        Precio del envío a domicilio por zona, con IVA. La tienda lo enseña
        antes de pagar y la base lo vuelve a calcular al crear el pedido. Sin
        tarifa activa no se ofrece el envío a esa zona; la recogida en la tienda
        es siempre gratis. Canarias, Ceuta y Melilla no tienen envío (IGIC y
        aduana).
      </p>
      <div className="space-y-6">
        {SHIPPING_ZONES.map((zone) => {
          const rate = byZone.get(zone);
          return (
            <Card as="section" key={zone}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Eyebrow as="h2">{SHIPPING_ZONE_LABELS[zone]}</Eyebrow>
                <Badge tone={rate?.active ? 'success' : 'neutral'}>
                  {rate?.active ? 'Activo' : 'Sin envío'}
                </Badge>
                {rate && (
                  <span className="text-fg-muted text-xs">
                    {formatEuros(rate.priceCents, 'es')}
                    {rate.freeFromCents !== null &&
                      ` · gratis desde ${formatEuros(rate.freeFromCents, 'es')}`}
                  </span>
                )}
              </div>
              <p className="text-fg-muted mb-4 text-xs">{ZONE_NOTES[zone]}</p>
              <ShippingRateForm
                zone={zone}
                price={eurosField(rate?.priceCents)}
                freeFrom={eurosField(rate?.freeFromCents)}
                active={rate?.active ?? false}
              />
            </Card>
          );
        })}
      </div>
    </main>
  );
}
