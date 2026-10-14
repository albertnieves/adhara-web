/*
 * Estado de un pedido tal como lo ve el cliente en su cuenta: menos estados
 * que el panel y sin los internos (una incidencia de cobro es «en revisión»).
 * Las claves son las de messages/*.json → account.status.
 */

export const CUSTOMER_ORDER_STATUSES = [
  'awaitingPayment',
  'preparing',
  'readyForPickup',
  'shipped',
  'completed',
  'cancelled',
  'refunded',
  'partiallyRefunded',
  'review',
] as const;
export type CustomerOrderStatus = (typeof CUSTOMER_ORDER_STATUSES)[number];

export function customerOrderStatus(status: string): CustomerOrderStatus {
  switch (status) {
    case 'pending_payment':
      return 'awaitingPayment';
    case 'paid':
    case 'processing':
      return 'preparing';
    case 'ready_for_pickup':
      return 'readyForPickup';
    case 'shipped':
      return 'shipped';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'partially_refunded':
      return 'partiallyRefunded';
    default:
      // needs_attention y cualquier estado que aún no conozca la tienda.
      return 'review';
  }
}

/** Pedido de la lista de la cuenta (customer_orders). */
export type AccountOrderSummary = {
  number: number;
  status: CustomerOrderStatus;
  fulfillment: 'click_collect' | 'shipping';
  totalCents: number;
  units: number;
  createdAt: string;
};

/** Ficha de un pedido de la cuenta (customer_order). */
export type AccountOrder = {
  number: number;
  status: CustomerOrderStatus;
  fulfillment: 'click_collect' | 'shipping';
  itemsCents: number;
  shippingCents: number;
  totalCents: number;
  refundedCents: number;
  createdAt: string;
  paidAt: string | null;
  trackingReference: string | null;
  contact: { fullName: string; email: string; phone: string | null };
  address: {
    addressLine1: string | null;
    addressLine2: string | null;
    postalCode: string | null;
    city: string | null;
    province: string | null;
  } | null;
  lines: {
    brandName: string;
    productName: string;
    variantLabel: string | null;
    sizeMl: number | null;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
};
