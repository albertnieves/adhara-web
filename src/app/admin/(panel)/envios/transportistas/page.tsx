import type { Metadata } from 'next';
import Link from 'next/link';
import { formatEuros } from '@/lib/money';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { SHIPPING_ZONE_LABELS } from '@/modules/checkout';
import { siteUrl } from '@/modules/i18n/seo';
import { PROVIDER_LABELS, transitText, weightText } from '@/modules/shipping';
import {
  getShippingSettings,
  listShippingServices,
  sendcloudConfig,
} from '@/modules/shipping/server';
import {
  ServiceForm,
  ServiceToggle,
  SyncServicesButton,
} from '@/modules/shipping/ui';
import {
  Badge,
  buttonClass,
  Card,
  Eyebrow,
  Icon,
  Table,
} from '@/components/ui';

export const metadata: Metadata = { title: 'Transportistas y tarifas' };
// La sincronización cotiza muchos pesos en la plataforma.
export const maxDuration = 60;

/** Portal de Sendcloud (envíos a mano, etiquetas y facturas). */
const SENDCLOUD_PORTAL = 'https://app.sendcloud.com/';

const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

/**
 * Envíos → Transportistas y tarifas (DECISIONS §171–177): el cliente paga
 * según el peso del pedido y el transportista que elige. Los servicios llegan
 * de la plataforma (Sendcloud) con su coste real por tramo de peso, o se
 * escriben a mano (contrato propio sin API). Sin servicio activo en una zona
 * no se ofrece el envío a ella; la recogida en la tienda es siempre gratis.
 */
