/*
 * Recogidas en la tienda (DECISIONS §174). La plataforma solo admite pedirlas
 * por API con algunos transportistas (en España, Correos, Correos Express, DHL
 * Parcel Iberia, UPS y FedEx; no SEUR ni GLS). Con los demás, el panel enseña
 * el teléfono de recogidas del servicio y se apunta la recogida a mano.
 */

const TIME_ZONE = 'Europe/Madrid';

/**
 * Códigos de transportista de la plataforma con recogida por API, según su
 * documentación. Solo orienta al personal: la petición se intenta igual y,
 * si la plataforma la rechaza, queda el teléfono.
 */
export const PICKUP_API_CARRIERS: ReadonlySet<string> = new Set([
  'correos',
  'correos_express',
  'dhl_parcel_iberia',
  'ups',
  'fedex',
  'brt',
  'dhl',
  'dhl_express',
  'dhl_de',
  'dpd',
  'dpd_at',
  'gls_it',
  'poste_italiane',
]);

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function madridOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return Math.round((asUtc - utcMs) / 60000);
}

/** «2026-10-27» y «10:00» en Madrid → instante ISO en UTC, o null. */
export function madridInstant(date: string, time: string): string | null {
  const d = DATE.exec(date);
  const t = TIME.exec(time.slice(0, 5));
  if (!d || !t) return null;
  const local = Date.UTC(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2]),
  );
  // Sin desbordes: el 13 de un mes o el 31 de febrero no existen.
  const check = new Date(local);
  if (
    Number.isNaN(local) ||
    check.getUTCFullYear() !== Number(d[1]) ||
    check.getUTCMonth() !== Number(d[2]) - 1 ||
    check.getUTCDate() !== Number(d[3])
  )
    return null;
  // Dos pasadas: la segunda corrige el cambio de hora entre medias.
  let utc = local - madridOffsetMinutes(local) * 60000;
  utc = local - madridOffsetMinutes(utc) * 60000;
  return new Date(utc).toISOString();
}

/** Fecha de Madrid («2026-10-27») de un instante. */
export function madridDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * Los próximos días laborables (lunes a viernes) desde mañana, en Madrid.
 * No conoce los festivos: el transportista los rechaza si no recoge.
 */
export function nextWorkingDays(now: Date, count: number): string[] {
  const days: string[] = [];
  const today = madridDate(now);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  for (let offset = 1; days.length < count && offset < 30; offset += 1) {
    const day = new Date(Date.UTC(y, m - 1, d + offset, 12));
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6)
      days.push(day.toISOString().slice(0, 10));
  }
  return days;
}
