/**
 * Meses y días del calendario de Madrid como texto ISO («2026-10» y
 * «2026-10-10»), sin objetos Date que cambien con la zona del servidor.
 */

export type MonthKey = string;
export type IsoDate = string;

const MONTH = /^(\d{4})-(\d{2})$/;

/** Día de hoy en Madrid («YYYY-MM-DD»). */
export function madridToday(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function monthOf(date: IsoDate): MonthKey {
  return date.slice(0, 7);
}

export function isMonthKey(value: unknown): value is MonthKey {
  if (typeof value !== 'string') return false;
  const match = MONTH.exec(value);
  return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12);
}

export function addMonths(month: MonthKey, count: number): MonthKey {
  const match = MONTH.exec(month);
  if (!match) throw new RangeError(`Mes no válido: ${month}`);
  const index = Number(match[1]) * 12 + Number(match[2]) - 1 + count;
  const year = Math.floor(index / 12);
  return `${year}-${String(index - year * 12 + 1).padStart(2, '0')}`;
}

/** Los `count` meses que terminan en `last`, del más antiguo al más reciente. */
export function monthsEndingAt(last: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) =>
    addMonths(last, i - count + 1),
  );
}

/** Primer día del mes, como espera la base de datos. */
export function monthStart(month: MonthKey): IsoDate {
  return `${month}-01`;
}

const LABEL = new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const LONG_LABEL = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const SHORT = new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  timeZone: 'UTC',
});

function utc(month: MonthKey) {
  return new Date(`${month}-01T12:00:00Z`);
}

/** «oct 2026». */
export function monthLabel(month: MonthKey): string {
  return LABEL.format(utc(month)).replace('.', '');
}

/** «octubre de 2026». */
export function monthLongLabel(month: MonthKey): string {
  return LONG_LABEL.format(utc(month));
}

/** «oct», para los ejes de los gráficos. */
export function monthShortLabel(month: MonthKey): string {
  return SHORT.format(utc(month)).replace('.', '');
}

const DAY = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** «10 oct 2026». */
export function dayLabel(date: IsoDate): string {
  return DAY.format(new Date(`${date}T12:00:00Z`)).replace('.', '');
}

/** Días de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}
