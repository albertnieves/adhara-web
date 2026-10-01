/**
 * Informe de existencias de un periodo (cierre mensual, valor del inventario y
 * rotación). Las categorías de movimiento se repiten en SQL
 * (private.movement_report_bucket); tests/unit/reports-sql.test.ts comprueba
 * que coinciden.
 */
import type { MovementType } from '@/modules/inventory';

export const REPORT_BUCKETS = [
  'received',
  'sold',
  'returned',
  'lost',
  'adjusted',
  'transferred',
] as const;
export type ReportBucket = (typeof REPORT_BUCKETS)[number];

/** null: el tipo no cambia las unidades en tienda (reservas, devolución dañada). */
export const MOVEMENT_REPORT_BUCKET: Readonly<
  Record<MovementType, ReportBucket | null>
> = {
  PURCHASE_RECEIPT: 'received',
  TRANSFER_IN: 'received',
  SALE_STORE: 'sold',
  SALE_ONLINE: 'sold',
  SALE_CLICK_COLLECT: 'sold',
  RETURN: 'returned',
  DAMAGE_LOSS: 'lost',
  TESTER_ALLOCATION: 'lost',
  STOCKTAKE_ADJUSTMENT: 'adjusted',
  MANUAL_ADJUSTMENT: 'adjusted',
  TRANSFER_OUT: 'transferred',
  RESERVATION: null,
  RESERVATION_RELEASE: null,
  RETURN_DAMAGED: null,
};

export const BUCKET_LABELS: Readonly<Record<ReportBucket, string>> = {
  received: 'Entradas',
  sold: 'Ventas',
  returned: 'Devoluciones',
  lost: 'Mermas y probadores',
  adjusted: 'Ajustes',
  transferred: 'Traslados',
};

export type PeriodUnits = {
  openingUnits: number;
  receivedUnits: number;
  soldUnits: number;
  returnedUnits: number;
  lostUnits: number;
  adjustedUnits: number;
  transferredUnits: number;
  closingUnits: number;
};

export type PeriodCost = {
  costNetCents: number;
  /** Registrado después de la fecha: no había coste a esa fecha. */
  isLater: boolean;
} | null;

export type PeriodRow = PeriodUnits & {
  variantId: string;
  lastSaleAt: Date | null;
  /** null: sin permiso de costes o sin ningún coste registrado. */
  openingCost: PeriodCost;
  closingCost: PeriodCost;
};

/** Iniciales + entradas − ventas + devoluciones − mermas ± ajustes − traslados. */
export function expectedClosing(row: PeriodUnits): number {
  return (
    row.openingUnits +
    row.receivedUnits -
    row.soldUnits +
    row.returnedUnits -
    row.lostUnits +
    row.adjustedUnits -
    row.transferredUnits
  );
}

export function balances(row: PeriodUnits): boolean {
  return expectedClosing(row) === row.closingUnits;
}

/** Valor a coste; null si no hay coste (nunca 0 por falta de coste). */
export function valueAtCost(units: number, cost: PeriodCost): number | null {
  if (units === 0) return 0;
  return cost ? units * cost.costNetCents : null;
}

export type ValuationTotals = {
  units: number;
  /** Valor de las unidades con coste. */
  valueCents: number;
  /** Unidades sin ningún coste registrado: no suman al valor. */
  unitsWithoutCost: number;
  /** Unidades valoradas con un coste registrado después de la fecha. */
  unitsWithLaterCost: number;
};

export function emptyTotals(): ValuationTotals {
  return {
    units: 0,
    valueCents: 0,
    unitsWithoutCost: 0,
    unitsWithLaterCost: 0,
  };
}

export function addValuation(
  totals: ValuationTotals,
  units: number,
  cost: PeriodCost,
): ValuationTotals {
  if (units === 0) return totals;
  return {
    units: totals.units + units,
    valueCents: totals.valueCents + (cost ? units * cost.costNetCents : 0),
    unitsWithoutCost: totals.unitsWithoutCost + (cost ? 0 : units),
    unitsWithLaterCost: totals.unitsWithLaterCost + (cost?.isLater ? units : 0),
  };
}

