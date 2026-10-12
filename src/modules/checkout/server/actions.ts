'use server';

import { createOrdersClient } from '@/lib/supabase/privileged';
import type { CheckoutState } from '../domain/input';
import { checkoutInput, fieldErrors } from '../domain/input';
import {
  addToCart,
  cartCount,
  isVariantId,
  setLineQuantity,
} from '../domain/cart';
import { readCart, writeCart } from './cart';
import { checkoutEnabled } from './flag';
import { quoteCart } from './quote';

/*
 * Cesta y pedido de la tienda (P03). Todo se comprueba aquí y otra vez en la
 * base: el navegador solo elige formatos, cantidades, entrega y contacto.
 * Sin el interruptor WEB_CHECKOUT nada de esto responde.
 */

/** Redsys por redirección (STATUS); se confirma con el banco en P04. */
const PAYMENT_PROVIDER = 'redsys';

export type AddToCartState =
  | { status: 'idle' }
  | { status: 'added'; count: number }
  | { status: 'full' | 'max' | 'error' };

export async function addToCartAction(
  _: AddToCartState,
  form: FormData,
): Promise<AddToCartState> {
  if (!checkoutEnabled()) return { status: 'error' };
  const variantId = form.get('variantId');
  if (!isVariantId(variantId)) return { status: 'error' };
  const result = addToCart(await readCart(), variantId);
  if (!result.ok) return { status: result.reason === 'full' ? 'full' : 'max' };
  await writeCart(result.lines);
  return { status: 'added', count: cartCount(result.lines) };
}

/** Cambia la cantidad de un formato (0 lo quita); la página se vuelve a pintar. */
export async function updateCartLine(form: FormData): Promise<void> {
  if (!checkoutEnabled()) return;
  const variantId = form.get('variantId');
  const quantity = Number(form.get('quantity'));
  if (!isVariantId(variantId) || !Number.isFinite(quantity)) return;
  await writeCart(setLineQuantity(await readCart(), variantId, quantity));
}

const DB_ERRORS: Record<string, CheckoutState & { status: 'error' }> = {
  unavailable_variant: { status: 'error', error: 'unavailable' },
  shipping_zone_unavailable: {
    status: 'error',
    error: 'zoneUnavailable',
    fields: { postalCode: 'zoneUnavailable' },
  },
  shipping_unavailable: { status: 'error', error: 'shippingUnavailable' },
  invalid_address: { status: 'error', error: 'addressRequired' },
};

export async function placeOrder(
  _: CheckoutState,
  form: FormData,
): Promise<CheckoutState> {
  if (!checkoutEnabled()) return { status: 'error', error: 'disabled' };
  // Campo trampa invisible: los bots lo rellenan, las personas no.
  if (String(form.get('company') ?? '').trim())
    return { status: 'error', error: 'generic' };
  const text = (name: string) => String(form.get(name) ?? '');
  const parsed = checkoutInput.safeParse({
    requestId: text('requestId'),
    locale: text('locale'),
    fulfillment: text('fulfillment'),
    fullName: text('fullName'),
    email: text('email'),
    phone: text('phone'),
    addressLine1: text('addressLine1'),
    addressLine2: text('addressLine2'),
    postalCode: text('postalCode'),
    city: text('city'),
    province: text('province'),
    acceptTerms: form.get('acceptTerms') ?? undefined,
  });
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error.issues);
    return {
      status: 'error',
      error: Object.values(fields)[0] ?? 'generic',
      fields,
    };
  }
  const input = parsed.data;
  const lines = await readCart();
  if (lines.length === 0) return { status: 'error', error: 'emptyCart' };
  // Lo que se va a comprar es lo que se ha visto: si algo cambió, se revisa.
  const quote = await quoteCart(lines);
  if (!quote.purchasable) return { status: 'error', error: 'cartChanged' };

  const supabase = createOrdersClient();
  if (!supabase) return { status: 'error', error: 'generic' };
  const shipping = input.fulfillment === 'shipping';
  const { data, error } = await supabase.rpc('web_order_create', {
    p_request_id: input.requestId,
    p_locale: input.locale,
    p_fulfillment: input.fulfillment,
    // La función elige la tienda; el tipo generado no admite null.
    p_location_id: null as unknown as string,
    p_items: lines.map((line) => ({
      variant_id: line.variantId,
      quantity: line.quantity,
    })),
    p_contact: {
      full_name: input.fullName,
      email: input.email,
      phone: input.phone || null,
      ...(shipping && {
        address_line1: input.addressLine1,
        address_line2: input.addressLine2 || null,
        postal_code: input.postalCode,
        city: input.city,
        province: input.province || null,
      }),
    },
    p_provider: PAYMENT_PROVIDER,
  });
  if (error) {
    if (error.message === 'insufficient_stock') {
      const line = quote.lines.find((l) => l.variantId === error.details);
      return {
        status: 'error',
        error: 'outOfStock',
        product: line?.product
          ? `${line.product.name} ${line.product.variantLabel}`.trim()
          : undefined,
      };
    }
    const known = DB_ERRORS[error.message];
    if (known) return known;
    console.error(
      '[checkout] no se pudo crear el pedido',
      error.code,
      error.message,
    );
    return { status: 'error', error: 'generic' };
  }
  const summary = data as {
    number: number;
    items_cents: number;
    shipping_cents: number;
    total_cents: number;
    reserved_until: string;
  };
  await writeCart([]);
  return {
    status: 'placed',
    number: summary.number,
    fulfillment: input.fulfillment,
    itemsCents: summary.items_cents,
    shippingCents: summary.shipping_cents,
    totalCents: summary.total_cents,
    reservedUntil: summary.reserved_until,
  };
}
