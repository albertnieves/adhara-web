/**
 * Niveles por variante y ubicación: available = on_hand − reserved (Fase 0 §9).
 * Los movimientos son de solo inserción; aquí se definen sus efectos y las
 * invariantes que la función SQL repetirá dentro de la transacción.
 */
export type StockLevel = { onHand: number; reserved: number };

export function availableUnits(level: StockLevel): number {
  return level.onHand - level.reserved;
}

export const MOVEMENT_TYPES = [
  'PURCHASE_RECEIPT',
  'SALE_STORE',
  'SALE_ONLINE',
  'SALE_CLICK_COLLECT',
  'RESERVATION',
  'RESERVATION_RELEASE',
  'RETURN',
  'RETURN_DAMAGED',
  'STOCKTAKE_ADJUSTMENT',
  'MANUAL_ADJUSTMENT',
  'DAMAGE_LOSS',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'TESTER_ALLOCATION',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Los ajustes admiten cantidad con signo; el resto, cantidad positiva. */
const SIGNED: ReadonlySet<MovementType> = new Set([
  'STOCKTAKE_ADJUSTMENT',
  'MANUAL_ADJUSTMENT',
]);

/** Movimientos que exigen motivo escrito por quien los registra. */
const REASON_REQUIRED: ReadonlySet<MovementType> = new Set([
  'MANUAL_ADJUSTMENT',
  'DAMAGE_LOSS',
  'RETURN_DAMAGED',
]);

const EFFECTS: Record<
  MovementType,
  { onHand: -1 | 0 | 1; reserved: -1 | 0 | 1 }
> = {
  PURCHASE_RECEIPT: { onHand: 1, reserved: 0 },
  SALE_STORE: { onHand: -1, reserved: 0 },
  SALE_ONLINE: { onHand: -1, reserved: -1 },
  SALE_CLICK_COLLECT: { onHand: -1, reserved: -1 },
  RESERVATION: { onHand: 0, reserved: 1 },
  RESERVATION_RELEASE: { onHand: 0, reserved: -1 },
  RETURN: { onHand: 1, reserved: 0 },
  RETURN_DAMAGED: { onHand: 0, reserved: 0 },
  STOCKTAKE_ADJUSTMENT: { onHand: 1, reserved: 0 },
  MANUAL_ADJUSTMENT: { onHand: 1, reserved: 0 },
  DAMAGE_LOSS: { onHand: -1, reserved: 0 },
  TRANSFER_OUT: { onHand: -1, reserved: 0 },
  TRANSFER_IN: { onHand: 1, reserved: 0 },
  TESTER_ALLOCATION: { onHand: -1, reserved: 0 },
};

export type MovementInput = {
  type: MovementType;
  quantity: number;
  reason?: string | null;
};

export type MovementError =
  | 'invalid_quantity'
  | 'reason_required'
  | 'insufficient_available'
  | 'insufficient_reserved'
  | 'negative_on_hand';

export type MovementResult =
  | { ok: true; level: StockLevel; delta: StockLevel }
  | { ok: false; error: MovementError };

export function applyMovement(
  level: StockLevel,
  movement: MovementInput,
): MovementResult {
  const { type, quantity } = movement;
  const signed = SIGNED.has(type);
  if (
    !Number.isSafeInteger(quantity) ||
    quantity === 0 ||
    (!signed && quantity < 0)
  ) {
    return { ok: false, error: 'invalid_quantity' };
  }
  if (REASON_REQUIRED.has(type) && !movement.reason?.trim()) {
    return { ok: false, error: 'reason_required' };
  }
  const effect = EFFECTS[type];
  const delta = {
    onHand: effect.onHand * quantity,
    reserved: effect.reserved * quantity,
  };
  const next = {
    onHand: level.onHand + delta.onHand,
    reserved: level.reserved + delta.reserved,
  };
  if (next.onHand < 0) return { ok: false, error: 'negative_on_hand' };
  if (next.reserved < 0) return { ok: false, error: 'insufficient_reserved' };
  if (next.reserved > next.onHand) {
    return { ok: false, error: 'insufficient_available' };
  }
  return { ok: true, level: next, delta };
}

/** Recuento físico: genera el ajuste entre lo esperado y lo contado. */
export function stocktakeMovement(
  expectedOnHand: number,
  countedOnHand: number,
): MovementInput | null {
  if (!Number.isSafeInteger(countedOnHand) || countedOnHand < 0) {
    throw new RangeError('El recuento debe ser un entero no negativo');
  }
  const difference = countedOnHand - expectedOnHand;
  return difference === 0
    ? null
    : { type: 'STOCKTAKE_ADJUSTMENT', quantity: difference };
}
