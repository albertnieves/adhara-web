import type { PurchaseOrderAction, PurchaseOrderStatus } from './orders';

/** Textos del panel (español; el panel no se traduce). */
export const ORDER_STATUS_LABELS: Readonly<
  Record<PurchaseOrderStatus, string>
> = {
  draft: 'Borrador',
  ordered: 'Pedido',
  partially_received: 'Recibido en parte',
  received: 'Recibido',
  closed: 'Cerrado con faltas',
  cancelled: 'Cancelado',
};

export const ORDER_ACTION_LABELS: Readonly<
  Record<PurchaseOrderAction, string>
> = {
  order: 'Marcar como pedido',
  cancel: 'Cancelar pedido',
  close: 'Cerrar con faltas',
};

/** Errores de las funciones SQL de compras y mostrador. */
export const PURCHASING_ERRORS: Readonly<Record<string, string>> = {
  stale_revision:
    'Otra persona ha cambiado este pedido mientras lo mirabas. Recarga la página para ver la versión actual.',
  invalid_status: 'El pedido ya no está en un estado que permita esta acción.',
  over_receipt: 'No se puede recibir más de lo pedido.',
  empty_order: 'El pedido no tiene líneas.',
  unknown_order: 'El pedido no existe.',
  unknown_line: 'Alguna línea no pertenece a este pedido.',
  unknown_supplier: 'El proveedor no existe o está inactivo.',
  invalid_items: 'Revisa las líneas: hay datos repetidos o incompletos.',
  insufficient_stock: 'No hay unidades disponibles suficientes.',
};
