'use server';

import { createOrdersClient } from '@/lib/supabase/privileged';
import { orderCustomerId } from '@/modules/account/server';
import { REDSYS_PROVIDER } from '@/modules/payments/domain/redsys';
import type { DiscountQuote } from '@/modules/promotions/domain';
import {
  discountErrorFromDb,
  normalizeDiscountCode,
} from '@/modules/promotions/domain';
import type { CheckoutState } from '../domain/input';
import { checkoutInput, fieldErrors } from '../domain/input';
import {
  addToCart,
  cartCount,
  isVariantId,
  setLineQuantity,
} from '../domain/cart';
import type { PaymentRedirect } from '../domain/input';
import { readCart, writeCart } from './cart';
import { checkoutEnabled } from './flag';
import { paymentFormFor, rememberOrder, rememberedOrderId } from './order';
import { quoteCart } from './quote';

/*
 * Cesta y pedido de la tienda (P03). Todo se comprueba aquí y otra vez en la
 * base: el navegador solo elige formatos, cantidades, entrega y contacto.
 * Sin el interruptor WEB_CHECKOUT nada de esto responde.
 */

/** Redsys por redirección (DECISIONS §137). */
const PAYMENT_PROVIDER = REDSYS_PROVIDER;

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

/** Formatos y cantidades de la cesta, como los espera la base. */
function orderItems(lines: Awaited<ReturnType<typeof readCart>>) {
  return lines.map((line) => ({
    variant_id: line.variantId,
    quantity: line.quantity,
  }));
}

/** Compra mínima que la base manda en el detalle de discount_minimum. */
function minimumFrom(details: string | null | undefined): number | undefined {
  const cents = Number(details);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : undefined;
}

/**
 * «Aplicar» en el resumen de «Finalizar compra» (DECISIONS §150): la base
 * calcula el descuento con la cesta de la cookie. No crea nada ni reserva el
 * código: el uso por email y los usos que queden se comprueban otra vez al
 * crear el pedido. Se llama desde el botón, sin enviar el formulario.
 */
export async function applyDiscountCode(input: string): Promise<DiscountQuote> {
  if (!checkoutEnabled()) return { status: 'error', error: 'generic' };
  const code =
    typeof input === 'string'
      ? normalizeDiscountCode(input.slice(0, 60))
      : null;
  if (!code) return { status: 'error', error: 'invalid' };
  const lines = await readCart();
  const supabase = createOrdersClient();
  if (lines.length === 0 || !supabase)
    return { status: 'error', error: 'generic' };
  const { data, error } = await supabase.rpc('web_order_discount_quote', {
    p_code: code,
    p_items: orderItems(lines),
  });
  if (error) {
    const reason = discountErrorFromDb(error.message);
    if (reason)
      return {
        status: 'error',
        error: reason,
        minimumCents:
          reason === 'minimum' ? minimumFrom(error.details) : undefined,
      };
    console.error('[checkout] código de descuento', error.code, error.message);
    return { status: 'error', error: 'generic' };
  }
  const quote = data as {
    code: string;
    discount_cents: number;
    exclude_sale_items: boolean;
  };
  return {
    status: 'applied',
    code: quote.code,
    discountCents: quote.discount_cents,
    excludesSaleItems: quote.exclude_sale_items,
  };
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
    discountCode: text('discountCode'),
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
  // Con la cuenta de cliente y la sesión iniciada, el pedido queda en su
  // cuenta (validada con Supabase Auth; la base comprueba que existe).
  const customerId = await orderCustomerId();
  const { data, error } = await supabase.rpc('web_order_create', {
    p_request_id: input.requestId,
    p_locale: input.locale,
    p_fulfillment: input.fulfillment,
    // La función elige la tienda; el tipo generado no admite null.
    p_location_id: null as unknown as string,
    p_items: orderItems(lines),
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
    ...(input.discountCode && { p_discount_code: input.discountCode }),
    ...(customerId && { p_customer_id: customerId }),
  });
  if (error) {
    const discount = discountErrorFromDb(error.message);
    if (discount)
      return {
        status: 'error',
        error: 'discount',
        discount,
        minimumCents:
          discount === 'minimum' ? minimumFrom(error.details) : undefined,
      };
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
    order_id: string;
    number: number;
    items_cents: number;
    discount_cents: number;
    shipping_cents: number;
    total_cents: number;
    reserved_until: string;
    payment_reference: string;
  };
  await writeCart([]);
  // La página de vuelta del banco enseña este pedido y deja reintentar el pago.
  await rememberOrder(summary.order_id);
  const payment = await paymentFormFor({
    reference: summary.payment_reference,
    totalCents: summary.total_cents,
    number: summary.number,
    locale: input.locale,
  });
  if (payment)
    return { status: 'redirect', number: summary.number, form: payment };
  return {
    status: 'placed',
    number: summary.number,
    fulfillment: input.fulfillment,
    itemsCents: summary.items_cents,
    discountCents: summary.discount_cents,
    shippingCents: summary.shipping_cents,
    totalCents: summary.total_cents,
    reservedUntil: summary.reserved_until,
  };
}

export type RetryPaymentState =
  | { status: 'idle' }
  | { status: 'redirect'; form: PaymentRedirect }
  | { status: 'error'; error: 'expired' | 'generic' };

/**
 * Vuelve a pagar el pedido de este navegador con una referencia nueva
 * (web_order_new_attempt): el banco no admite repetir un número de pedido.
 * Solo mientras la reserva siga en pie; el importe es el del pedido.
 */
export async function retryPayment(
  _: RetryPaymentState,
  form: FormData,
): Promise<RetryPaymentState> {
  if (!checkoutEnabled()) return { status: 'error', error: 'generic' };
  const locale = form.get('locale');
  const orderId = await rememberedOrderId();
  const supabase = createOrdersClient();
  if (
    !orderId ||
    !supabase ||
    (locale !== 'es' && locale !== 'ca' && locale !== 'en')
  )
    return { status: 'error', error: 'generic' };
  const { data, error } = await supabase.rpc('web_order_new_attempt', {
    p_order_id: orderId,
    p_provider: PAYMENT_PROVIDER,
  });
  if (error) {
    if (error.message === 'order_not_payable')
      return { status: 'error', error: 'expired' };
    console.error(
      '[checkout] nuevo intento de pago',
      error.code,
      error.message,
    );
    return { status: 'error', error: 'generic' };
  }
  const attempt = data as {
    number: number;
    total_cents: number;
    payment_reference: string;
  };
  const payment = await paymentFormFor({
    reference: attempt.payment_reference,
    totalCents: attempt.total_cents,
    number: attempt.number,
    locale,
  });
  return payment
    ? { status: 'redirect', form: payment }
    : { status: 'error', error: 'generic' };
}
