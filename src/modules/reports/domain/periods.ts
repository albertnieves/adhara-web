/**
 * Periodos de los informes: meses y días de la tienda (Europe/Madrid). El
 * periodo es [from, to), con las medianoches locales en ISO UTC.
 */
import { madridMidnight } from '@/modules/inventory';

export type ReportPeriod = {
  from: string;
  to: string;
  /** Primer y último día incluidos (AAAA-MM-DD, días de la tienda). */
  firstDay: string;
  lastDay: string;
  /** Mes AAAA-MM si el periodo es un mes natural completo. */
  month: string | null;
  days: number;
};

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(day: string): boolean {
  return (
    DAY.test(day) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day)
  );
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(firstDay: string, nextDay: string): number {
  return Math.round(
    (Date.parse(`${nextDay}T00:00:00Z`) - Date.parse(`${firstDay}T00:00:00Z`)) /
      86_400_000,
  );
}

/** Día de la tienda (AAAA-MM-DD) de un instante. */
export function madridDay(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function monthPeriod(month: string): ReportPeriod | null {
  const match = MONTH.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const index = Number(match[2]);
  const firstDay = `${month}-01`;
  const next =
    index === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(index + 1).padStart(2, '0')}-01`;
  return {
    from: madridMidnight(firstDay),
    to: madridMidnight(next),
    firstDay,
    lastDay: addDays(next, -1),
    month,
    days: daysBetween(firstDay, next),
  };
}

/** Periodo de días [desde, hasta] incluidos; null si no es válido. */
export function dayRangePeriod(
  firstDay: string,
  lastDay: string,
): ReportPeriod | null {
  if (!isRealDay(firstDay) || !isRealDay(lastDay) || lastDay < firstDay) {
    return null;
  }
  const next = addDays(lastDay, 1);
  return {
    from: madridMidnight(firstDay),
    to: madridMidnight(next),
    firstDay,
    lastDay,
    month: null,
    days: daysBetween(firstDay, next),
  };
}

/** Los últimos `days` días hasta hoy incluido. */
export function lastDaysPeriod(days: number, now: Date): ReportPeriod {
  const today = madridDay(now);
  return dayRangePeriod(addDays(today, -(days - 1)), today)!;
}

export function currentMonth(now: Date): string {
  return madridDay(now).slice(0, 7);
}

/** Mes anterior y siguiente, para navegar entre cierres. */
export function shiftMonth(month: string, delta: number): string {
  const match = MONTH.exec(month);
  if (!match) return month;
  const total = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function monthLabel(month: string): string {
  const label = MONTH_NAMES.format(new Date(`${month}-15T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