export default async function ShippingCarriersPage() {
  const { supabase, role } = await requirePermission('settings.manage');
  const canSeeCosts = isAllowed({ role, aal: 'aal2' }, 'pricing.view_cost');
  const [settings, services] = await Promise.all([
    getShippingSettings(supabase),
    listShippingServices(supabase),
  ]);
  const config = sendcloudConfig();
  const webhookUrl = new URL('/api/envios/sendcloud', siteUrl()).toString();
  const lastSync = services
    .filter((s) => s.provider === 'sendcloud' && s.syncedAt)
    .map((s) => s.syncedAt as string)
    .sort()
    .at(-1);
  const active = services.filter((s) => s.active).length;

  return (
    <div>
      <p className="text-fg-muted mb-8 max-w-3xl text-sm leading-relaxed">
        El cliente elige transportista al pagar y paga el precio de su tramo de
        peso: el coste real del transportista sin IVA, más el IVA del envío y el
        recargo del servicio. El peso es el de los formatos (en «Pesos de los
        formatos») más el embalaje (en «Remitente y zonas»). La base vuelve a
        calcularlo todo al crear el pedido.
      </p>

      <div className="space-y-6">
        <Card as="section">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Eyebrow as="h2">Plataforma multitransportista</Eyebrow>
            <Badge tone={config ? 'success' : 'warning'}>
              {config ? 'Sendcloud conectado' : 'Sin conectar'}
            </Badge>
          </div>
          {config ? (
            <div className="space-y-4 text-sm">
              <p className="text-fg-muted max-w-3xl leading-relaxed">
                Las tarifas se cotizan desde la tienda hasta Madrid, Sevilla y A
                Coruña (península) y Palma, Maó y Eivissa (Baleares), y de cada
                tramo se queda el coste más alto. Los servicios nuevos entran
                apagados: revisa nombre, plazo, zonas y si admiten perfumes
                antes de activarlos.
                {lastSync &&
                  ` Última actualización: ${DATE_TIME.format(new Date(lastSync))}.`}
              </p>
              <div className="flex flex-wrap items-start gap-4">
                <SyncServicesButton disabled={!settings} />
                <a
                  href={SENDCLOUD_PORTAL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass('outline')}
                >
                  Abrir el portal de Sendcloud
                  <span className="sr-only"> (se abre en otra pestaña)</span>
                </a>
              </div>
              <p className="text-fg-muted max-w-3xl leading-relaxed">
                En el portal puedes crear a mano un envío que no viene de la web
                (por ejemplo, un paquete de 1 kg para un cliente de la tienda),
                ver todas las etiquetas y las facturas. Los pedidos web se
                etiquetan desde su ficha en este panel.
              </p>
              {!settings && (
                <p className="text-warning">
                  Guarda antes el remitente en{' '}
                  <Link href="/admin/envios/ajustes" className="link-underline">
                    Remitente y zonas
                  </Link>
                  : las tarifas se cotizan desde la tienda.
                </p>
              )}
              <details className="group text-fg-muted text-xs leading-relaxed">
                <summary className="text-fg inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
                  <Icon
                    name="chevron"
                    size="sm"
                    className="transition-transform duration-(--duration-fast) group-open:rotate-90"
                  />
                  Seguimiento automático: cómo se conecta
                </summary>
                <p className="max-w-3xl pb-2">
                  En Sendcloud → Settings → Integrations → la integración de
                  API, marca «Webhook feedback enabled» con la URL{' '}
                  <code className="break-all">{webhookUrl}</code>.
                </p>
              </details>
            </div>
          ) : (
            <p className="text-fg-muted max-w-3xl text-sm leading-relaxed">
              Con una cuenta de Sendcloud, crea una integración de API y pon sus
              claves en Vercel → Settings → Environment Variables, como
              «Sensitive»: <code>SENDCLOUD_PUBLIC_KEY</code> y{' '}
              <code>SENDCLOUD_SECRET_KEY</code>. Mientras tanto puedes vender
              con servicios manuales (contrato propio, tramos escritos aquí y
              etiqueta en la web del transportista).
            </p>
          )}
        </Card>

        <Card as="section">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Eyebrow as="h2">Servicios</Eyebrow>
            {services.length > 0 && (
              <Badge tone={active > 0 ? 'success' : 'neutral'}>
                {active === 0
                  ? 'Ninguno activo'
                  : `${active} ${active === 1 ? 'activo' : 'activos'} de ${services.length}`}
              </Badge>
            )}
          </div>
          {services.length > 0 && (
            <p className="text-fg-muted mb-4 max-w-3xl text-sm leading-relaxed">
              «Encender» hace que el servicio salga al pagar en sus zonas (si la
              zona tiene «Ofrecer el envío» en «Remitente y zonas»); «Apagar» lo
              quita al momento. Para cambiar el nombre, el plazo, el recargo o
              las zonas, entra en su ficha pulsando el nombre. Enciende solo los
              transportistas que aceptan perfumes.
            </p>
          )}
          {services.length === 0 ? (
            <p className="text-fg-muted mb-6 text-sm">
              Aún no hay servicios: actualiza las tarifas desde Sendcloud o
              añade uno manual.
            </p>
          ) : (
            // relative: el texto oculto de «Encender» / «Apagar» (sr-only, en
            // posición absoluta) se queda dentro del desplazamiento de la tabla.
            <div className="relative mb-8 overflow-x-auto">
              <Table caption="Servicios de envío" className="md:min-w-[52rem]">
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Origen</th>
                    <th>Zonas</th>
                    <th>Tramos</th>
                    <th>Plazo</th>
                    {canSeeCosts && (
                      <th className="text-right">Desde (cliente)</th>
                    )}
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => {
                    const prices = service.rates
                      .map((r) => r.priceCents)
                      .filter((p): p is number => p !== null);
                    const top = Math.max(
                      0,
                      ...service.rates.map((r) => r.maxWeightG),
                    );
                    return (
                      <tr key={service.id}>
                        <td data-primary className="text-sm">
                          <Link
                            href={`/admin/envios/transportistas/${service.id}`}
                            className="link-underline"
                          >
                            {service.label}
                          </Link>
                          {service.dangerousGoods && (
                            <span className="text-fg-muted block text-xs">
                              Admite mercancía peligrosa (ADR)
                            </span>
                          )}
                        </td>
                        <td data-label="Origen" className="text-sm">
                          {PROVIDER_LABELS[service.provider]}
                        </td>
                        <td data-label="Zonas" className="text-sm">
                          {service.zones.length === 0
                            ? '—'
                            : service.zones
                                .map((z) => SHIPPING_ZONE_LABELS[z])
                                .join(', ')}
                        </td>
                        <td data-label="Tramos" className="text-sm">
                          {service.rates.length === 0
                            ? 'Sin tramos'
                            : `${service.rates.length} · hasta ${weightText(top)}`}
                        </td>
                        <td data-label="Plazo" className="text-sm">
                          {transitText(service.transitDays) ?? '—'}
                        </td>
                        {canSeeCosts && (
                          <td
                            data-label="Desde"
                            className="text-right text-sm tabular-nums"
                          >
                            {prices.length > 0
                              ? formatEuros(Math.min(...prices), 'es')
                              : '—'}
                          </td>
                        )}
                        <td data-label="Estado">
                          <ServiceToggle
                            id={service.id}
                            active={service.active}
                            label={service.label}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
          <details
            className="group border-border border-t pt-4"
            open={services.length === 0}
          >
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-lg [&::-webkit-details-marker]:hidden">
              <Icon
                name="plus"
                size="sm"
                className="transition-transform duration-(--duration-fast) group-open:rotate-45"
              />
              Añadir un servicio manual
            </summary>
            <p className="text-fg-muted my-4 max-w-3xl text-sm">
              Para un contrato propio sin API (por ejemplo, Correos o SEUR
              mientras llega la plataforma): escribes sus tramos de peso con el
              coste sin IVA y la etiqueta se hace en la web del transportista;
              en la ficha del pedido se apunta el número de seguimiento.
            </p>
            <ServiceForm
              values={{
                id: '',
                provider: 'manual',
                carrierName: '',
                name: '',
                transitDays: '',
                surcharge: '',
                freeEligible: true,
                active: false,
                zones: ['peninsula'],
                position: '',
                trackingUrlTemplate: '',
                pickupPhone: '',
              }}
            />
          </details>
        </Card>
      </div>
    </div>
  );
}
