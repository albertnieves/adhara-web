import type { MovementType } from './movements';

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
