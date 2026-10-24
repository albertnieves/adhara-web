import 'server-only';
import { cache } from 'react';
import { createSupabasePublicClient } from '@/lib/supabase/public';
import { storeContent, STORE_DEFAULTS } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { LEGAL_CONTACT_EMAIL, LEGAL_ENTITY } from '../domain/entity';
import { resolveValue } from '../domain/placeholders';
import type { LegalShippingRate } from '../domain/shipping';
import { freeShippingText, shippingCostText } from '../domain/shipping';
import type { LegalField } from '../domain/types';

export type LegalValues = Partial<Record<LegalField, string | null>>;

/**
 * Tarifas activas de Panel → Configuración → Tarifas de envío (la tienda lee
 * solo las activas). Si no se pueden leer, la línea no se publica.
 */
const activeShippingRates = cache(async (): Promise<LegalShippingRate[]> => {
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('shipping_rates')
    .select('zone, price_cents, free_from_cents')
    .eq('active', true);
  if (error) {
    console.error('[legal] no se pudieron leer las tarifas', error.message);
    return [];
  }
  return (data ?? []).flatMap((row) =>
    row.zone === 'peninsula' || row.zone === 'baleares'
      ? [
          {
            zone: row.zone,
            priceCents: row.price_cents,
            freeFromCents: row.free_from_cents,
          },
        ]
      : [],
  );
});

/**
 * Datos para los marcadores de los textos legales: los del titular y los de
 * la tienda (panel). Los usan las páginas legales y el correo de
 * confirmación de los pedidos, que adjunta las condiciones de venta. Los
 * gastos de envío salen de las tarifas activas del panel, salvo que
 * LEGAL_ENTITY fije otro texto (DECISIONS §168).
 */
export async function legalValues(
  locale: 'es' | 'ca' | 'en',
): Promise<LegalValues> {
  const [data, rates] = await Promise.all([
    readStoreContent('store', 'es'),
    activeShippingRates(),
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
