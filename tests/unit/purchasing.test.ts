import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUSES,
  availableOrderActions,
  canEditLines,
  canReceive,
  groupProposalsBySupplier,
  isOpenOrder,
  orderCostCents,
  planReceipt,
  roundToPack,
} from '@/modules/purchasing';

describe('estados del pedido de compra', () => {
  it('cada estado tiene nombre en el panel', () => {
    for (const status of PURCHASE_ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('acciones manuales por estado', () => {
    expect(availableOrderActions('draft')).toEqual(['order', 'cancel']);
    expect(availableOrderActions('ordered')).toEqual(['cancel']);
    expect(availableOrderActions('partially_received')).toEqual(['close']);
    for (const done of ['received', 'closed', 'cancelled'] as const) {
      expect(availableOrderActions(done)).toEqual([]);
      expect(isOpenOrder(done)).toBe(false);
    }
  });

  it('solo el borrador cambia líneas; solo lo pedido se recibe', () => {
    expect(canEditLines('draft')).toBe(true);
    expect(canEditLines('ordered')).toBe(false);
    expect(canReceive('draft')).toBe(false);
    expect(canReceive('ordered')).toBe(true);
    expect(canReceive('partially_received')).toBe(true);
    expect(canReceive('received')).toBe(false);
  });
});

describe('recepción de un pedido', () => {
  const lines = [
    { lineId: 1, ordered: 6, received: 0 },
    { lineId: 2, ordered: 4, received: 3 },
  ];

  it('recepción parcial', () => {
    expect(
      planReceipt(
        lines,
        new Map([
          [1, 2],
          [2, 0],
        ]),
      ),
    ).toEqual({
      ok: true,
      items: [{ lineId: 1, quantity: 2 }],
      units: 2,
      nextStatus: 'partially_received',
    });
  });

  it('recibir todo lo pendiente cierra el pedido como recibido', () => {
    const plan = planReceipt(
      lines,
      new Map([
        [1, 6],
        [2, 1],
      ]),
    );
    expect(plan).toMatchObject({ ok: true, units: 7, nextStatus: 'received' });
  });

  it('no deja recibir más de lo pendiente', () => {
    expect(planReceipt(lines, new Map([[2, 2]]))).toEqual({
      ok: false,
      error: 'over_receipt',
      lineId: 2,
    });
  });

  it('rechaza cantidades no enteras, negativas o de otra línea', () => {
    expect(planReceipt(lines, new Map([[1, 1.5]]))).toMatchObject({
      ok: false,
      error: 'invalid_quantity',
    });
    expect(planReceipt(lines, new Map([[1, -1]]))).toMatchObject({
      ok: false,
      error: 'invalid_quantity',
    });
    expect(planReceipt(lines, new Map([[9, 1]]))).toMatchObject({
      ok: false,
      error: 'invalid_quantity',
      lineId: 9,
    });
  });

  it('sin unidades no hay recepción', () => {
    expect(planReceipt(lines, new Map([[1, 0]]))).toEqual({
      ok: false,
      error: 'nothing_to_receive',
    });
  });
});

describe('coste del pedido', () => {
  it('suma cantidades por coste unitario', () => {
    expect(
      orderCostCents([
        { quantity: 3, unitCostCents: 1250 },
        { quantity: 2, unitCostCents: 999 },
      ]),
    ).toBe(5748);
  });

  it('se desconoce si falta algún coste', () => {
    expect(
      orderCostCents([
        { quantity: 3, unitCostCents: 1250 },
        { quantity: 1, unitCostCents: null },
      ]),
    ).toBeNull();
  });
});

describe('propuestas de reposición por proveedor', () => {
  const orient = { id: 's1', name: 'Orient Fragance' };
  const armaf = { id: 's2', name: 'Armaf' };

  it('agrupa por proveedor y separa los formatos sin proveedor', () => {
    const grouped = groupProposalsBySupplier([
      { variantId: 'a', quantity: 6, supplier: orient, packSize: 6 },
      { variantId: 'b', quantity: 2, supplier: armaf, packSize: null },
      { variantId: 'c', quantity: 4, supplier: orient, packSize: null },
      { variantId: 'd', quantity: 3, supplier: null, packSize: null },
      { variantId: 'e', quantity: 0, supplier: orient, packSize: null },
    ]);
    expect(grouped.bySupplier.map((g) => [g.supplier.name, g.units])).toEqual([
      ['Armaf', 2],
      ['Orient Fragance', 10],
    ]);
    expect(grouped.bySupplier[1]?.lines.map((l) => l.variantId)).toEqual([
      'a',
      'c',
    ]);
    expect(grouped.withoutSupplier).toEqual(['d']);
  });

  it('redondea al múltiplo de compra', () => {
    expect(roundToPack(7, 6)).toBe(12);
    expect(roundToPack(12, 6)).toBe(12);
    expect(roundToPack(7, null)).toBe(7);
    expect(roundToPack(7, 1)).toBe(7);
  });
});
