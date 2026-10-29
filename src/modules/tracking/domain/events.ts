import type { TrackingConfig } from './config';
import type { TrackingVendor } from './vendors';

/**
 * Eventos de comercio que la tienda envía a los proveedores aceptados. Solo
 * datos públicos del catálogo y del pedido (formato, PVP, número e importe):
 * nunca nombre, email, teléfono, dirección ni costes.
 */
export type TrackedItem = {
  /** ID del formato: el mismo que el feed de productos (`g:id`). */
  id: string;
  name: string;
  brand: string;
  variant: string | null;
  priceCents: number;
  quantity: number;
};

export type CommerceEvent =
  | { type: 'view_item'; item: TrackedItem }
  | { type: 'add_to_cart'; item: TrackedItem }
  | { type: 'begin_checkout'; items: TrackedItem[]; valueCents: number }
  | {
      type: 'purchase';
      orderNumber: number;
      /** Artículos menos el descuento, IVA incluido y sin el envío. */
      valueCents: number;
      shippingCents: number;
      coupon: string | null;
    }
  /** Alta en el Club L’Atelier. */
  | { type: 'lead' };

/** Una llamada a `gtag(...)`, `fbq(...)` o `ttq.track(...)`. */
export type VendorCall = { target: 'gtag' | 'fbq' | 'ttq'; args: unknown[] };

const CURRENCY = 'EUR';
const euros = (cents: number) => Math.round(cents) / 100;

function googleItem(item: TrackedItem) {
  return {
    item_id: item.id,
    item_name: item.name,
    item_brand: item.brand,
    ...(item.variant ? { item_variant: item.variant } : {}),
    price: euros(item.priceCents),
    quantity: item.quantity,
    // Remarketing dinámico de Google Ads: mismo ID que el feed.
    id: item.id,
    google_business_vertical: 'retail',
  };
}

function tiktokContent(item: TrackedItem) {
  return {
    content_id: item.id,
    content_type: 'product',
    content_name: item.name,
    quantity: item.quantity,
    price: euros(item.priceCents),
  };
}

const lineValue = (item: TrackedItem) => item.priceCents * item.quantity;

/**
 * Traduce un evento a las llamadas de cada proveedor aceptado. `gtag` envía
 * cada evento a los destinos configurados (Analytics, Ads o los dos), así que
 * basta una llamada para ambos.
 */
export function vendorCalls(
  event: CommerceEvent,
  config: TrackingConfig,
  granted: ReadonlySet<TrackingVendor>,
): VendorCall[] {
  const google = granted.has('ga4') || granted.has('googleAds');
  const meta = granted.has('meta');
  const tiktok = granted.has('tiktok');
  const calls: VendorCall[] = [];
  const gtag = (...args: unknown[]) => {
    if (google) calls.push({ target: 'gtag', args });
  };
  const fbq = (...args: unknown[]) => {
    if (meta) calls.push({ target: 'fbq', args });
  };
  const ttq = (...args: unknown[]) => {
    if (tiktok) calls.push({ target: 'ttq', args });
  };

  switch (event.type) {
    case 'view_item':
    case 'add_to_cart': {
      const { item } = event;
      const value = euros(lineValue(item));
      gtag('event', event.type, {
        currency: CURRENCY,
        value,
        items: [googleItem(item)],
      });
      const metaName = event.type === 'view_item' ? 'ViewContent' : 'AddToCart';
      fbq('track', metaName, {
        content_ids: [item.id],
        content_type: 'product',
        content_name: item.name,
        contents: [{ id: item.id, quantity: item.quantity }],
        value,
        currency: CURRENCY,
      });
      ttq(metaName, {
        contents: [tiktokContent(item)],
        value,
        currency: CURRENCY,
      });
      break;
    }
    case 'begin_checkout': {
      const value = euros(event.valueCents);
      gtag('event', 'begin_checkout', {
        currency: CURRENCY,
        value,
        items: event.items.map(googleItem),
      });
      fbq('track', 'InitiateCheckout', {
        content_ids: event.items.map((item) => item.id),
        content_type: 'product',
        contents: event.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
        num_items: event.items.reduce((sum, item) => sum + item.quantity, 0),
        value,
        currency: CURRENCY,
      });
      ttq('InitiateCheckout', {
        contents: event.items.map(tiktokContent),
        value,
        currency: CURRENCY,
      });
      break;
    }
    case 'purchase': {
      const value = euros(event.valueCents);
      const transaction = String(event.orderNumber);
      // El mismo ID en cada proveedor evita contar dos veces un pedido.
      const eventId = `pedido-${transaction}`;
      gtag('event', 'purchase', {
        transaction_id: transaction,
        value,
        currency: CURRENCY,
        shipping: euros(event.shippingCents),
        ...(event.coupon ? { coupon: event.coupon } : {}),
      });
      if (granted.has('googleAds') && config.googleAds?.purchaseLabel) {
        gtag('event', 'conversion', {
          send_to: `${config.googleAds.id}/${config.googleAds.purchaseLabel}`,
          value,
          currency: CURRENCY,
          transaction_id: transaction,
        });
      }
      fbq(
        'track',
        'Purchase',
        { value, currency: CURRENCY, content_type: 'product' },
        { eventID: eventId },
      );
      ttq(
        'Purchase',
        { value, currency: CURRENCY, content_type: 'product' },
        { event_id: eventId },
      );
      break;
    }
    case 'lead':
      gtag('event', 'generate_lead', { lead_source: 'newsletter' });
      fbq('track', 'Lead');
      ttq('Lead');
      break;
  }
  return calls;
}
