/**
 * Vigilante de stock: núcleo determinista del agente de inventario
 * (docs/ADMIN_PLAN.md, fase A4). Recibe una foto del inventario y devuelve
 * hallazgos con los datos que los justifican. Las propuestas nunca se
 * ejecutan aquí: pasan a una cola que aprueba una persona con permiso.
 */
import type { StockLevel } from './movements';
import { availableUnits } from './movements';

/** Parámetros del negocio; se guardarán en la configuración, sin valores por defecto ocultos. */
export type StockWatchPolicy = {
  /** Días de venta que debe cubrir una reposición, además del plazo. */
  targetCoverDays: number;
  /** Colchón sobre el plazo de entrega del proveedor. */
  safetyDays: number;
  /** Días sin ventas, con existencias, para considerar stock inmovilizado. */
  deadStockDays: number;
};

export type StockSnapshot = {
  variantId: string;
  locationId: string;
  onHand: number;
  reserved: number;
  minStock: number | null;
  /** Variante activa y a la venta. */
  sellable: boolean;
  /** Unidades vendidas por cualquier canal en la ventana de análisis. */
  unitsSold: number;
  salesWindowDays: number;
  leadTimeDays: number | null;
  /** Múltiplo de compra del proveedor. */
  packSize: number | null;
  /** Unidades pendientes de recibir en órdenes de compra abiertas. */
  incomingUnits: number;
  lastSaleAt: Date | null;
  firstStockedAt: Date | null;
  /** Reservas activas cuyo plazo ya venció (el barrido no las liberó). */
  expiredActiveReservations: number;
  /**
   * Suma de los movimientos de la ubicación. Si se indica y no coincide con
   * el nivel, el nivel no es fiable (alguien lo cambió sin movimiento).
   */
  ledger?: StockLevel | null;
};

export type FindingKind =
  | 'inconsistent_level'
  | 'out_of_stock'
  | 'below_min'
  | 'low_cover'
  | 'stale_reservations'
  | 'dead_stock';

export type FindingSeverity = 'critical' | 'warning' | 'info';

export type StockProposal =
  | { kind: 'reorder'; quantity: number }
  | { kind: 'release_expired_reservations'; count: number };

export type StockFinding = {
  kind: FindingKind;
  severity: FindingSeverity;
  variantId: string;
  locationId: string;
  facts: Readonly<Record<string, number | null>>;
  proposal: StockProposal | null;
};

const DAY_MS = 86_400_000;
const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function roundUpToPack(quantity: number, packSize: number | null): number {
  if (!packSize || packSize <= 1) return quantity;
  return Math.ceil(quantity / packSize) * packSize;
}

function reorderProposal(
  snapshot: StockSnapshot,
  policy: StockWatchPolicy,
  velocity: number,
): StockProposal | null {
  const min = snapshot.minStock ?? 0;
  const lead = snapshot.leadTimeDays;
  const reorderPoint =
    lead === null
      ? min
      : Math.max(min, Math.ceil(velocity * (lead + policy.safetyDays)));
  const orderUpTo =
    lead === null
      ? min
      : Math.max(
          reorderPoint,
          Math.ceil(
            velocity * (lead + policy.safetyDays + policy.targetCoverDays),
          ),
        );
  const position = availableUnits(snapshot) + snapshot.incomingUnits;
  if (position > reorderPoint || orderUpTo <= position) return null;
  return {
    kind: 'reorder',
    quantity: roundUpToPack(orderUpTo - position, snapshot.packSize),
  };
}

function classifyLevel(
  snapshot: StockSnapshot,
  policy: StockWatchPolicy,
  available: number,
  velocity: number,
): Pick<StockFinding, 'kind' | 'severity' | 'facts'> | null {
  if (available <= 0) {
    return { kind: 'out_of_stock', severity: 'critical', facts: {} };
  }
  if (snapshot.minStock !== null && available <= snapshot.minStock) {
    return { kind: 'below_min', severity: 'warning', facts: {} };
  }
  const lead = snapshot.leadTimeDays;
  if (lead !== null && velocity > 0) {
    const coverDays = available / velocity;
    if (coverDays < lead + policy.safetyDays) {
      return {
        kind: 'low_cover',
        severity: 'warning',
        facts: { coverDays: Math.floor(coverDays) },
      };
    }
  }
  return null;
}

function inspect(
  snapshot: StockSnapshot,
  policy: StockWatchPolicy,
  now: Date,
): StockFinding[] {
  const base = {
    variantId: snapshot.variantId,
    locationId: snapshot.locationId,
  };
  const available = availableUnits(snapshot);
  const ledger = snapshot.ledger;
  const offLedger =
    ledger != null &&
    (ledger.onHand !== snapshot.onHand ||
      ledger.reserved !== snapshot.reserved);
  if (
    snapshot.onHand < 0 ||
    snapshot.reserved < 0 ||
    available < 0 ||
    offLedger
  ) {
    return [
      {
        ...base,
        kind: 'inconsistent_level',
        severity: 'critical',
        facts: {
          onHand: snapshot.onHand,
          reserved: snapshot.reserved,
          ...(ledger
            ? { ledgerOnHand: ledger.onHand, ledgerReserved: ledger.reserved }
            : {}),
        },
        proposal: null,
      },
    ];
  }

  const findings: StockFinding[] = [];
  const velocity =
    snapshot.salesWindowDays > 0
      ? snapshot.unitsSold / snapshot.salesWindowDays
      : 0;
  const facts = {
    available,
    incomingUnits: snapshot.incomingUnits,
    minStock: snapshot.minStock,
    unitsSold: snapshot.unitsSold,
    salesWindowDays: snapshot.salesWindowDays,
    leadTimeDays: snapshot.leadTimeDays,
  };
  const levelFinding = snapshot.sellable
    ? classifyLevel(snapshot, policy, available, velocity)
    : null;
  if (levelFinding) {
    findings.push({
      ...base,
      ...levelFinding,
      facts: { ...facts, ...levelFinding.facts },
      proposal: reorderProposal(snapshot, policy, velocity),
    });
  }

  if (snapshot.expiredActiveReservations > 0) {
    findings.push({
      ...base,
      kind: 'stale_reservations',
      severity: 'warning',
      facts: { expiredActiveReservations: snapshot.expiredActiveReservations },
      proposal: {
        kind: 'release_expired_reservations',
        count: snapshot.expiredActiveReservations,
      },
    });
  }

  const since = snapshot.lastSaleAt ?? snapshot.firstStockedAt;
  if (snapshot.onHand > 0 && since !== null) {
    const idleDays = Math.floor((now.getTime() - since.getTime()) / DAY_MS);
    if (idleDays >= policy.deadStockDays) {
      findings.push({
        ...base,
        kind: 'dead_stock',
        severity: 'info',
        facts: { onHand: snapshot.onHand, idleDays },
        proposal: null,
      });
    }
  }
  return findings;
}

export function watchStock(
  snapshots: readonly StockSnapshot[],
  policy: StockWatchPolicy,
  now: Date,
): StockFinding[] {
  return snapshots
    .flatMap((snapshot) => inspect(snapshot, policy, now))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
