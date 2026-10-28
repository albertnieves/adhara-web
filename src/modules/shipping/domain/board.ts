import type { BadgeTone } from '@/components/ui';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_TONES } from './labels';
import { madridDate } from './pickup';
import type { ShipmentStatus } from './status';

/*
 * Tablero de Envíos → Seguimiento (DECISIONS §177): en qué etapa está cada
 * envío, qué hay que hacer con él y cuándo avisar de un retraso. Solo
 * clasifica lo que ya trae la base; no cambia ningún estado.
 *
 * Etapas, en el orden del recorrido del paquete:
 *   sin-etiqueta → por-entregar → esperando → de-camino → entregados,
 * con «incidencias» aparte. «Por hacer» junta lo que pide una acción de la
 * tienda: incidencias, recogidas o puntos sin escaneo, pedidos sin etiqueta y
 * etiquetas sin entregar.
 */

export const BOARD_STAGES = [
  'sin-etiqueta',
  'por-entregar',
  'esperando',
  'de-camino',
  'incidencias',
  'entregados',
] as const;
export type BoardStage = (typeof BOARD_STAGES)[number];

export const BOARD_VIEWS = ['por-hacer', ...BOARD_STAGES, 'todos'] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];

/** Nombre corto (contador), título de su bloque y qué hacer. */
export const BOARD_STAGE_INFO: Readonly<
  Record<BoardStage, { label: string; title: string; hint: string }>
> = {
  'sin-etiqueta': {
    label: 'Sin etiqueta',
    title: 'Pagados sin etiqueta',
    hint: 'Crea la etiqueta desde la ficha del pedido.',
  },
  'por-entregar': {
    label: 'Por entregar',
    title: 'Por entregar al transportista',
    hint: 'Pide una recogida en la tienda para todos los paquetes de un transportista o llévalos a un punto de entrega.',
  },
  esperando: {
    label: 'Esperando',
    title: 'Esperando al transportista',
    hint: 'Recogida pedida o paquete dejado en un punto. Pasa a «De camino» cuando el transportista lo escanea.',
  },
  'de-camino': {
    label: 'De camino',
    title: 'De camino',
    hint: 'Los lleva el transportista: no hay que hacer nada.',
  },
  incidencias: {
    label: 'Incidencias',
    title: 'Incidencias',
    hint: 'Revisa el seguimiento y, si hace falta, llama al transportista o escribe al cliente.',
  },
  entregados: {
    label: 'Entregados',
    title: 'Entregados en los últimos 30 días',
    hint: 'El pedido pasó a «Completado» al entregarse.',
  },
};

export const BOARD_VIEW_LABELS: Readonly<Record<BoardView, string>> = {
  'por-hacer': 'Por hacer',
  ...(Object.fromEntries(
    BOARD_STAGES.map((stage) => [stage, BOARD_STAGE_INFO[stage].label]),
  ) as Record<BoardStage, string>),
  todos: 'Todo',
};

/** Lo que el tablero necesita saber de una etiqueta. */
export type BoardShipmentFacts = {
  status: ShipmentStatus;
  handover: 'pickup' | 'dropoff' | null;
  handoverAt: string | null;
  createdAt: string;
  statusAt: string | null;
  deliveredAt: string | null;
  pickup: { status: string; windowStart: string; windowEnd: string } | null;
  dropoffPoint: { name?: string } | null;
};

/** Etapa de una etiqueta; null si está cancelada (no sale en el tablero). */
export function shipmentStage(
  s: Pick<BoardShipmentFacts, 'status' | 'handover'>,
): BoardStage | null {
  switch (s.status) {
    case 'label_created':
      return s.handover ? 'esperando' : 'por-entregar';
    case 'in_transit':
    case 'out_for_delivery':
    case 'at_pickup_point':
      return 'de-camino';
    case 'exception':
    case 'returned':
      return 'incidencias';
    case 'delivered':
      return 'entregados';
    case 'cancelled':
      return null;
  }
}

/**
 * Estado que se enseña en el tablero: el del envío, salvo que la etiqueta ya
 * esté en manos del transportista sin su primer escaneo (recogida pedida o
 * dejado en un punto), que en la base sigue como «etiqueta creada».
 */
