import type { BasisPoints, Cents } from '@/lib/money';

/** Importes y porcentajes del control, siempre con dos decimales y en es-ES. */

const EUROS = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERCENT = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 123456 → «1234,56 €»; negativos con signo menos. */
export function euros(cents: Cents): string {
  return EUROS.format(cents / 100).replace('-', '−');
}

/** Con signo explícito: «+12,00 €» o «−3,50 €». */
export function signedEuros(cents: Cents): string {
  return cents > 0 ? `+${euros(cents)}` : euros(cents);
}

export function percent(bp: BasisPoints | null): string {
  return bp === null ? '—' : PERCENT.format(bp / 10_000).replace('-', '−');
}

/** Variación: «+12,5 %», «−3,0 %» o «—» sin base. */
export function signedPercent(bp: BasisPoints | null): string {
  if (bp === null) return '—';
  return bp > 0 ? `+${percent(bp)}` : percent(bp);
}
