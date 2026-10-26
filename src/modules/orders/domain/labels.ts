import type { BadgeTone } from '@/components/ui';
import type { StaffSession } from '@/modules/auth';
import { isAllowed } from '@/modules/auth';
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

/**
 * Estado visible: un pedido pendiente cuya reserva caducó o se liberó desde el
 * panel no espera nada.
 */
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
  reservation_unavailable: 'Pago tardío: la reserva ya se había liberado',
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
  reservation_released: 'Reserva liberada: unidades devueltas al stock',
  status_changed: 'Cambio de estado',
  refund_requested: 'Devolución pedida al banco',
  refund_succeeded: 'Devolución aceptada por el banco',
  refund_failed: 'Devolución rechazada por el banco',
};

/**
 * Texto de cada evento de la cronología. Una devolución resuelta a mano tras
 * mirar el portal del banco (DECISIONS §168) lo dice, en vez de atribuirle
 * al banco una respuesta que no llegó.
 */
export function orderEventLabel(event: {
  kind: string;
  detail: Record<string, unknown> | null;
}): string {
  if (event.detail?.source === 'portal') {
    if (event.kind === 'refund_succeeded')
      return 'Devolución hecha, comprobada en el portal del banco';
    if (event.kind === 'refund_failed')
      return 'Devolución no hecha, comprobada en el portal del banco';
  }
  return ORDER_EVENT_LABELS[event.kind] ?? event.kind;
}

/** Por qué se liberó la reserva de un pedido sin pagar (cronología). */
export const RELEASE_REASON_LABELS: Readonly<Record<string, string>> = {
  expired: 'Caducó sin pago',
  staff: 'Liberada a mano desde el panel',
};

/**
 * «Liberar la reserva» (admin_release_order_reservation, DECISIONS §164): lo
 * mismo que la caducidad, antes de tiempo. Solo en un pedido que espera el
 * pago con la reserva activa y con orders.fulfill; la base lo vuelve a
 * comprobar con MFA y la revisión.
 */
export function canReleaseReservation(
  order: { status: OrderStatus; reservation: ReservationState },
  session: StaffSession,
): boolean {
  return (
    order.status === 'pending_payment' &&
    order.reservation === 'active' &&
    isAllowed(session, 'orders.fulfill')
  );
}

/** Correos al cliente (P06). */
export const ORDER_EMAIL_LABELS: Readonly<Record<string, string>> = {
  order_paid: 'Confirmación del pago, con las condiciones',
  ready_for_pickup: 'Aviso de «listo para recoger»',
  shipped: 'Aviso de envío',
};

/** Estado de un correo en la ficha: texto y tono. */
export function orderEmailBadge(email: { status: string; attempts: number }): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
} {
  if (email.status === 'sent') return { label: 'Enviado', tone: 'success' };
  if (email.status === 'failed')
    return { label: 'No se pudo enviar', tone: 'danger' };
  if (email.attempts > 0)
    return { label: `Reintentando (${email.attempts})`, tone: 'warning' };
  return { label: 'Pendiente de envío', tone: 'neutral' };
}

/**
 * Errores de admin_transition_order, de las devoluciones y de
 * admin_release_order_reservation (y los generales del panel si no).
 */
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
  not_releasable:
    'El pedido ya no tiene unidades reservadas: está pagado, en incidencias o la reserva ya se liberó. Recarga la página.',
  unknown_order: 'El pedido no existe.',
  invalid_payment: 'Ese cobro no se puede devolver desde este pedido.',
  invalid_amount:
    'El importe no es válido: no puede superar lo cobrado menos lo ya devuelto.',
  refund_in_progress:
    'Hay una devolución de este pedido sin terminar: mientras espera al banco (o hasta resolverla en «Devoluciones»), el pedido no cambia. Recarga la página.',
  nothing_to_refund: 'Este cobro ya está devuelto entero.',
  refund_not_retryable:
    'Esa devolución ya tiene respuesta o se acaba de enviar al banco. Recarga la página.',
  refund_not_resolvable:
    'Esa devolución ya tiene respuesta o se acaba de enviar al banco: espera unos minutos y recarga la página.',
  invalid_status: 'Elige si la devolución consta o no en el portal del banco.',
  unknown_refund: 'La devolución no existe.',
  invalid_request: 'La petición no es válida. Recarga la página.',
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
        'Hazlo solo si en el TPV del banco el cobro es correcto. Si la reserva se liberó, se vuelven a reservar las unidades si hay stock.',
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
  { refundOpen = false }: { refundOpen?: boolean } = {},
): PanelTransition[] {
  // Con una devolución abierta el pedido no se mueve (la base lo rechaza,
  // DECISIONS §168): primero la responde el banco o se resuelve a mano.
  if (refundOpen) return [];
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
