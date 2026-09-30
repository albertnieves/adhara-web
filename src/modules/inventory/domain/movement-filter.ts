import type { MovementType } from './movements';
import { MOVEMENT_TYPES } from './movements';

/*
 * Filtros del historial de movimientos (?perfume=&tipo=&desde=&hasta=),
 * compartidos por la página y la exportación CSV. Las fechas son días de la
 * tienda (Europe/Madrid); «hasta» incluye el día entero.
 */

export type MovementSearch = {
  perfume?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
};

export type ParsedMovementFilter = {
  productId?: string;
  type?: MovementType;
  from?: string;
  to?: string;
  /** Parámetros válidos, para enlaces (exportar, quitar filtros). */
  search: URLSearchParams;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Medianoche de Madrid de un día AAAA-MM-DD, en ISO UTC. */
export function madridMidnight(day: string): string {
  // El desfase a las 00:00 UTC coincide con el de la medianoche local también
  // los días de cambio de hora (el cambio es a las 01:00 UTC).
  const probe = new Date(`${day}T00:00:00Z`);
  const name =
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(probe)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+1';
  const hours = Number(/GMT([+-]\d+)/.exec(name)?.[1] ?? 1);
  return new Date(probe.getTime() - hours * 3_600_000).toISOString();
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function isRealDay(day: string): boolean {
  return (
    DAY.test(day) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day)
  );
}

export function parseMovementFilter(
  params: MovementSearch,
): ParsedMovementFilter {
  const search = new URLSearchParams();
  const result: ParsedMovementFilter = { search };
  if (params.perfume && UUID.test(params.perfume)) {
    result.productId = params.perfume;
    search.set('perfume', params.perfume);
  }
  if (
    params.tipo &&
    (MOVEMENT_TYPES as readonly string[]).includes(params.tipo)
  ) {
    result.type = params.tipo as MovementType;
    search.set('tipo', params.tipo);
  }
  if (params.desde && isRealDay(params.desde)) {
    result.from = madridMidnight(params.desde);
    search.set('desde', params.desde);
  }
  if (params.hasta && isRealDay(params.hasta)) {
    result.to = madridMidnight(nextDay(params.hasta));
    search.set('hasta', params.hasta);
  }
  return result;
}