export function shipmentBoardStatus(
  s: Pick<BoardShipmentFacts, 'status' | 'handover'>,
): { label: string; tone: BadgeTone } {
  if (s.status === 'label_created' && s.handover === 'pickup')
    return { label: 'Recogida pedida', tone: 'neutral' };
  if (s.status === 'label_created' && s.handover === 'dropoff')
    return { label: 'Dejado en un punto', tone: 'neutral' };
  return {
    label: SHIPMENT_STATUS_LABELS[s.status],
    tone: SHIPMENT_STATUS_TONES[s.status],
  };
}

/** Días naturales de Madrid entre un instante y ahora (0: hoy, 1: ayer). */
export function madridDaysSince(at: string, now: Date): number {
  const day = (date: Date) => {
    const [y, m, d] = madridDate(date).split('-').map(Number) as [
      number,
      number,
      number,
    ];
    return Date.UTC(y, m - 1, d);
  };
  return Math.max(0, Math.round((day(now) - day(new Date(at))) / 86400000));
}

/** «hoy», «ayer», «hace 3 días». */
export function daysAgoText(days: number): string {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

/** Desde este número de días, lo que espera a la tienda se marca. */
export const LATE_AFTER_DAYS = 2;

/**
 * Retraso de algo que ya está en manos del transportista sin su primer
 * escaneo: la recogida era otro día o el paquete lleva días en el punto.
 */
export type ShipmentAttention = 'pickup_overdue' | 'no_scan' | null;

export function shipmentAttention(
  s: BoardShipmentFacts,
  now: Date,
): ShipmentAttention {
  if (s.status !== 'label_created') return null;
  if (s.handover === 'pickup' && s.pickup)
    return madridDaysSince(s.pickup.windowEnd, now) >= 1
      ? 'pickup_overdue'
      : null;
  if (s.handover === 'dropoff' && s.handoverAt)
    return madridDaysSince(s.handoverAt, now) >= LATE_AFTER_DAYS
      ? 'no_scan'
      : null;
  return null;
}

/** ¿Pide algo a la tienda? (vista «Por hacer»). */
export function needsAction(s: BoardShipmentFacts, now: Date): boolean {
  const stage = shipmentStage(s);
  return (
    stage === 'por-entregar' ||
    stage === 'incidencias' ||
    shipmentAttention(s, now) !== null
  );
}

export type StepTone = 'muted' | 'default' | 'warning' | 'danger';
export type NextStep = { text: string; tone: StepTone };

const DAY = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Madrid',
});
const SHORT_DAY = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Madrid',
});
const TIME = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

/** Qué toca hacer con una etiqueta, en una frase. */
export function shipmentNextStep(s: BoardShipmentFacts, now: Date): NextStep {
  switch (s.status) {
    case 'label_created': {
      if (s.handover === 'pickup' && s.pickup) {
        const day = DAY.format(new Date(s.pickup.windowStart));
        if (shipmentAttention(s, now) === 'pickup_overdue')
          return {
            text: `La recogida era el ${day} y el transportista aún no lo ha escaneado: llámale.`,
            tone: 'danger',
          };
        const window = `${TIME.format(new Date(s.pickup.windowStart))} a ${TIME.format(new Date(s.pickup.windowEnd))}`;
        return {
          text: `Recogida el ${day}, de ${window}${s.pickup.status === 'by_phone' ? ' (pedida por teléfono)' : ''}.`,
          tone: 'default',
        };
      }
      if (s.handover === 'dropoff') {
        const point = s.dropoffPoint?.name ?? 'un punto de entrega';
        if (shipmentAttention(s, now) === 'no_scan' && s.handoverAt)
          return {
            text: `Dejado en ${point} ${daysAgoText(madridDaysSince(s.handoverAt, now))} y aún sin escanear: pregunta en el punto.`,
            tone: 'warning',
          };
        return {
          text: `Dejado en ${point}; falta el primer escaneo.`,
          tone: 'muted',
        };
      }
      const days = madridDaysSince(s.createdAt, now);
      return days >= LATE_AFTER_DAYS
        ? {
            text: `Etiqueta creada ${daysAgoText(days)}: pide la recogida o llévalo a un punto.`,
            tone: 'warning',
          }
        : {
            text: 'Pide la recogida o llévalo a un punto de entrega.',
            tone: 'default',
          };
    }
    case 'in_transit':
      return { text: 'Lo lleva el transportista.', tone: 'muted' };
    case 'out_for_delivery':
      return { text: 'En reparto.', tone: 'muted' };
    case 'at_pickup_point':
      return {
        text: 'Espera en un punto a que el cliente lo recoja.',
        tone: 'muted',
      };
    case 'exception':
      return {
        text: 'Revisa el seguimiento; llama al transportista o escribe al cliente.',
        tone: 'danger',
      };
    case 'returned':
      return {
        text: 'Vuelve a la tienda: decide si reenviarlo o devolver el dinero.',
        tone: 'danger',
      };
    case 'delivered': {
      const at = s.deliveredAt ?? s.statusAt;
      return {
        text: at
          ? `Entregado el ${SHORT_DAY.format(new Date(at))}.`
          : 'Entregado.',
        tone: 'muted',
      };
    }
    case 'cancelled':
      return { text: 'Etiqueta cancelada.', tone: 'muted' };
  }
}

