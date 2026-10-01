import { describeDbError } from '@/modules/admin';
import { PURCHASING_ERRORS } from '../domain/labels';

type DbError = { message?: string; code?: string } | null | undefined;

/** Mensajes de compras y, si no es uno de ellos, los generales del panel. */
export function describePurchasingError(error: DbError): string {
  const known = error?.message ? PURCHASING_ERRORS[error.message] : undefined;
  if (known) return known;
  if (error?.code === '23505') return 'Ya existe un proveedor con ese nombre.';
  return describeDbError(error);
}
