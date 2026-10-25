import 'server-only';
import { cache } from 'react';
import { createSupabasePublicClient } from '@/lib/supabase/public';
import { storeContent, STORE_DEFAULTS } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { LEGAL_CONTACT_EMAIL, LEGAL_ENTITY } from '../domain/entity';
import { resolveValue } from '../domain/placeholders';
import type { LegalShippingZone } from '../domain/shipping';
import { freeShippingText, shippingCostText } from '../domain/shipping';
import type { LegalField } from '../domain/types';

export type LegalValues = Partial<Record<LegalField, string | null>>;

/**
 * Zonas con «Ofrecer el envío» de Panel → Configuración → Envíos (la tienda
 * lee solo las activas). Si no se pueden leer, la línea no se publica.
 */
const activeShippingZones = cache(async (): Promise<LegalShippingZone[]> => {
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('shipping_rates')
    .select('zone, free_from_cents')
    .eq('active', true);
  if (error) {
    console.error(
      '[legal] no se pudieron leer las zonas de envío',
      error.message,
    );
    return [];
  }
  return (data ?? []).flatMap((row) =>
    row.zone === 'peninsula' || row.zone === 'baleares'
      ? [{ zone: row.zone, freeFromCents: row.free_from_cents }]
      : [],
  );
});

/**
 * Datos para los marcadores de los textos legales: los del titular y los de
 * la tienda (panel). Los usan las páginas legales y el correo de
 * confirmación de los pedidos, que adjunta las condiciones de venta. Los
 * gastos de envío salen de las zonas activas del panel (por peso y
 * transportista, §172), salvo que LEGAL_ENTITY fije otro texto (§168).
 */
export async function legalValues(
  locale: 'es' | 'ca' | 'en',
): Promise<LegalValues> {
  const [data, rates] = await Promise.all([
    readStoreContent('store', 'es'),
    activeShippingZones(),
  ]);
  const store = data ? storeContent.parse(data.payload) : STORE_DEFAULTS;
  const entity: LegalValues = Object.fromEntries(
    Object.entries(LEGAL_ENTITY).map(([field, value]) => [
      field,
      resolveValue(value, locale),
    ]),
  );
  return {
    ...entity,
    shippingCost: entity.shippingCost ?? shippingCostText(rates, locale),
    freeShippingFrom:
      entity.freeShippingFrom ?? freeShippingText(rates, locale),
    email: store.email || LEGAL_CONTACT_EMAIL,
    phone: store.phone || null,
    storeAddress: [store.address, store.city].filter(Boolean).join(', '),
  };
}
