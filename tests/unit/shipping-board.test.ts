import { describe, expect, it } from 'vitest';
import {
  boardViewHref,
  daysAgoText,
  groupByCarrier,
  madridDaysSince,
  matchesBoardQuery,
  needsAction,
  paidWaitStep,
  parseBoardFilter,
  shipmentAttention,
  shipmentBoardStatus,
  shipmentNextStep,
  shipmentStage,
} from '@/modules/shipping';
import type { BoardShipmentFacts } from '@/modules/shipping';

/*
 * Envíos → Seguimiento (DECISIONS §177): etapas, «Por hacer», avisos de
 * retraso, siguiente paso y filtros del tablero.
 */

// Miércoles 28/10/2026, 11:00 en Madrid (10:00 UTC, horario de invierno).
const NOW = new Date('2026-10-28T10:00:00Z');

function facts(over: Partial<BoardShipmentFacts> = {}): BoardShipmentFacts {
  return {
    status: 'label_created',
    handover: null,
    handoverAt: null,
    createdAt: '2026-10-28T08:00:00Z',
    statusAt: null,
    deliveredAt: null,
    pickup: null,
    dropoffPoint: null,
    ...over,
  };
}

describe('etapas del tablero', () => {
  it('clasifica cada estado en su etapa', () => {
    expect(shipmentStage(facts())).toBe('por-entregar');
    expect(shipmentStage(facts({ handover: 'pickup' }))).toBe('esperando');
    expect(shipmentStage(facts({ handover: 'dropoff' }))).toBe('esperando');
    for (const status of [
      'in_transit',
      'out_for_delivery',
      'at_pickup_point',
    ] as const)
      expect(shipmentStage(facts({ status }))).toBe('de-camino');
    expect(shipmentStage(facts({ status: 'exception' }))).toBe('incidencias');
    expect(shipmentStage(facts({ status: 'returned' }))).toBe('incidencias');
    expect(shipmentStage(facts({ status: 'delivered' }))).toBe('entregados');
    expect(shipmentStage(facts({ status: 'cancelled' }))).toBeNull();
  });

  it('el paquete dejado en un punto sin escanear ya no se pierde', () => {
    // Antes no salía en ninguna sección: ni «por entregar» ni «recogidas».
    const dropped = facts({
      handover: 'dropoff',
      handoverAt: '2026-10-28T09:00:00Z',
      dropoffPoint: { name: 'Oficina de Correos' },
    });
    expect(shipmentStage(dropped)).toBe('esperando');
    expect(shipmentNextStep(dropped, NOW)).toEqual({
      text: 'Dejado en Oficina de Correos; falta el primer escaneo.',
      tone: 'muted',
    });
  });
});

describe('estado en el tablero', () => {
  it('distingue la recogida pedida y el punto de la etiqueta sin entregar', () => {
    expect(shipmentBoardStatus(facts())).toEqual({
      label: 'Etiqueta creada',
      tone: 'neutral',
    });
    expect(shipmentBoardStatus(facts({ handover: 'pickup' })).label).toBe(
      'Recogida pedida',
    );
    expect(shipmentBoardStatus(facts({ handover: 'dropoff' })).label).toBe(
      'Dejado en un punto',
    );
    // Una vez escaneado manda el estado del transportista.
    expect(
      shipmentBoardStatus(facts({ status: 'in_transit', handover: 'dropoff' })),
    ).toEqual({ label: 'En camino', tone: 'accent' });
  });
});

describe('días en Madrid', () => {
  it('cuenta días naturales de Madrid, no de 24 horas', () => {
    // 23:30 del martes en Madrid (22:30 UTC) frente al miércoles a las 11:00.
    expect(madridDaysSince('2026-10-27T22:30:00Z', NOW)).toBe(1);
    // 00:30 del miércoles en Madrid (23:30 UTC del martes): hoy.
    expect(madridDaysSince('2026-10-27T23:30:00Z', NOW)).toBe(0);
    expect(madridDaysSince('2026-10-25T10:00:00Z', NOW)).toBe(3);
    // Un instante futuro no da días negativos.
    expect(madridDaysSince('2026-10-30T10:00:00Z', NOW)).toBe(0);
  });

  it('dice hoy, ayer o hace n días', () => {
    expect(daysAgoText(0)).toBe('hoy');
    expect(daysAgoText(1)).toBe('ayer');
    expect(daysAgoText(4)).toBe('hace 4 días');
  });
});

