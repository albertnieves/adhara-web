/**
 * Construye la foto del inventario que analiza `watchStock` a partir de los
 * niveles de una ubicación y de los datos agregados de la base de datos
 * (admin_stock_watch_facts). Puro: el servidor solo lee y llama aquí.
 */
import type {
  FindingKind,
  FindingSeverity,
  StockFinding,
  StockSnapshot,
  StockWatchPolicy,
} from './stock-watch';

/** Parámetros guardados en `stock_watch_settings` (visibles en el panel). */
export type StockWatchSettings = StockWatchPolicy & {
  /** Días de ventas que se analizan para calcular la velocidad de venta. */
  salesWindowDays: number;
};

/** Límites de los parámetros; los mismos CHECK que en SQL. */
export const WATCH_SETTING_LIMITS: Readonly<
  Record<keyof StockWatchSettings, { min: number; max: number }>
> = {
  salesWindowDays: { min: 7, max: 365 },
  targetCoverDays: { min: 1, max: 365 },
  safetyDays: { min: 0, max: 180 },
  deadStockDays: { min: 7, max: 730 },
};

export type WatchLevel = {
  variantId: string;
  /** Formato activo de un perfume no archivado. */
  active: boolean;
  published: boolean;
  onHand: number;
  reserved: number;
  reorderPoint: number | null;
};

export type WatchFacts = {
  variantId: string;
  unitsSold: number;
  lastSaleAt: Date | null;
  firstStockedAt: Date | null;
  ledgerOnHand: number;
  ledgerReserved: number;
  leadTimeDays: number | null;
  packSize: number | null;
  incomingUnits: number;
  hasSupplier: boolean;
};

/**
 * Un formato se vigila como «a la venta» si está activo y, además, está
 * publicado o ya tuvo stock alguna vez. Así los borradores del catálogo que
 * nunca se compraron no llenan la lista de agotados.
 */
export function isWatched(level: WatchLevel, facts: WatchFacts | undefined) {
  return (
    level.active &&
    (level.published || level.onHand > 0 || facts?.firstStockedAt != null)
  );
}

export function buildStockSnapshots(
  levels: readonly WatchLevel[],
  facts: ReadonlyMap<string, WatchFacts>,
  locationId: string,
  salesWindowDays: number,
): StockSnapshot[] {
  return levels.map((level) => {
    const f = facts.get(level.variantId);
    return {
      variantId: level.variantId,
      locationId,
      onHand: level.onHand,
      reserved: level.reserved,
      minStock: level.reorderPoint,
      sellable: isWatched(level, f),
      unitsSold: f?.unitsSold ?? 0,
      salesWindowDays,
      leadTimeDays: f?.leadTimeDays ?? null,
      packSize: f?.packSize ?? null,
      incomingUnits: f?.incomingUnits ?? 0,
      lastSaleAt: f?.lastSaleAt ?? null,
      firstStockedAt: f?.firstStockedAt ?? null,
      // Las reservas llegan con el checkout (A5); hasta entonces no hay.
      expiredActiveReservations: 0,
      ledger: {
        onHand: f?.ledgerOnHand ?? 0,
        reserved: f?.ledgerReserved ?? 0,
      },
    };
  });
}

export type FindingSummary = {
  total: number;
  bySeverity: Record<FindingSeverity, number>;
  byKind: Partial<Record<FindingKind, number>>;
  /** Propuestas de reposición con cantidad. */
  reorderProposals: number;
};

/** Resumen para indicadores (inicio del panel, menú). */
export function summarizeFindings(
  findings: readonly StockFinding[],
): FindingSummary {
  const summary: FindingSummary = {
    total: findings.length,
    bySeverity: { critical: 0, warning: 0, info: 0 },
    byKind: {},
    reorderProposals: 0,
  };
  for (const finding of findings) {
    summary.bySeverity[finding.severity] += 1;
    summary.byKind[finding.kind] = (summary.byKind[finding.kind] ?? 0) + 1;
    if (finding.proposal?.kind === 'reorder') summary.reorderProposals += 1;
  }
  return summary;
}
