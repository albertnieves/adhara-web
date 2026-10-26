import type { Metadata } from 'next';
import Link from 'next/link';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { SHIPPING_ZONE_LABELS } from '@/modules/checkout';
import { STORE_DEFAULTS, storeContent } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { siteUrl } from '@/modules/i18n/seo';
import { PROVIDER_LABELS, transitText, weightText } from '@/modules/shipping';
import {
  getShippingSettings,
  listShippingServices,
  listShippingZones,
  sendcloudConfig,
} from '@/modules/shipping/server';
import {
  ServiceForm,
  ServiceToggle,
  ShippingSettingsForm,
  ShippingZoneForm,
  SyncServicesButton,
} from '@/modules/shipping/ui';
import { Badge, Card, Eyebrow, Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Envíos' };
// La sincronización cotiza muchos pesos en la plataforma.
export const maxDuration = 60;

const ZONE_NOTES = {
  peninsula:
    'Códigos postales de la península: del 01 al 50, salvo 07 (Baleares) y 35 y 38 (Canarias).',
  baleares: 'Códigos postales que empiezan por 07.',
} as const;

/** Portal de Sendcloud (envíos a mano, etiquetas y facturas). */
const SENDCLOUD_PORTAL = 'https://app.sendcloud.com/';

const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

/** «4,95» para el campo; vacío si no hay importe. */
function eurosField(cents: number | null | undefined) {
  return cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Envíos de la tienda online (DECISIONS §171–176): el cliente paga según el
 * peso del pedido y el transportista que elige. Los servicios llegan de la
 * plataforma (Sendcloud) con su coste real por tramo de peso, o se escriben a
 * mano (contrato propio sin API). Sin servicio activo en una zona no se ofrece
 * el envío a ella; la recogida en la tienda es siempre gratis.
 */
export default async function ShippingSettingsPage() {
  const { supabase, role } = await requirePermission('settings.manage');
  const canSeeCosts = isAllowed({ role, aal: 'aal2' }, 'pricing.view_cost');
  const [settings, zones, services, storeData] = await Promise.all([
    getShippingSettings(supabase),
    listShippingZones(supabase),
    listShippingServices(supabase),
    readStoreContent('store', 'es'),
  ]);
  const store = storeData
    ? storeContent.parse(storeData.payload)
    : STORE_DEFAULTS;
  const config = sendcloudConfig();
  const webhookUrl = new URL('/api/envios/sendcloud', siteUrl()).toString();
  const lastSync = services
    .filter((s) => s.provider === 'sendcloud' && s.syncedAt)
    .map((s) => s.syncedAt as string)
    .sort()
    .at(-1);
  const activeIn = (zone: string) =>
    services.filter((s) => s.active && s.zones.includes(zone as 'peninsula'))
      .length;

  return (
    <main>
      <PageHeader eyebrow="Configuración" title="Envíos">
        <Link
          href="/admin/catalogo/pesos"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Pesos de los formatos
        </Link>
        <Link
          href="/admin/envios"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Envíos y recogidas
        </Link>
      </PageHeader>
      <p className="text-fg-muted mb-8 max-w-3xl text-sm leading-relaxed">
        El cliente elige transportista al pagar y paga el precio de su tramo de
        peso: el coste real del transportista sin IVA, más el IVA del envío y el
        recargo del servicio. El peso es el de los formatos (pésalos en «Pesos
        de los formatos») más el embalaje. La base vuelve a calcularlo todo al
        crear el pedido. Canarias, Ceuta y Melilla no tienen envío (IGIC y
        aduana).
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
                  className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
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
                  Guarda antes el remitente: las tarifas se cotizan desde la
                  tienda.
                </p>
              )}
              <p className="text-fg-muted text-xs leading-relaxed">
                Seguimiento automático: en Sendcloud → Settings → Integrations →
                la integración de API, marca «Webhook feedback enabled» con la
                URL <code className="break-all">{webhookUrl}</code>.
              </p>
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
            <Eyebrow as="h2">Remitente, embalaje y recogidas</Eyebrow>
            {!settings && <Badge tone="warning">Pendiente</Badge>}
          </div>
          {!settings && (
            <p className="text-fg-muted mb-4 text-sm">
              Sin estos datos no se calcula el peso de los pedidos y no se
              ofrece el envío.
            </p>
          )}
          <ShippingSettingsForm
            values={{
              senderName: settings?.senderName ?? 'L’Atelier du Désert',
              senderContact: settings?.senderContact ?? '',
              addressLine1: settings?.addressLine1 ?? store.address,
              houseNumber: settings?.houseNumber ?? '',
              addressLine2: settings?.addressLine2 ?? '',
              postalCode: settings?.postalCode ?? '',
              city: settings?.city ?? store.city,
              phone: settings?.phone ?? store.phone,
              email: settings?.email ?? store.email,
              packagingWeightG: settings
                ? String(settings.packagingWeightG)
                : '',
              maxWeightG: String(settings?.maxWeightG ?? 10000),
              parcelLength: settings?.parcel
                ? String(settings.parcel.lengthCm)
                : '',
              parcelWidth: settings?.parcel
                ? String(settings.parcel.widthCm)
                : '',
              parcelHeight: settings?.parcel
                ? String(settings.parcel.heightCm)
                : '',
              pickupStart: settings?.pickupStart ?? '10:00',
              pickupEnd: settings?.pickupEnd ?? '14:00',
              vatPercent: String((settings?.vatBp ?? 2100) / 100).replace(
                '.',
                ',',
              ),
            }}
          />
        </Card>

        {zones.map((zone) => (
          <Card as="section" key={zone.zone}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Eyebrow as="h2">{SHIPPING_ZONE_LABELS[zone.zone]}</Eyebrow>
              <Badge
                tone={
                  zone.active && activeIn(zone.zone) > 0 ? 'success' : 'neutral'
                }
              >
                {zone.active
                  ? activeIn(zone.zone) > 0
                    ? `Con envío · ${activeIn(zone.zone)} ${activeIn(zone.zone) === 1 ? 'servicio' : 'servicios'}`
                    : 'Activa sin servicios'
                  : 'Sin envío'}
              </Badge>
              {zone.freeFromCents !== null && (
                <span className="text-fg-muted text-xs">
                  gratis desde {formatEuros(zone.freeFromCents, 'es')}
                </span>
              )}
            </div>
            <p className="text-fg-muted mb-4 text-xs">
              {ZONE_NOTES[zone.zone]}
            </p>
            <ShippingZoneForm
              zone={zone.zone}
              freeFrom={eurosField(zone.freeFromCents)}
              active={zone.active}
            />
          </Card>
        ))}

        <Card as="section">
          <Eyebrow as="h2" className="mb-4">
            Servicios
          </Eyebrow>
          {services.length > 0 && (
            <p className="text-fg-muted mb-4 max-w-3xl text-sm leading-relaxed">
              «Encender» hace que el servicio salga al pagar en sus zonas (si la
              zona tiene «Ofrecer el envío»); «Apagar» lo quita al momento. Para
              cambiar el nombre, el plazo, el recargo o las zonas, entra en su
              ficha pulsando el nombre. Enciende solo los transportistas que
              aceptan perfumes.
            </p>
          )}
          {services.length === 0 ? (
            <p className="text-fg-muted mb-6 text-sm">
              Aún no hay servicios: actualiza las tarifas desde Sendcloud o
              añade uno manual.
            </p>
          ) : (
            <div className="mb-8 overflow-x-auto">
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
                            href={`/admin/configuracion/envios/${service.id}`}
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
          <h3 className="mb-4 text-lg">Añadir un servicio manual</h3>
          <p className="text-fg-muted mb-4 max-w-3xl text-sm">
            Para un contrato propio sin API (por ejemplo, Correos o SEUR
            mientras llega la plataforma): escribes sus tramos de peso con el
            coste sin IVA y la etiqueta se hace en la web del transportista; en
            la ficha del pedido se apunta el número de seguimiento.
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
        </Card>
      </div>
    </main>
  );
}