describe('avisos y «Por hacer»', () => {
  const pickup = (windowStart: string, windowEnd: string) =>
    facts({
      handover: 'pickup',
      handoverAt: '2026-10-26T09:00:00Z',
      pickup: { status: 'requested', windowStart, windowEnd },
    });

  it('la recogida de hoy no avisa; la de ayer sin escaneo, sí', () => {
    const today = pickup('2026-10-28T09:00:00Z', '2026-10-28T13:00:00Z');
    expect(shipmentAttention(today, NOW)).toBeNull();
    expect(needsAction(today, NOW)).toBe(false);
    expect(shipmentNextStep(today, NOW)).toEqual({
      text: 'Recogida el miércoles, 28 de octubre, de 10:00 a 14:00.',
      tone: 'default',
    });

    const yesterday = pickup('2026-10-27T09:00:00Z', '2026-10-27T13:00:00Z');
    expect(shipmentAttention(yesterday, NOW)).toBe('pickup_overdue');
    expect(needsAction(yesterday, NOW)).toBe(true);
    expect(shipmentNextStep(yesterday, NOW).tone).toBe('danger');
  });

  it('la recogida pedida por teléfono lo dice', () => {
    const phone = facts({
      handover: 'pickup',
      pickup: {
        status: 'by_phone',
        windowStart: '2026-10-29T09:00:00Z',
        windowEnd: '2026-10-29T13:00:00Z',
      },
    });
    expect(shipmentNextStep(phone, NOW).text).toMatch(
      /jueves, 29 de octubre.*\(pedida por teléfono\)/,
    );
  });

  it('el punto de entrega avisa a los dos días sin escaneo', () => {
    const at = (handoverAt: string) =>
      facts({ handover: 'dropoff', handoverAt });
    expect(shipmentAttention(at('2026-10-27T09:00:00Z'), NOW)).toBeNull();
    const late = at('2026-10-26T09:00:00Z');
    expect(shipmentAttention(late, NOW)).toBe('no_scan');
    expect(shipmentNextStep(late, NOW)).toEqual({
      text: 'Dejado en un punto de entrega hace 2 días y aún sin escanear: pregunta en el punto.',
      tone: 'warning',
    });
  });

  it('«Por hacer»: etiquetas sin entregar, incidencias y retrasos', () => {
    expect(needsAction(facts(), NOW)).toBe(true);
    expect(needsAction(facts({ status: 'exception' }), NOW)).toBe(true);
    expect(needsAction(facts({ status: 'returned' }), NOW)).toBe(true);
    expect(needsAction(facts({ status: 'in_transit' }), NOW)).toBe(false);
    expect(needsAction(facts({ status: 'delivered' }), NOW)).toBe(false);
    expect(needsAction(facts({ status: 'cancelled' }), NOW)).toBe(false);
  });

  it('una etiqueta sin entregar desde hace días se marca', () => {
    expect(shipmentNextStep(facts(), NOW).tone).toBe('default');
    expect(
      shipmentNextStep(facts({ createdAt: '2026-10-26T09:00:00Z' }), NOW),
    ).toEqual({
      text: 'Etiqueta creada hace 2 días: pide la recogida o llévalo a un punto.',
      tone: 'warning',
    });
  });

  it('un pedido pagado hace días sin etiqueta se marca', () => {
    expect(paidWaitStep('2026-10-28T08:00:00Z', NOW)).toEqual({
      text: 'Pagado hoy.',
      tone: 'muted',
    });
    expect(paidWaitStep('2026-10-27T08:00:00Z', NOW).text).toBe('Pagado ayer.');
    expect(paidWaitStep('2026-10-25T08:00:00Z', NOW)).toEqual({
      text: 'Pagado hace 3 días.',
      tone: 'warning',
    });
  });

  it('entregado, con su fecha', () => {
    expect(
      shipmentNextStep(
        facts({ status: 'delivered', deliveredAt: '2026-10-27T15:00:00Z' }),
        NOW,
      ).text,
    ).toBe('Entregado el 27 de octubre.');
  });
});

describe('filtros del tablero', () => {
  it('por defecto, «Por hacer»; ignora vistas y transportistas raros', () => {
    const f = parseBoardFilter({});
    expect(f.view).toBe('por-hacer');
    expect(f.query).toBe('');
    expect(f.carrier).toBeNull();
    expect(parseBoardFilter({ vista: 'nada' }).view).toBe('por-hacer');
    expect(parseBoardFilter({ transportista: '<script>' }).carrier).toBeNull();
  });

  it('conserva búsqueda y transportista en los enlaces de las vistas', () => {
    const f = parseBoardFilter({
      vista: 'de-camino',
      q: '  1042 ',
      transportista: 'seur',
    });
    expect(f).toMatchObject({
      view: 'de-camino',
      query: '1042',
      carrier: 'seur',
    });
    expect(boardViewHref('incidencias', f.search)).toBe(
      '/admin/envios?q=1042&transportista=seur&vista=incidencias',
    );
    expect(boardViewHref('por-hacer', f.search)).toBe(
      '/admin/envios?q=1042&transportista=seur',
    );
    expect(boardViewHref('por-hacer', new URLSearchParams())).toBe(
      '/admin/envios',
    );
  });

  it('busca por número de pedido exacto o parte del seguimiento', () => {
    const item = { orderNumber: 1042, trackingNumber: 'PQ 4R1 23ES' };
    expect(matchesBoardQuery(item, '')).toBe(true);
    expect(matchesBoardQuery(item, '1042')).toBe(true);
    expect(matchesBoardQuery(item, 'Nº 1042')).toBe(true);
    expect(matchesBoardQuery(item, '#1042')).toBe(true);
    expect(matchesBoardQuery(item, '104')).toBe(false);
    expect(matchesBoardQuery(item, 'pq4r1')).toBe(true);
    expect(matchesBoardQuery(item, '23es')).toBe(true);
    expect(matchesBoardQuery({ orderNumber: 7 }, 'pq')).toBe(false);
  });

  it('agrupa por transportista, por nombre', () => {
    const groups = groupByCarrier([
      { id: 1, carrierCode: 'seur', carrierName: 'SEUR' },
      { id: 2, carrierCode: 'correos', carrierName: 'Correos' },
      { id: 3, carrierCode: 'seur', carrierName: 'SEUR' },
    ]);
    expect(groups.map((g) => [g.code, g.rows.map((r) => r.id)])).toEqual([
      ['correos', [2]],
      ['seur', [1, 3]],
    ]);
  });
});