/** Cuánto lleva pagado un pedido sin etiqueta. */
export function paidWaitStep(paidAt: string | null, now: Date): NextStep {
  if (!paidAt) return { text: 'Crea la etiqueta.', tone: 'default' };
  const days = madridDaysSince(paidAt, now);
  return {
    text: `Pagado ${daysAgoText(days)}.`,
    tone: days >= LATE_AFTER_DAYS ? 'warning' : 'muted',
  };
}

// ---------------------------------------------------------------------------
// Filtros (?vista=&q=&transportista=)
// ---------------------------------------------------------------------------

export type BoardSearch = {
  vista?: string;
  q?: string;
  transportista?: string;
};

export type BoardFilter = {
  view: BoardView;
  /** Número de pedido o de seguimiento; vacío, sin búsqueda. */
  query: string;
  /** Código del transportista (el de la plataforma o el manual). */
  carrier: string | null;
  /** Parámetros válidos distintos de la vista, para los enlaces. */
  search: URLSearchParams;
};

const CARRIER = /^[a-z0-9_:.-]{1,60}$/;

export function parseBoardFilter(params: BoardSearch): BoardFilter {
  const search = new URLSearchParams();
  const view = (BOARD_VIEWS as readonly string[]).includes(params.vista ?? '')
    ? (params.vista as BoardView)
    : 'por-hacer';
  const query = (params.q ?? '').trim().slice(0, 60);
  if (query) search.set('q', query);
  const carrier =
    params.transportista && CARRIER.test(params.transportista)
      ? params.transportista
      : null;
  if (carrier) search.set('transportista', carrier);
  return { view, query, carrier, search };
}

/** Enlace a una vista conservando la búsqueda y el transportista. */
export function boardViewHref(view: BoardView, search: URLSearchParams) {
  const params = new URLSearchParams(search);
  if (view !== 'por-hacer') params.set('vista', view);
  else params.delete('vista');
  const query = params.toString();
  return `/admin/envios${query ? `?${query}` : ''}`;
}

/**
 * Coincide con la búsqueda: el número de pedido exacto («1042», «Nº 1042»,
 * «#1042») o parte del número de seguimiento, sin mayúsculas ni espacios.
 */
export function matchesBoardQuery(
  item: { orderNumber: number; trackingNumber?: string | null },
  query: string,
): boolean {
  const q = query
    .trim()
    .toLowerCase()
    .replace(/^(?:n[º°o]\.?|#)\s*/, '')
    .replace(/\s+/g, '');
  if (!q) return true;
  if (/^\d+$/.test(q) && String(item.orderNumber) === q) return true;
  const tracking = (item.trackingNumber ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');
  return tracking !== '' && tracking.includes(q);
}

/** Filas agrupadas por transportista, por nombre. */
export function groupByCarrier<
  T extends { carrierCode: string; carrierName: string },
>(rows: readonly T[]): { code: string; name: string; rows: T[] }[] {
  const groups = new Map<string, { code: string; name: string; rows: T[] }>();
  for (const row of rows) {
    const group = groups.get(row.carrierCode);
    if (group) group.rows.push(row);
    else
      groups.set(row.carrierCode, {
        code: row.carrierCode,
        name: row.carrierName,
        rows: [row],
      });
  }
  return [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'es'),
  );
}
