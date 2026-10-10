import type { BasisPoints, Cents } from '@/lib/money';
import { grossToNet, ratioBp } from '@/lib/money';
import type { ControlCost } from './costs';
import { costInMonth } from './costs';
import type { MonthKey } from './months';

/**
 * Cuenta de resultados del negocio por mes, con los hechos de
 * admin_control_month_facts (uno por mes y formato):
 *
 *   ventas con IVA = cobrado − devuelto, y lo que no tiene precio cobrado
 *                    (ventas anteriores al cambio del mostrador o desde
 *                    Inventario) se estima con el PVP vigente;
 *   ventas netas   = ventas con IVA sin el IVA general;
 *   margen bruto   = ventas netas − coste de lo vendido (coste vigente en
 *                    cada venta, menos el de lo devuelto);
 *   beneficio      = margen bruto − costes del negocio pagados en el mes.
 *
 * Las compras recibidas (a coste) se muestran aparte: son salida de caja, no
 * gasto, porque el gasto es el coste de lo que se vende.
 */
export type MonthFact = {
  month: MonthKey;
  variantId: string;
  soldUnits: number;
  returnedUnits: number;
  pricedSoldUnits: number;
  soldGrossCents: Cents;
  pricedReturnedUnits: number;
  returnedGrossCents: Cents;
  cogsNetCents: Cents;
  uncostedUnits: number;
  receivedUnits: number;
  receivedNetCents: Cents;
  uncostedReceivedUnits: number;
  retailPriceCents: Cents | null;
};

export type BusinessFigures = {
  soldUnits: number;
  returnedUnits: number;
  grossSalesCents: Cents;
  /** Parte de las ventas con IVA estimada con el PVP vigente. */
  estimatedGrossCents: Cents;
  /** Unidades vendidas sin precio cobrado ni PVP: no cuentan en las ventas. */
  unpricedUnits: number;
  netSalesCents: Cents;
  cogsCents: Cents;
  /** Unidades vendidas o devueltas sin coste: el margen sale más alto. */
  uncostedUnits: number;
  grossMarginCents: Cents;
  marginBp: BasisPoints | null;
  expensesCents: Cents;
  profitCents: Cents;
  receivedUnits: number;
  purchasesCents: Cents;
  uncostedReceivedUnits: number;
};

export type BusinessMonth = BusinessFigures & { month: MonthKey };

const EMPTY: BusinessFigures = {
  soldUnits: 0,
  returnedUnits: 0,
  grossSalesCents: 0,
  estimatedGrossCents: 0,
  unpricedUnits: 0,
  netSalesCents: 0,
  cogsCents: 0,
  uncostedUnits: 0,
  grossMarginCents: 0,
  marginBp: null,
  expensesCents: 0,
  profitCents: 0,
  receivedUnits: 0,
  purchasesCents: 0,
  uncostedReceivedUnits: 0,
};

/** Ventas con IVA de un hecho: cobrado y estimado, y unidades sin precio. */
export function factSales(fact: MonthFact): {
  grossCents: Cents;
  estimatedCents: Cents;
  unpricedUnits: number;
} {
  const unpricedSold = fact.soldUnits - fact.pricedSoldUnits;
  const unpricedReturned = fact.returnedUnits - fact.pricedReturnedUnits;
  const retail = fact.retailPriceCents;
  const estimatedCents =
    retail === null ? 0 : (unpricedSold - unpricedReturned) * retail;
  return {
    grossCents: fact.soldGrossCents - fact.returnedGrossCents + estimatedCents,
    estimatedCents,
    unpricedUnits: retail === null ? Math.max(unpricedSold, 0) : 0,
  };
}

function finish(
  figures: Omit<
    BusinessFigures,
    'netSalesCents' | 'grossMarginCents' | 'marginBp' | 'profitCents'
  >,
  vatBp: BasisPoints,
): BusinessFigures {
  const netSalesCents = grossToNet(figures.grossSalesCents, vatBp);
  const grossMarginCents = netSalesCents - figures.cogsCents;
  return {
    ...figures,
    netSalesCents,
    grossMarginCents,
    marginBp:
      netSalesCents > 0 ? ratioBp(grossMarginCents, netSalesCents) : null,
    profitCents: grossMarginCents - figures.expensesCents,
  };
}

