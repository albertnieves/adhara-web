import 'server-only';
import { createSupabasePublicClient } from '@/lib/supabase/public';
import type { Availability, ProductMedia } from '@/modules/catalog';
import type { ShippingQuote } from '@/modules/shipping';
import { EMPTY_SHIPPING_QUOTE } from '@/modules/shipping';
import { quoteCartShipping } from '@/modules/shipping/server/quote';
import type { CartLine } from '../domain/cart';

/*
 * Presupuesto de la cesta con datos públicos (cliente anónimo, nunca la
 * vista previa del personal): solo formatos activos con PVP de perfumes
 * publicados, su disponibilidad (sin unidades exactas) y las opciones de envío
 * de cada zona activa para el peso de la cesta (web_shipping_quote, §172). Es
 * lo que se enseña antes de pagar; el importe que cuenta lo calcula la base al
 * crear el pedido.
 */

export type QuoteLine = {
  variantId: string;
  quantity: number;
  /** null: ya no está a la venta (retirado, sin precio o desactivado). */
  product: {
    slug: string;
    name: string;
    brandName: string;
    variantLabel: string;
    media: ProductMedia | null;
    unitPriceCents: number;
    lineTotalCents: number;
    availability: Availability;
  } | null;
};

export type CartQuote = {
  lines: QuoteLine[];
  itemsCents: number;
  /** Todo lo de la cesta se puede comprar ahora mismo. */
  purchasable: boolean;
  shipping: ShippingQuote;
};

const VARIANT_SELECT =
  'id, label, size_ml, retail_price_cents, product:products!inner(id, slug, name, status, brand:brands!inner(name), media:product_media(url, alt, role, origin, provisional, position))';

type Row = {
  id: string;
  label: string | null;
  size_ml: number | null;
  retail_price_cents: number | null;
  product: {
    id: string;
    slug: string;
    name: string;
    status: string;
    brand: { name: string };
    media: ProductMedia[];
  };
};

function heroMedia(media: ProductMedia[]): ProductMedia | null {
  const sorted = [...media].sort((a, b) => a.position - b.position);
  return sorted.find((m) => m.role === 'hero') ?? sorted[0] ?? null;
}

export async function quoteCart(
  lines: readonly CartLine[],
): Promise<CartQuote> {
  const supabase = createSupabasePublicClient();
  const empty: CartQuote = {
    lines: lines.map((line) => ({ ...line, product: null })),
    itemsCents: 0,
    purchasable: false,
    shipping: EMPTY_SHIPPING_QUOTE,
  };
  if (!supabase) return empty;

  const [variants, shipping] = await Promise.all([
    lines.length > 0
      ? supabase
          .from('product_variants')
          .select(VARIANT_SELECT)
          .in(
            'id',
            lines.map((line) => line.variantId),
          )
          .eq('active', true)
          .eq('product.status', 'published')
      : Promise.resolve({ data: [], error: null }),
    quoteCartShipping(lines),
  ]);
  if (variants.error) {
    console.error(
      '[checkout] no se pudo leer la cesta',
      variants.error.message,
    );
    return empty;
  }
  const rows = (variants.data ?? []) as unknown as Row[];
  const productIds = [...new Set(rows.map((row) => row.product.id))];
  const availability: Record<string, Availability> = {};
  if (productIds.length > 0) {
    const { data, error } = await supabase.rpc('storefront_availability', {
      p_product_ids: productIds,
    });
    if (error) {
      console.error('[checkout] disponibilidad', error.message);
    } else {
      for (const row of data) {
        availability[row.variant_id] = row.status as Availability;
      }
    }
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const quoted: QuoteLine[] = lines.map((line) => {
    const row = byId.get(line.variantId);
    if (!row || !row.retail_price_cents || row.retail_price_cents <= 0) {
      return { ...line, product: null };
    }
    return {
      ...line,
      product: {
        slug: row.product.slug,
        name: row.product.name,
        brandName: row.product.brand.name,
        variantLabel:
          row.label?.trim() || (row.size_ml ? `${row.size_ml} ml` : ''),
        media: heroMedia(row.product.media),
        unitPriceCents: row.retail_price_cents,
        lineTotalCents: row.retail_price_cents * line.quantity,
        // Sin dato de disponibilidad, se trata como agotado: la base decide.
        availability: availability[row.id] ?? 'out_of_stock',
      },
    };
  });
  return {
    lines: quoted,
    itemsCents: quoted.reduce(
      (sum, line) => sum + (line.product?.lineTotalCents ?? 0),
      0,
    ),
    purchasable:
      quoted.length > 0 &&
      quoted.every(
        (line) => line.product && line.product.availability !== 'out_of_stock',
      ),
    shipping,
  };
}
