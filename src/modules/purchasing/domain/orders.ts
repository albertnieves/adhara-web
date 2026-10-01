/**
 * Pedidos de compra a proveedor (fase A3). Los estados y transiciones se
 * repiten en SQL (private.purchase_order_transition y la recepción);
 * tests/unit/purchasing-sql.test.ts comprueba que coinciden.
 */

export const PURCHASE_ORDER_STATUSES = [
  'draft',
  'ordered',
  'partially_received',
  'received',
  'closed',
  'cancelled',
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const PURCHASE_ORDER_ACTIONS = ['order', 'cancel', 'close'] as const;
export type PurchaseOrderAction = (typeof PURCHASE_ORDER_ACTIONS)[number];

/** Transiciones manuales; la recepción mueve el pedido por su cuenta. */
export const ORDER_TRANSITIONS: Readonly<
  Record<
    PurchaseOrderStatus,
    Readonly<Partial<Record<PurchaseOrderAction, PurchaseOrderStatus>>>
  >
> = {
  draft: { order: 'ordered', cancel: 'cancelled' },
  ordered: { cancel: 'cancelled' },
  partially_received: { close: 'closed' },
  received: {},
  closed: {},
  cancelled: {},
};

export function isPurchaseOrderStatus(
  value: string,
): value is PurchaseOrderStatus {
  return (PURCHASE_ORDER_STATUSES as readonly string[]).includes(value);
}

export function availableOrderActions(
  status: PurchaseOrderStatus,
): PurchaseOrderAction[] {
  return PURCHASE_ORDER_ACTIONS.filter(
    (action) => ORDER_TRANSITIONS[status][action] !== undefined,
  );
}

/** Pedidos que aún pueden cambiar o recibir mercancía. */
export function isOpenOrder(status: PurchaseOrderStatus): boolean {
  return (
    status === 'draft' ||
    status === 'ordered' ||
    status === 'partially_received'
  );
}

export function canEditLines(status: PurchaseOrderStatus): boolean {
  return status === 'draft';
}

export function canReceive(status: PurchaseOrderStatus): boolean {
  return status === 'ordered' || status === 'partially_received';
}

export type OrderLineProgress = {
  lineId: number;
  ordered: number;
  received: number;
};

export function pendingUnits(line: OrderLineProgress): number {
  return Math.max(line.ordered - line.received, 0);
}

export type ReceiptPlan =
  | {
      ok: true;
      items: { lineId: number; quantity: number }[];
      units: number;
      /** Estado del pedido si la recepción se aplica. */
      nextStatus: 'partially_received' | 'received';
    }
  | {
      ok: false;
      error: 'nothing_to_receive' | 'invalid_quantity' | 'over_receipt';
      lineId?: number;
    };

/**
 * Valida una entrega antes de enviarla: cantidades enteras, ninguna línea por
 * encima de lo pendiente y al menos una unidad. Lo definitivo es el SQL, que
 * bloquea el pedido para que dos recepciones simultáneas no se pasen.
 */
export function planReceipt(
  lines: readonly OrderLineProgress[],
  requested: ReadonlyMap<number, number>,
): ReceiptPlan {
  const items: { lineId: number; quantity: number }[] = [];
  for (const [lineId, quantity] of requested) {
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      return { ok: false, error: 'invalid_quantity', lineId };
    }
    if (quantity === 0) continue;
    const line = lines.find((l) => l.lineId === lineId);
    if (!line) return { ok: false, error: 'invalid_quantity', lineId };
    if (quantity > pendingUnits(line)) {
      return { ok: false, error: 'over_receipt', lineId };
    }
    items.push({ lineId, quantity });
  }
  if (items.length === 0) return { ok: false, error: 'nothing_to_receive' };
  const complete = lines.every(
    (line) =>
      line.received +
        (items.find((item) => item.lineId === line.lineId)?.quantity ?? 0) >=
      line.ordered,
  );
  return {
    ok: true,
    items,
    units: items.reduce((sum, item) => sum + item.quantity, 0),
    nextStatus: complete ? 'received' : 'partially_received',
  };
}

/** Total del pedido a coste; desconocido si alguna línea no tiene coste. */
export function orderCostCents(
  lines: readonly { quantity: number; unitCostCents: number | null }[],
): number | null {
  let total = 0;
  for (const line of lines) {
    if (line.unitCostCents === null) return null;
    total += line.quantity * line.unitCostCents;
  }
  return total;
}
