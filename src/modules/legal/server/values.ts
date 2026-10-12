import 'server-only';
import { storeContent, STORE_DEFAULTS } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { LEGAL_CONTACT_EMAIL, LEGAL_ENTITY } from '../domain/entity';
import { resolveValue } from '../domain/placeholders';
import type { LegalField } from '../domain/types';

export type LegalValues = Partial<Record<LegalField, string | null>>;

/**
 * Datos para los marcadores de los textos legales: los del titular y los de
 * la tienda (panel). Los usan las páginas legales y el correo de
 * confirmación de los pedidos, que adjunta las condiciones de venta.
 */
export async function legalValues(
  locale: 'es' | 'ca' | 'en',
): Promise<LegalValues> {
  const data = await readStoreContent('store', 'es');
  const store = data ? storeContent.parse(data.payload) : STORE_DEFAULTS;
  const entity = Object.fromEntries(
    Object.entries(LEGAL_ENTITY).map(([field, value]) => [
      field,
      resolveValue(value, locale),
    ]),
  );
  return {
    ...entity,
    email: store.email || LEGAL_CONTACT_EMAIL,
    phone: store.phone || null,
    storeAddress: [store.address, store.city].filter(Boolean).join(', '),
  };
}
