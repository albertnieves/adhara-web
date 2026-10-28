import type { Metadata } from 'next';
import { formatEuros } from '@/lib/money';
import { requirePermission } from '@/modules/auth/server';
import { SHIPPING_ZONE_LABELS } from '@/modules/checkout';
import { STORE_DEFAULTS, storeContent } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import {
  getShippingSettings,
  listShippingServices,
  listShippingZones,
} from '@/modules/shipping/server';
import { ShippingSettingsForm, ShippingZoneForm } from '@/modules/shipping/ui';
import { Badge, Card, Eyebrow } from '@/components/ui';

export const metadata: Metadata = { title: 'Remitente y zonas de envío' };

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
 * Envíos → Remitente y zonas (DECISIONS §172, §177): la dirección de la
 * tienda para etiquetas y recogidas, el embalaje que se suma al peso, la
 * franja de recogida, el IVA del envío y a qué zonas se envía y desde cuánto
 * es gratis. Sin remitente no hay envío.
 */
export default async function ShippingSettingsPage() {
  const { supabase } = await requirePermission('settings.manage');
  const [settings, zones, services, storeData] = await Promise.all([
    getShippingSettings(supabase),
    listShippingZones(supabase),
    listShippingServices(supabase),
    readStoreContent('store', 'es'),
  ]);
  const store = storeData
    ? storeContent.parse(storeData.payload)
    : STORE_DEFAULTS;
  const activeIn = (zone: string) =>
    services.filter((s) => s.active && s.zones.includes(zone as 'peninsula'))
      .length;

  return (
    <div className="space-y-6">
      <p className="text-fg-muted max-w-3xl text-sm leading-relaxed">
        Canarias, Ceuta y Melilla no tienen envío (IGIC y aduana). La recogida
        en la tienda es siempre gratis.
      </p>

      <Card as="section">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Eyebrow as="h2">Remitente, embalaje y recogidas</Eyebrow>
          {!settings && <Badge tone="warning">Pendiente</Badge>}
        </div>
        {!settings && (
          <p className="text-fg-muted mb-4 text-sm">
            Sin estos datos no se calcula el peso de los pedidos y no se ofrece
            el envío.
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
            packagingWeightG: settings ? String(settings.packagingWeightG) : '',
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

      <div className="grid gap-6 2xl:grid-cols-2">
        {zones.map((zone) => {
          const count = activeIn(zone.zone);
          return (
            <Card as="section" key={zone.zone}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Eyebrow as="h2">{SHIPPING_ZONE_LABELS[zone.zone]}</Eyebrow>
                <Badge tone={zone.active && count > 0 ? 'success' : 'neutral'}>
                  {zone.active
                    ? count > 0
                      ? `Con envío · ${count} ${count === 1 ? 'servicio' : 'servicios'}`
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
          );
        })}
      </div>
    </div>
  );
}
