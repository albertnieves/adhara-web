import type { BadgeTone } from '@/components/ui';
import type { StaffSession } from '@/modules/auth';
import type { FulfillmentType, OrderStatus } from './status';
import { ORDER_TRANSITIONS, planTransition } from './status';

/*
 * Textos del panel para los pedidos web (español; el panel no se traduce).
 * Los motivos y efectos repiten los de la migración 20261011230000_web_orders.
 */

export type ReservationState = 'active' | 'committed' | 'consumed' | 'released';

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  pending_payment: 'Esperando pago',
  paid: 'Por preparar',
  processing: 'En preparación',
  ready_for_pickup: 'Listo para recoger',
  shipped: 'Enviado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolsado en parte',
  needs_attention: 'Incidencia',
};

const STATUS_TONES: Readonly<Record<OrderStatus, BadgeTone>> = {
  pending_payment: 'neutral',
  paid: 'warning',
  processing: 'accent',
  ready_for_pickup: 'accent',
  shipped: 'accent',
  completed: 'success',
  cancelled: 'neutral',
  refunded: 'neutral',
  partially_refunded: 'neutral',
  needs_attention: 'danger',
};

/** Estado visible: un pedido pendiente cuya reserva caducó no espera nada. */
export function orderStatusBadge(order: {
  status: OrderStatus;
  reservation: ReservationState;
}): { label: string; tone: BadgeTone } {
  if (order.status === 'pending_payment' && order.reservation === 'released') {
    return { label: 'Sin pagar', tone: 'neutral' };
  }
  return {
    label: ORDER_STATUS_LABELS[order.status],
    tone: STATUS_TONES[order.status],
  };
}

export const FULFILLMENT_LABELS: Readonly<Record<FulfillmentType, string>> = {
  click_collect: 'Recogida en tienda',
  shipping: 'Envío a domicilio',
};

export const PAYMENT_OUTCOME_LABELS: Readonly<Record<string, string>> = {
  succeeded: 'Cobrado',
  declined: 'Rechazado',
  pending: 'Pendiente en el banco',
};

/** Motivo de cada notificación sin efecto o en revisión. */
export const PAYMENT_REASON_LABELS: Readonly<Record<string, string>> = {
  not_paid: 'El banco no completó el pago',
  amount_mismatch: 'El importe cobrado no coincide con el del pedido',
  currency_mismatch: 'El cobro no está en euros',
  additional_payment: 'Segundo cobro del mismo pedido',
  reservation_unavailable: 'Pago tardío: la reserva ya había caducado',
  unexpected_status: 'Cobro en un pedido que no esperaba pago',
};

export const PAYMENT_DECISION_LABELS: Readonly<Record<string, string>> = {
  confirm: 'Confirma el pedido',
  ignore: 'Sin efecto',
  review: 'Incidencia',
};

export const ORDER_EVENT_LABELS: Readonly<Record<string, string>> = {
  created: 'Pedido creado y unidades reservadas',
  payment_attempt: 'Enviado al banco',
  payment_confirmed: 'Pago confirmado por el banco',
  payment_review: 'Incidencia de pago',
  payment_not_paid: 'Pago no completado',
  reservation_released: 'Reserva caducada: unidades devueltas al stock',
  status_changed: 'Cambio de estado',
};

/** Errores de admin_transition_order (y los generales del panel si no). */
export const ORDER_ERRORS: Readonly<Record<string, string>> = {
  stale_revision:
    'Otra persona ha cambiado este pedido mientras lo mirabas. Recarga la página para ver la versión actual.',
  invalid_transition:
    'El pedido ya no está en un estado que permita este paso. Recarga la página.',
  wrong_fulfillment: 'Este paso no corresponde a la forma de entrega.',
  refund_unavailable:
    'Los reembolsos aún no se hacen desde el panel: llegarán con la conexión al banco.',
  reservation_unavailable:
    'El pedido no tiene unidades reservadas que convertir en venta.',
  insufficient_stock:
    'No hay unidades disponibles para volver a reservar este pedido.',
  invalid_tracking: 'El número de seguimiento no es válido.',
  unknown_order: 'El pedido no existe.',
};

/**
 * Una notificación en revisión que llevó el pedido a «Incidencia» se resuelve
 * al sacarlo de ahí («Dar por pagado»). La que no cambió el estado (segundo
 * cobro, cobro en un pedido cerrado) sigue abierta hasta devolver el dinero,
 * que llega con el adaptador del proveedor (P06).
 */
export function incidentOpen(
  orderStatus: OrderStatus,
  review: { keptStatus: boolean },
): boolean {
  return review.keptStatus || orderStatus === 'needs_attention';
}

export type PanelTransition = {
  to: OrderStatus;
  label: string;
  variant: 'primary' | 'outline';
  /** Pregunta antes de un paso que mueve stock o resuelve una incidencia. */
  confirm?: { title: string; description: string; confirmLabel: string };
};

/** Botón de cada paso del panel, por estado de origen y destino. */
const TRANSITION_ACTIONS: Readonly<
  Record<string, Omit<PanelTransition, 'to'>>
> = {
  'paid>processing': { label: 'Empezar a preparar', variant: 'primary' },
  'processing>ready_for_pickup': {
    label: 'Listo para recoger',
    variant: 'primary',
  },
  'processing>shipped': {
    label: 'Marcar enviado',
    variant: 'primary',
    confirm: {
      title: '¿Marcar el pedido como enviado?',
      description:
        'Las unidades reservadas se descuentan del stock de la tienda. No se puede deshacer desde el panel.',
      confirmLabel: 'Marcar enviado',
    },
  },
  'ready_for_pickup>completed': {
    label: 'Entregado al cliente',
    variant: 'primary',
    confirm: {
      title: '¿Has entregado el pedido?',
      description:
        'Comprueba el nombre del cliente y el número de pedido. Las unidades reservadas se descuentan del stock de la tienda.',
      confirmLabel: 'Entregado',
    },
  },
  'shipped>completed': { label: 'Marcar entregado', variant: 'outline' },
  'needs_attention>paid': {
    label: 'Dar por pagado',
    variant: 'outline',
    confirm: {
      title: '¿Dar el pedido por pagado?',
      description:
        'Hazlo solo si en el TPV del banco el cobro es correcto. Si la reserva caducó, se vuelven a reservar las unidades si hay stock.',
      confirmLabel: 'Dar por pagado',
    },
  },
};

export function transitionAction(
  from: OrderStatus,
  to: OrderStatus,
): Omit<PanelTransition, 'to'> | undefined {
  return TRANSITION_ACTIONS[`${from}>${to}`];
}

/**
 * Pasos que esta sesión puede dar desde la ficha: los del cuadro de
 * status.ts con su permiso, sin los del sistema ni los que reembolsan (la base
 * los rechaza hasta tener el adaptador del proveedor, P06).
 */
export function panelTransitions(
  order: { status: OrderStatus; fulfillment: FulfillmentType },
  session: StaffSession,
): PanelTransition[] {
  return ORDER_TRANSITIONS.filter((t) => t.from === order.status).flatMap(
    (t) => {
      const plan = planTransition(order, t.to, { kind: 'staff', ...session });
      const action = transitionAction(t.from, t.to);
      return plan.ok && !plan.refund && action ? [{ to: t.to, ...action }] : [];
    },
  );
}

/** Número que ven el personal y el cliente; el movimiento lo usa igual. */
export function orderNumberLabel(number: number): string {
  return `Pedido web ${number}`;
}
