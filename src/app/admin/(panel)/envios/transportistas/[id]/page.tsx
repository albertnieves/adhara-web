import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { formatEuros } from '@/lib/money';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { SHIPPING_ZONE_LABELS, SHIPPING_ZONES } from '@/modules/checkout';
import {
  FIRST_MILE_LABELS,
  PICKUP_API_CARRIERS,
  PROVIDER_LABELS,
  weightText,
} from '@/modules/shipping';
import { listShippingServices } from '@/modules/shipping/server';
import { ServiceForm, ServiceRatesForm } from '@/modules/shipping/ui';
import { Badge, Card, Eyebrow, Heading, Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Servicio de envío' };

function euros(cents: number | null) {
  return cents === null ? '—' : formatEuros(cents, 'es');
}

/**
 * Envíos → Transportistas y tarifas → un servicio: lo que ve el cliente (nombre, plazo, recargo, zonas,
 * envío gratis) y sus tramos de peso con el coste real y el precio. Los de la
 * plataforma se actualizan desde ella; los manuales se escriben aquí.
 */
export default async function ShippingServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, role } = await requirePermission('settings.manage');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const canSeeCosts = isAllowed({ role, aal: 'aal2' }, 'pricing.view_cost');
  const service = (await listShippingServices(supabase)).find(
    (s) => s.id === id,
  );
  if (!service) notFound();
  const manual = service.provider === 'manual';

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin/envios/transportistas"
          className="link-underline text-fg-muted inline-flex min-h-11 items-center text-sm"
        >
          ← Todos los servicios
        </Link>
        <Heading level={2} size="h3" className="mt-1">
          {service.label}
        </Heading>
      </div>

      <dl className="mb-8 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <Eyebrow as="dt">Estado</Eyebrow>
          <dd className="mt-1">
            <Badge tone={service.active ? 'success' : 'neutral'}>
              {service.active ? 'Activo en la tienda' : 'Apagado'}
            </Badge>
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Origen</Eyebrow>
          <dd className="mt-1">
            {PROVIDER_LABELS[service.provider]}
            {service.provider === 'sendcloud' && (
              <span className="text-fg-muted block text-xs break-all">
                {service.code}
              </span>
            )}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Entrega al transportista</Eyebrow>
          <dd className="mt-1">
            {(service.firstMile && FIRST_MILE_LABELS[service.firstMile]) ?? '—'}
            <span className="text-fg-muted block text-xs">
              {service.provider === 'sendcloud' &&
              PICKUP_API_CARRIERS.has(service.carrierCode)
                ? 'Recogidas por la plataforma'
                : service.pickupPhone
                  ? `Recogidas por teléfono: ${service.pickupPhone}`
                  : 'Sin teléfono de recogidas'}
            </span>
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Mercancía peligrosa</Eyebrow>
          <dd className="mt-1">
            {service.dangerousGoods === null
              ? 'No consta'
              : service.dangerousGoods
                ? 'Admite ADR'
                : 'La plataforma no indica ADR'}
            <span className="text-fg-muted block text-xs">
              Los perfumes llevan alcohol (UN1266): confirma con el
              transportista que los acepta.
            </span>
          </dd>
        </div>
      </dl>

      <div className="space-y-6">
        <Card as="section">
          <Eyebrow as="h3" className="mb-4">
            Lo que ve el cliente
          </Eyebrow>
          <ServiceForm
            values={{
              id: service.id,
              provider: service.provider,
              carrierName: service.carrierName,
              name: service.name,
              transitDays: service.transitDays
                ? String(service.transitDays)
                : '',
              surcharge: service.surchargeCents
                ? (service.surchargeCents / 100).toFixed(2).replace('.', ',')
                : '',
              freeEligible: service.freeEligible,
              active: service.active,
              zones: service.zones,
              position: String(service.position),
              trackingUrlTemplate: service.trackingUrlTemplate ?? '',
              pickupPhone: service.pickupPhone ?? '',
            }}
          />
        </Card>

        {SHIPPING_ZONES.map((zone) => {
          const rates = service.rates.filter((r) => r.zone === zone);
          return (
            <Card as="section" key={zone}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Eyebrow as="h3">Tramos · {SHIPPING_ZONE_LABELS[zone]}</Eyebrow>
                {!service.zones.includes(zone) && (
                  <Badge tone="neutral">No se ofrece</Badge>
                )}
              </div>
              {rates.length === 0 ? (
                <p className="text-fg-muted mb-4 text-sm">
                  Sin tramos en esta zona.
                </p>
              ) : (
                <div className="mb-6 overflow-x-auto">
                  <Table
                    caption={`Tramos de peso en ${SHIPPING_ZONE_LABELS[zone]}`}
                    className="md:min-w-[36rem]"
                  >
                    <thead>
                      <tr>
                        <th>Peso</th>
                        {canSeeCosts && (
                          <th className="text-right">Coste sin IVA</th>
                        )}
                        {canSeeCosts && (
                          <th className="text-right">Precio al cliente</th>
                        )}
                        <th className="text-right">Plazo de la plataforma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates.map((rate) => (
                        <tr key={rate.minWeightG}>
                          <td data-primary className="text-sm">
                            {weightText(rate.minWeightG)} –{' '}
                            {weightText(rate.maxWeightG)}
                          </td>
                          {canSeeCosts && (
                            <td
                              data-label="Coste sin IVA"
                              className="text-right tabular-nums"
                            >
                              {euros(rate.costCents)}
                            </td>
                          )}
                          {canSeeCosts && (
                            <td
                              data-label="Precio al cliente"
                              className="text-right font-semibold tabular-nums"
                            >
                              {euros(rate.priceCents)}
                            </td>
                          )}
                          <td data-label="Plazo" className="text-right text-sm">
                            {rate.leadTimeHours === null
                              ? '—'
                              : `${rate.leadTimeHours} h`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
              {manual && canSeeCosts && (
                <ServiceRatesForm
                  serviceId={service.id}
                  zone={zone}
                  rows={rates.map((r) => ({
                    upTo: String(r.maxWeightG),
                    cost:
                      r.costCents === null
                        ? ''
                        : (r.costCents / 100).toFixed(2).replace('.', ','),
                  }))}
                />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
