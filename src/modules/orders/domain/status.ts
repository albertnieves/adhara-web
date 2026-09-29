/**
 * Estados del pedido (Fase 0 §5) y transiciones permitidas. Cada transición
 * declara quién puede ejecutarla y qué efecto tiene en el inventario; la
 * función SQL aplicará ambos en la misma transacción.
 */
import type { Permission, StaffSession } from '@/modules/auth';
import { isAllowed } from '@/modules/auth';

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'ready_for_pickup',
  'shipped',
  'completed',
  'cancelled',
  'refunded',
  'partially_refunded',
  'needs_attention',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type FulfillmentType = 'shipping' | 'click_collect';

export type InventoryEffect =
  | 'none'
  | 'commit_reservation'
  | 'release_reservation'
  /** Pago llegado con la reserva ya liberada: reservar de nuevo si hay stock. */
  | 'reserve_and_commit'
  | 'sale_online'
  | 'sale_click_collect';

type Transition = {
  from: OrderStatus;
  to: OrderStatus;
  /** system: solo webhook de pago o cron; nunca desde el admin. */
  by: 'system' | Permission;
  inventory: InventoryEffect;
  refund?: true;
  only?: FulfillmentType;
};

// prettier-ignore
const TRANSITIONS: readonly Transition[] = [
  { from: 'pending_payment', to: 'paid', by: 'system', inventory: 'commit_reservation' },
  { from: 'pending_payment', to: 'cancelled', by: 'system', inventory: 'release_reservation' },
  { from: 'pending_payment', to: 'needs_attention', by: 'system', inventory: 'none' },
  { from: 'paid', to: 'processing', by: 'orders.fulfill', inventory: 'none' },
  { from: 'paid', to: 'cancelled', by: 'orders.refund', inventory: 'release_reservation', refund: true },
  { from: 'processing', to: 'ready_for_pickup', by: 'orders.fulfill', inventory: 'none', only: 'click_collect' },
  { from: 'processing', to: 'shipped', by: 'orders.fulfill', inventory: 'sale_online', only: 'shipping' },
  { from: 'processing', to: 'cancelled', by: 'orders.refund', inventory: 'release_reservation', refund: true },
  { from: 'ready_for_pickup', to: 'completed', by: 'orders.fulfill', inventory: 'sale_click_collect', only: 'click_collect' },
  { from: 'ready_for_pickup', to: 'cancelled', by: 'orders.refund', inventory: 'release_reservation', refund: true },
  { from: 'shipped', to: 'completed', by: 'orders.fulfill', inventory: 'none', only: 'shipping' },
  { from: 'completed', to: 'partially_refunded', by: 'orders.refund', inventory: 'none', refund: true },
  { from: 'completed', to: 'refunded', by: 'orders.refund', inventory: 'none', refund: true },
  { from: 'partially_refunded', to: 'refunded', by: 'orders.refund', inventory: 'none', refund: true },
  { from: 'needs_attention', to: 'paid', by: 'orders.refund', inventory: 'reserve_and_commit' },
  { from: 'needs_attention', to: 'cancelled', by: 'orders.refund', inventory: 'release_reservation', refund: true },
];

export type TransitionActor =
  { kind: 'system' } | ({ kind: 'staff' } & StaffSession);

export type TransitionPlan =
  | { ok: true; inventory: InventoryEffect; refund: boolean }
  | {
      ok: false;
      reason: 'invalid_transition' | 'wrong_fulfillment' | 'forbidden';
    };

export function planTransition(
  order: { status: OrderStatus; fulfillment: FulfillmentType },
  to: OrderStatus,
  actor: TransitionActor,
): TransitionPlan {
  const transition = TRANSITIONS.find(
    (candidate) => candidate.from === order.status && candidate.to === to,
  );
  if (!transition) return { ok: false, reason: 'invalid_transition' };
  if (transition.only && transition.only !== order.fulfillment) {
    return { ok: false, reason: 'wrong_fulfillment' };
  }
  const permitted =
    transition.by === 'system'
      ? actor.kind === 'system'
      : actor.kind === 'staff' && isAllowed(actor, transition.by);
  if (!permitted) return { ok: false, reason: 'forbidden' };
  return {
    ok: true,
    inventory: transition.inventory,
    refund: transition.refund === true,
  };
}

/** Destinos que el personal puede elegir desde la ficha del pedido. */
export function availableTransitions(
  order: { status: OrderStatus; fulfillment: FulfillmentType },
  session: StaffSession,
): OrderStatus[] {
  return TRANSITIONS.filter(
    (transition) =>
      transition.from === order.status &&
      planTransition(order, transition.to, { kind: 'staff', ...session }).ok,
  ).map((transition) => transition.to);
}
