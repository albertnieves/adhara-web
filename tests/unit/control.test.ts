import { describe, expect, it } from 'vitest';
import type {
  ControlCost,
  ControlDelivery,
  ControlTask,
  MonthFact,
} from '@/modules/control';
import {
  addMonths,
  billing,
  businessMonths,
  changeBp,
  costInMonth,
  costState,
  costsBetween,
  costsByMonth,
  countTasks,
  euros,
  factSales,
  isDueSoon,
  isOverdue,
  madridToday,
  monthLabel,
  monthlyEquivalent,
  monthsEndingAt,
  projectBalance,
  recurringMonthlyCents,
  signedPercent,
  sortDeliveries,
  sortTasks,
  sumMonths,
  topVariants,
} from '@/modules/control';

const VAT = 2100;

function cost(partial: Partial<ControlCost>): ControlCost {
  return {
    id: partial.concept ?? 'c',
    concept: 'Coste',
    area: 'business',
    category: 'other',
    amountNetCents: 10_000,
    frequency: 'monthly',
    startsOn: '2026-01-15',
    endsOn: null,
    notes: null,
    ...partial,
  };
}

function fact(partial: Partial<MonthFact>): MonthFact {
  return {
    month: '2026-10',
    variantId: 'v1',
    soldUnits: 0,
    returnedUnits: 0,
    pricedSoldUnits: 0,
    soldGrossCents: 0,
    pricedReturnedUnits: 0,
    returnedGrossCents: 0,
    cogsNetCents: 0,
    uncostedUnits: 0,
    receivedUnits: 0,
    receivedNetCents: 0,
    uncostedReceivedUnits: 0,
    retailPriceCents: null,
    ...partial,
  };
}

function task(partial: Partial<ControlTask>): ControlTask {
  return {
    id: partial.title ?? 't',
    title: 'Tarea',
    area: 'project',
    status: 'pending',
    priority: 'normal',
    owner: 'me',
    dueOn: null,
    notes: null,
    completedAt: null,
    createdAt: '2026-10-01T10:00:00Z',
    ...partial,
  };
}

function delivery(partial: Partial<ControlDelivery>): ControlDelivery {
  return {
    id: partial.title ?? 'd',
    title: 'Entrega',
    description: null,
    status: 'planned',
    dueOn: null,
    deliveredOn: null,
    reference: null,
    amountNetCents: null,
    billingStatus: null,
    createdAt: '2026-10-01T10:00:00Z',
    ...partial,
  };
}

