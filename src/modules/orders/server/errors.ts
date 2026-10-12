import { describeDbError } from '@/modules/admin';
import { ORDER_ERRORS } from '../domain/labels';

type DbError = { message?: string; code?: string } | null | undefined;

/** Mensajes de los pedidos web y, si no es uno de ellos, los del panel. */
export function describeOrderError(error: DbError): string {
  const known = error?.message ? ORDER_ERRORS[error.message] : undefined;
  return known ?? describeDbError(error);
}
