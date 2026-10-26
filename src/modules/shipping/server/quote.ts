import 'server-only';
import { createSupabasePublicClient } from '@/lib/supabase/public';
import type { ShippingQuote } from '../domain/quote';
import { EMPTY_SHIPPING_QUOTE, parseShippingQuote } from '../domain/quote';

/**
 * Opciones de envío de una cesta con el cliente anónimo (web_shipping_quote):
 * servicios por zona con su precio con IVA para el peso de la cesta. Es lo que
 * se enseña antes de pagar; el importe que cuenta lo calcula la base al crear
 * el pedido.
 */
export async function quoteCartShipping(
  items: readonly { variantId: string; quantity: number }[],
): Promise<ShippingQuote> {
  const supabase = createSupabasePublicClient();
  if (!supabase || items.length === 0) return EMPTY_SHIPPING_QUOTE;
  const { data, error } = await supabase.rpc('web_shipping_quote', {
    p_items: items.map((item) => ({
      variant_id: item.variantId,
      quantity: item.quantity,
    })),
  });
  if (error) {
    console.error('[checkout] opciones de envío', error.code, error.message);
    return EMPTY_SHIPPING_QUOTE;
  }
  return parseShippingQuote(data);
}
