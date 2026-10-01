import type { MovementType } from './movements';
import type { FindingKind, FindingSeverity, StockFinding } from './stock-watch';

/** Nombres de los movimientos en el panel (español; el panel no se traduce). */
export const MOVEMENT_LABELS: Readonly<Record<MovementType, string>> = {
  PURCHASE_RECEIPT: 'Recepción de mercancía',
  SALE_STORE: 'Venta en tienda',
  SALE_ONLINE: 'Venta online',
  SALE_CLICK_COLLECT: 'Venta Click & Collect',
  RESERVATION: 'Reserva',
  RESERVATION_RELEASE: 'Liberación de reserva',
  RETURN: 'Devolución',
  RETURN_DAMAGED: 'Devolución dañada',
  STOCKTAKE_ADJUSTMENT: 'Ajuste por recuento',
  MANUAL_ADJUSTMENT: 'Ajuste manual',
  DAMAGE_LOSS: 'Merma o rotura',
  TRANSFER_OUT: 'Traslado (salida)',
  TRANSFER_IN: 'Traslado (entrada)',
  TESTER_ALLOCATION: 'Probador',
};

/** Hallazgos del vigilante de stock (Reposición). */
export const FINDING_LABELS: Readonly<Record<FindingKind, string>> = {
  inconsistent_level: 'El stock no cuadra con sus movimientos',
  out_of_stock: 'Agotado',
  below_min: 'Por debajo del punto de pedido',
  low_cover: 'No llega hasta la próxima entrega',
  stale_reservations: 'Reservas vencidas sin liberar',
  dead_stock: 'Sin ventas desde hace tiempo',
};

export const SEVERITY_LABELS: Readonly<Record<FindingSeverity, string>> = {
  critical: 'Urgente',
  warning: 'Aviso',
  info: 'Para revisar',
};

const units = (n: number) => `${n} ${n === 1 ? 'ud.' : 'uds.'}`;

/** Explicación de un hallazgo con los datos que lo justifican. */
export function describeFinding(finding: StockFinding): string {
  const f = finding.facts;
  const incoming = f.incomingUnits
    ? `; ${units(f.incomingUnits)} en camino`
    : '';
  switch (finding.kind) {
    case 'inconsistent_level':
      return f.ledgerOnHand != null
        ? `El nivel dice ${units(f.onHand ?? 0)} y los movimientos suman ${units(f.ledgerOnHand)}. Haz un recuento.`
        : `Nivel imposible: ${units(f.onHand ?? 0)} y ${units(f.reserved ?? 0)} reservadas.`;
    case 'out_of_stock':
      return `Sin unidades disponibles${incoming}.`;
    case 'below_min':
      return `Quedan ${units(f.available ?? 0)}; el aviso salta con ${units(f.minStock ?? 0)} o menos${incoming}.`;
    case 'low_cover':
      return `Quedan ${units(f.available ?? 0)}, unos ${f.coverDays ?? 0} días de venta; el proveedor tarda ${f.leadTimeDays ?? 0} días${incoming}.`;
    case 'stale_reservations':
      return `${f.expiredActiveReservations ?? 0} reservas vencidas siguen bloqueando stock.`;
    case 'dead_stock':
      return `${units(f.onHand ?? 0)} sin vender desde hace ${f.idleDays ?? 0} días.`;
  }
}
