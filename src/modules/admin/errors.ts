/**
 * Traduce los errores de Postgres/PostgREST a mensajes para el personal.
 * Las funciones SQL lanzan códigos cortos (p. ej. «negative_on_hand»).
 */
const MESSAGES: Record<string, string> = {
  invalid_content: 'Revisa los textos, enlaces y procedencia de la imagen.',
  invalid_media: 'La imagen ya no pertenece a este perfume. Recarga la ficha.',
  invalid_previous_price:
    'El precio anterior no cumple el historial de precios. Vuelve a revisar.',
  last_admin: 'Debe quedar al menos un administrador del sistema activo.',
  edit_conflict:
    'Otra persona ha cambiado los datos. Recarga y vuelve a revisar.',
  review_expired: 'La revisión ha caducado. Vuelve a revisar.',
  invalid_review: 'La revisión no es válida para esta sesión.',
  confirmations_required: 'Faltan confirmaciones de la revisión.',
  rate_limited: 'Espera un minuto antes de volver a enviar.',
  forbidden: 'No tienes permiso para esta acción.',
  forbidden_publish: 'No tienes permiso para publicar o retirar perfumes.',
  forbidden_price_change:
    'Cambiar precios exige el permiso de precios y la verificación en dos pasos.',
  publish_requires_priced_variant:
    'Para publicar, el perfume necesita al menos un formato activo con PVP.',
  negative_on_hand: 'No hay unidades suficientes para este movimiento.',
  insufficient_available: 'Esas unidades están reservadas para pedidos.',
  insufficient_reserved: 'No hay tantas unidades reservadas.',
  invalid_quantity: 'La cantidad no es válida.',
  invalid_amount: 'El importe no es válido.',
  reason_required: 'Este movimiento necesita un motivo.',
  movement_not_manual:
    'Este tipo de movimiento lo genera el sistema de pedidos, no se registra a mano.',
  unknown_variant: 'El formato no existe.',
  unknown_location: 'La ubicación no existe o está inactiva.',
  unknown_user:
    'No hay ninguna cuenta con ese email. Créala antes en Supabase (Authentication → Users).',
  cannot_change_self: 'No puedes cambiar tu propio rol ni desactivarte.',
  invalid_role: 'Rol no válido.',
};

type DbError = { message?: string; code?: string } | null | undefined;

export function describeDbError(error: DbError): string {
  if (!error) return 'No se pudo completar la acción.';
  const known = error.message ? MESSAGES[error.message] : undefined;
  if (known) return known;
  switch (error.code) {
    case '23505':
      return 'Ya existe un registro con ese identificador (nombre web, SKU…).';
    case '23503':
      return 'No se puede borrar: tiene datos asociados (formatos, movimientos…).';
    case '23514':
      return 'Los datos no cumplen las reglas (por ejemplo, el precio anterior debe ser mayor que el PVP).';
    case '42501':
      return MESSAGES.forbidden!;
    default:
      console.error(
        '[admin] error de base de datos',
        error.code,
        error.message,
      );
      return 'No se pudo guardar. Inténtalo de nuevo.';
  }
}