export type GroupSummary = PeriodUnits & {
  key: string;
  label: string;
  formats: number;
  opening: ValuationTotals;
  closing: ValuationTotals;
};

/** Suma por grupo (marca) y total; los grupos, por valor final y nombre. */
export function summarize<T extends PeriodRow>(
  rows: readonly T[],
  groupOf: (row: T) => { key: string; label: string },
): { groups: GroupSummary[]; total: GroupSummary } {
  const empty = (key: string, label: string): GroupSummary => ({
    key,
    label,
    formats: 0,
    openingUnits: 0,
    receivedUnits: 0,
    soldUnits: 0,
    returnedUnits: 0,
    lostUnits: 0,
    adjustedUnits: 0,
    transferredUnits: 0,
    closingUnits: 0,
    opening: emptyTotals(),
    closing: emptyTotals(),
  });
  const add = (group: GroupSummary, row: T): GroupSummary => ({
    ...group,
    formats: group.formats + 1,
    openingUnits: group.openingUnits + row.openingUnits,
    receivedUnits: group.receivedUnits + row.receivedUnits,
    soldUnits: group.soldUnits + row.soldUnits,
    returnedUnits: group.returnedUnits + row.returnedUnits,
    lostUnits: group.lostUnits + row.lostUnits,
    adjustedUnits: group.adjustedUnits + row.adjustedUnits,
    transferredUnits: group.transferredUnits + row.transferredUnits,
    closingUnits: group.closingUnits + row.closingUnits,
    opening: addValuation(group.opening, row.openingUnits, row.openingCost),
    closing: addValuation(group.closing, row.closingUnits, row.closingCost),
  });
  const groups = new Map<string, GroupSummary>();
  let total = empty('total', 'Total');
  for (const row of rows) {
    const { key, label } = groupOf(row);
    groups.set(key, add(groups.get(key) ?? empty(key, label), row));
    total = add(total, row);
  }
  return {
    groups: [...groups.values()].sort(
      (a, b) =>
        b.closing.valueCents - a.closing.valueCents ||
        a.label.localeCompare(b.label, 'es'),
    ),
    total,
  };
}

export type Rotation = {
  /** Stock medio aproximado: media de iniciales y finales. */
  averageStock: number;
  /** Veces que se vende el stock medio en el periodo; null sin stock medio. */
  turnover: number | null;
  /** Días que duran las existencias finales al ritmo del periodo; null sin ventas. */
  coverDays: number | null;
  /** Días desde la última venta (o null si nunca se vendió). */
  daysSinceSale: number | null;
};

export function rotation(
  row: PeriodUnits & { lastSaleAt: Date | null },
  periodDays: number,
  now: Date,
): Rotation {
  const averageStock = (row.openingUnits + row.closingUnits) / 2;
  const daily = periodDays > 0 ? row.soldUnits / periodDays : 0;
  return {
    averageStock,
    turnover: averageStock > 0 ? row.soldUnits / averageStock : null,
    coverDays:
      daily > 0 ? Math.floor(Math.max(row.closingUnits, 0) / daily) : null,
    daysSinceSale: row.lastSaleAt
      ? Math.floor((now.getTime() - row.lastSaleAt.getTime()) / 86_400_000)
      : null,
  };
}

/** Formatos con existencias o movimientos en el periodo (los demás no salen). */
export function hasActivity(row: PeriodUnits): boolean {
  return (
    row.openingUnits !== 0 ||
    row.closingUnits !== 0 ||
    row.receivedUnits !== 0 ||
    row.soldUnits !== 0 ||
    row.returnedUnits !== 0 ||
    row.lostUnits !== 0 ||
    row.adjustedUnits !== 0 ||
    row.transferredUnits !== 0
  );
}
