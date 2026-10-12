import { madridMidnight } from '@/modules/inventory';
import type { ReservationState } from './labels';
import type { FulfillmentType, OrderStatus } from './status';

/*
 * Filtros del listado de pedidos web (?vista=&entrega=&desde=&hasta=). Las
 * fechas son días de la tienda (Europe/Madrid); «hasta» incluye el día entero.
 * Por defecto se ve el trabajo abierto: lo pagado que falta entregar y las
 * incidencias. Lo que espera pago o caducó no es trabajo de preparación.
 */

export const ORDER_VIEWS = [
  'abiertos',
  'por_preparar',
  'en_preparacion',
  'para_recoger',
  'enviados',
  'incidencias',
  'esperando_pago',
  'sin_pagar',
  'cerrados',
  'todos',
] as const;
export type OrderView = (typeof ORDER_VIEWS)[number];

export const ORDER_VIEW_LABELS: Readonly<Record<OrderView, string>> = {
  abiertos: 'Abiertos',
  por_preparar: 'Por preparar',
  en_preparacion: 'En preparación',
  para_recoger: 'Para recoger',
  enviados: 'Enviados',
  incidencias: 'Incidencias',
  esperando_pago: 'Esperando pago',
  sin_pagar: 'Sin pagar',
  cerrados: 'Cerrados',
  todos: 'Todos',
};

export type OrderViewFacts = {
  status: OrderStatus;
  reservation: ReservationState;
  /**
   * Alguna notificación en revisión no cambió el estado del pedido y sigue
   * abierta (incidentOpen); las que lo llevaron a «Incidencia» cuentan por
   * el estado.
   */
  hasIncident: boolean;
};

const OPEN: ReadonlySet<OrderStatus> = new Set([
  'paid',
  'processing',
  'ready_for_pickup',
  'shipped',
  'needs_attention',
]);
const CLOSED: ReadonlySet<OrderStatus> = new Set([
  'completed',
  'cancelled',
  'refunded',
  'partially_refunded',
]);

export function matchesOrderView(
  order: OrderViewFacts,
  view: OrderView,
): boolean {
  switch (view) {
    case 'abiertos':
      return OPEN.has(order.status);
    case 'por_preparar':
      return order.status === 'paid';
    case 'en_preparacion':
      return order.status === 'processing';
    case 'para_recoger':
      return order.status === 'ready_for_pickup';
    case 'enviados':
      return order.status === 'shipped';
    case 'incidencias':
      return order.status === 'needs_attention' || order.hasIncident;
    case 'esperando_pago':
      return (
        order.status === 'pending_payment' && order.reservation === 'active'
      );
    case 'sin_pagar':
      return (
        order.status === 'pending_payment' && order.reservation === 'released'
      );
    case 'cerrados':
      return CLOSED.has(order.status);
    case 'todos':
      return true;
  }
}

export type OrderSearch = {
  vista?: string;
  entrega?: string;
  desde?: string;
  hasta?: string;
};

export type ParsedOrderFilter = {
  view: OrderView;
  fulfillment?: FulfillmentType;
  from?: string;
  to?: string;
  /** Parámetros válidos distintos de la vista, para enlaces. */
  search: URLSearchParams;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(day: string): boolean {
  return (
    DAY.test(day) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day)
  );
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function parseOrderFilter(params: OrderSearch): ParsedOrderFilter {
  const search = new URLSearchParams();
  const view = (ORDER_VIEWS as readonly string[]).includes(params.vista ?? '')
    ? (params.vista as OrderView)
    : 'abiertos';
  const result: ParsedOrderFilter = { view, search };
  if (params.entrega === 'click_collect' || params.entrega === 'shipping') {
    result.fulfillment = params.entrega;
    search.set('entrega', params.entrega);
  }
  if (params.desde && isRealDay(params.desde)) {
    result.from = madridMidnight(params.desde);
    search.set('desde', params.desde);
  }
  if (params.hasta && isRealDay(params.hasta)) {
    result.to = madridMidnight(nextDay(params.hasta));
    search.set('hasta', params.hasta);
  }
  return result;
}

/** Enlace a una vista conservando el resto de filtros. */
export function orderViewHref(view: OrderView, search: URLSearchParams) {
  const params = new URLSearchParams(search);
  if (view !== 'abiertos') params.set('vista', view);
  const query = params.toString();
  return `/admin/pedidos${query ? `?${query}` : ''}`;
}