/** Una fila por mes, también los meses sin movimientos. */
export function businessMonths(
  facts: readonly MonthFact[],
  costs: readonly ControlCost[],
  months: readonly MonthKey[],
  vatBp: BasisPoints,
): BusinessMonth[] {
  const business = costs.filter((c) => c.area === 'business');
  return months.map((month) => {
    const raw = { ...EMPTY };
    for (const fact of facts) {
      if (fact.month !== month) continue;
      const sales = factSales(fact);
      raw.soldUnits += fact.soldUnits;
      raw.returnedUnits += fact.returnedUnits;
      raw.grossSalesCents += sales.grossCents;
      raw.estimatedGrossCents += sales.estimatedCents;
      raw.unpricedUnits += sales.unpricedUnits;
      raw.cogsCents += fact.cogsNetCents;
      raw.uncostedUnits += fact.uncostedUnits;
      raw.receivedUnits += fact.receivedUnits;
      raw.purchasesCents += fact.receivedNetCents;
      raw.uncostedReceivedUnits += fact.uncostedReceivedUnits;
    }
    raw.expensesCents = business.reduce(
      (sum, cost) => sum + costInMonth(cost, month),
      0,
    );
    return { month, ...finish(raw, vatBp) };
  });
}

/** Suma de varios meses (el margen se recalcula sobre el total). */
export function sumMonths(rows: readonly BusinessMonth[]): BusinessFigures {
  const raw = { ...EMPTY };
  for (const row of rows) {
    raw.soldUnits += row.soldUnits;
    raw.returnedUnits += row.returnedUnits;
    raw.grossSalesCents += row.grossSalesCents;
    raw.estimatedGrossCents += row.estimatedGrossCents;
    raw.unpricedUnits += row.unpricedUnits;
    raw.cogsCents += row.cogsCents;
    raw.uncostedUnits += row.uncostedUnits;
    raw.expensesCents += row.expensesCents;
    raw.receivedUnits += row.receivedUnits;
    raw.purchasesCents += row.purchasesCents;
    raw.uncostedReceivedUnits += row.uncostedReceivedUnits;
  }
  // Las ventas netas de cada mes ya están redondeadas: se suman tal cual
  // para que el total cuadre con las filas.
  const netSalesCents = rows.reduce((sum, row) => sum + row.netSalesCents, 0);
  const grossMarginCents = netSalesCents - raw.cogsCents;
  return {
    ...raw,
    netSalesCents,
    grossMarginCents,
    marginBp:
      netSalesCents > 0 ? ratioBp(grossMarginCents, netSalesCents) : null,
    profitCents: grossMarginCents - raw.expensesCents,
  };
}

export type VariantSales = {
  variantId: string;
  units: number;
  grossCents: Cents;
  estimatedCents: Cents;
};

/** Formatos más vendidos (unidades netas de devoluciones) en los hechos dados. */
export function topVariants(
  facts: readonly MonthFact[],
  limit = 10,
): VariantSales[] {
  const byVariant = new Map<string, VariantSales>();
  for (const fact of facts) {
    const sales = factSales(fact);
    const row = byVariant.get(fact.variantId) ?? {
      variantId: fact.variantId,
      units: 0,
      grossCents: 0,
      estimatedCents: 0,
    };
    row.units += fact.soldUnits - fact.returnedUnits;
    row.grossCents += sales.grossCents;
    row.estimatedCents += sales.estimatedCents;
    byVariant.set(fact.variantId, row);
  }
  return [...byVariant.values()]
    .filter((row) => row.units > 0)
    .sort(
      (a, b) =>
        b.units - a.units ||
        b.grossCents - a.grossCents ||
        a.variantId.localeCompare(b.variantId),
    )
    .slice(0, limit);
}

/** Variación relativa en puntos básicos; null si no hay base. */
export function changeBp(current: Cents, previous: Cents): BasisPoints | null {
  if (previous === 0) return null;
  return ratioBp(current - previous, Math.abs(previous));
}