describe('meses de Madrid', () => {
  it('el día de hoy es el de Madrid, no el del servidor', () => {
    // 23:30 UTC del 31 de octubre ya es 1 de noviembre en Madrid.
    expect(madridToday(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
  });

  it('suma meses cruzando años', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthsEndingAt('2026-02', 4)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('rotula el mes en español', () => {
    expect(monthLabel('2026-10')).toBe('oct 2026');
  });
});

describe('costes', () => {
  it('un mensual cuenta cada mes de su vigencia, desde su mes de inicio', () => {
    const rent = cost({ startsOn: '2026-03-20', endsOn: '2026-06-10' });
    expect(costInMonth(rent, '2026-02')).toBe(0);
    expect(costInMonth(rent, '2026-03')).toBe(10_000);
    expect(costInMonth(rent, '2026-06')).toBe(10_000);
    expect(costInMonth(rent, '2026-07')).toBe(0);
  });

  it('un anual se paga en el mes de inicio de cada año', () => {
    const domain = cost({
      frequency: 'yearly',
      amountNetCents: 1_500,
      startsOn: '2025-11-02',
    });
    expect(costInMonth(domain, '2025-11')).toBe(1_500);
    expect(costInMonth(domain, '2026-10')).toBe(0);
    expect(costInMonth(domain, '2026-11')).toBe(1_500);
    expect(monthlyEquivalent(domain)).toBe(125);
  });

  it('un puntual solo cuenta en su mes y no tiene equivalente mensual', () => {
    const once = cost({ frequency: 'once', startsOn: '2026-10-05' });
    expect(costInMonth(once, '2026-10')).toBe(10_000);
    expect(costInMonth(once, '2026-11')).toBe(0);
    expect(monthlyEquivalent(once)).toBe(0);
    expect(costState(once, '2026-12-01')).toBe('ended');
  });

  it('estado según la fecha de hoy', () => {
    const c = cost({ startsOn: '2026-11-01', endsOn: '2027-01-31' });
    expect(costState(c, '2026-10-10')).toBe('upcoming');
    expect(costState(c, '2026-12-10')).toBe('active');
    expect(costState(c, '2027-02-01')).toBe('ended');
  });

  it('agrupa por mes y categoría y filtra por área', () => {
    const costs = [
      cost({ concept: 'Alquiler', category: 'rent', amountNetCents: 80_000 }),
      cost({
        concept: 'Hosting',
        area: 'project',
        category: 'hosting',
        amountNetCents: 2_000,
      }),
    ];
    const [row] = costsByMonth(costs, ['2026-10']);
    expect(row).toEqual({
      month: '2026-10',
      totalCents: 82_000,
      byCategory: { rent: 80_000, hosting: 2_000 },
    });
    expect(costsByMonth(costs, ['2026-10'], 'project')[0]!.totalCents).toBe(
      2_000,
    );
    expect(recurringMonthlyCents(costs, '2026-10', 'business')).toBe(80_000);
    expect(costsBetween(costs, '2026-09', '2026-10', 'project')).toBe(4_000);
  });
});

describe('cuenta de resultados del negocio', () => {
  it('estima con el PVP lo que no tiene precio cobrado', () => {
    const sales = factSales(
      fact({
        soldUnits: 5,
        pricedSoldUnits: 3,
        soldGrossCents: 3 * 4_000,
        returnedUnits: 1,
        pricedReturnedUnits: 0,
        retailPriceCents: 5_000,
      }),
    );
    // 3 cobradas a 40 € + (2 − 1) sin precio a 50 € de PVP.
    expect(sales).toEqual({
      grossCents: 17_000,
      estimatedCents: 5_000,
      unpricedUnits: 0,
    });
  });

  it('sin precio ni PVP, las unidades no cuentan y se señalan', () => {
    expect(factSales(fact({ soldUnits: 2, retailPriceCents: null }))).toEqual({
      grossCents: 0,
      estimatedCents: 0,
      unpricedUnits: 2,
    });
  });

  it('ventas sin IVA, margen y beneficio tras los costes del negocio', () => {
    const facts = [
      fact({
        soldUnits: 2,
        pricedSoldUnits: 2,
        soldGrossCents: 12_100,
        cogsNetCents: 4_000,
        receivedUnits: 10,
        receivedNetCents: 20_000,
      }),
      fact({
        month: '2026-09',
        soldUnits: 1,
        pricedSoldUnits: 1,
        soldGrossCents: 1_210,
      }),
    ];
    const costs = [
      cost({ amountNetCents: 3_000 }),
      cost({ concept: 'Proyecto', area: 'project', amountNetCents: 9_999 }),
    ];
    const [september, october] = businessMonths(
      facts,
      costs,
      ['2026-09', '2026-10'],
      VAT,
    );
    expect(october).toMatchObject({
      grossSalesCents: 12_100,
      netSalesCents: 10_000,
      cogsCents: 4_000,
      grossMarginCents: 6_000,
      marginBp: 6_000,
      expensesCents: 3_000,
      profitCents: 3_000,
      purchasesCents: 20_000,
    });
    expect(september).toMatchObject({
      netSalesCents: 1_000,
      profitCents: -2_000,
    });
    const total = sumMonths([september!, october!]);
    expect(total).toMatchObject({
      netSalesCents: 11_000,
      grossMarginCents: 7_000,
      expensesCents: 6_000,
      profitCents: 1_000,
      purchasesCents: 20_000,
    });
  });

  it('un mes sin movimientos tiene sus costes y beneficio negativo', () => {
    const [row] = businessMonths([], [cost({})], ['2026-10'], VAT);
    expect(row).toMatchObject({
      netSalesCents: 0,
      marginBp: null,
      profitCents: -10_000,
    });
  });

  it('los más vendidos, netos de devoluciones', () => {
    const top = topVariants([
      fact({
        variantId: 'a',
        soldUnits: 3,
        returnedUnits: 1,
        retailPriceCents: 1_000,
      }),
      fact({ variantId: 'b', soldUnits: 4, retailPriceCents: 500 }),
      fact({
        variantId: 'c',
        soldUnits: 1,
        returnedUnits: 1,
        retailPriceCents: 500,
      }),
    ]);
    expect(top.map((r) => [r.variantId, r.units])).toEqual([
      ['b', 4],
      ['a', 2],
    ]);
  });

  it('variación sobre el mes anterior', () => {
    expect(changeBp(12_000, 10_000)).toBe(2_000);
    expect(changeBp(5_000, -10_000)).toBe(15_000);
    expect(changeBp(1, 0)).toBeNull();
    expect(signedPercent(2_000)).toBe('+20,0 %');
  });

  it('importes en euros con signo menos tipográfico', () => {
    expect(euros(123_456)).toBe('1234,56 €');
    expect(euros(-50)).toBe('−0,50 €');
  });
});

describe('tareas', () => {
  const today = '2026-10-10';

  it('vencidas y próximas', () => {
    expect(isOverdue(task({ dueOn: '2026-10-09' }), today)).toBe(true);
    expect(isOverdue(task({ dueOn: '2026-10-10' }), today)).toBe(false);
    expect(isDueSoon(task({ dueOn: '2026-10-24' }), today)).toBe(true);
    expect(isDueSoon(task({ dueOn: '2026-10-25' }), today)).toBe(false);
  });

  it('abiertas primero, por fecha y prioridad; las hechas al final', () => {
    const sorted = sortTasks([
      task({
        title: 'hecha',
        status: 'done',
        completedAt: '2026-10-05T10:00:00Z',
      }),
      task({ title: 'sin fecha alta', priority: 'high' }),
      task({ title: 'mañana', dueOn: '2026-10-11' }),
      task({ title: 'vencida', dueOn: '2026-10-01', priority: 'low' }),
    ]);
    expect(sorted.map((t) => t.title)).toEqual([
      'vencida',
      'mañana',
      'sin fecha alta',
      'hecha',
    ]);
  });

  it('cuenta abiertas, vencidas, del cliente y hechas este mes', () => {
    expect(
      countTasks(
        [
          task({ dueOn: '2026-10-01', owner: 'client' }),
          task({ status: 'blocked' }),
          task({ status: 'done', completedAt: '2026-10-02T08:00:00Z' }),
          task({ status: 'done', completedAt: '2026-09-30T08:00:00Z' }),
        ],
        today,
      ),
    ).toEqual({
      open: 2,
      overdue: 1,
      dueSoon: 0,
      blocked: 1,
      waitingOnClient: 1,
      doneThisMonth: 1,
    });
  });
});

describe('entregas y facturación', () => {
  const deliveries = [
    delivery({
      title: 'cobrada',
      status: 'accepted',
      amountNetCents: 100_000,
      billingStatus: 'paid',
      deliveredOn: '2026-09-01',
    }),
    delivery({
      title: 'facturada',
      status: 'delivered',
      amountNetCents: 50_000,
      billingStatus: 'invoiced',
      deliveredOn: '2026-10-01',
    }),
    delivery({
      title: 'por facturar',
      status: 'delivered',
      amountNetCents: 20_000,
      billingStatus: 'pending',
      deliveredOn: '2026-10-05',
    }),
    delivery({
      title: 'futura',
      status: 'planned',
      amountNetCents: 30_000,
      billingStatus: 'pending',
      dueOn: '2026-11-01',
    }),
    delivery({
      title: 'sin decidir',
      status: 'planned',
      amountNetCents: 9_000,
    }),
    delivery({
      title: 'gratis',
      status: 'delivered',
      amountNetCents: 7_000,
      billingStatus: 'none',
    }),
  ];

  it('separa lo cobrado, lo facturado, lo pendiente y lo futuro', () => {
    expect(billing(deliveries)).toEqual({
      toInvoiceCents: 20_000,
      invoicedCents: 50_000,
      paidCents: 100_000,
      plannedCents: 30_000,
      undecided: 1,
    });
  });

  it('balance del proyecto: facturado menos sus costes hasta hoy', () => {
    const balance = projectBalance(
      deliveries,
      [
        cost({
          area: 'project',
          amountNetCents: 2_000,
          startsOn: '2026-09-01',
        }),
        cost({ area: 'business', amountNetCents: 99_999 }),
      ],
      '2026-10-10',
    );
    expect(balance).toEqual({
      billedCents: 150_000,
      paidCents: 100_000,
      costsCents: 4_000,
      balanceCents: 146_000,
    });
  });

  it('pendientes primero por fecha; luego las entregadas más recientes', () => {
    expect(sortDeliveries(deliveries).map((d) => d.title)).toEqual([
      'futura',
      'sin decidir',
      'por facturar',
      'facturada',
      'cobrada',
      'gratis',
    ]);
  });
});
