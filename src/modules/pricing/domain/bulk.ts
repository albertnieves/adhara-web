import type { BasisPoints, Cents } from '@/lib/money';
import { parseEuros, ratioBp } from '@/lib/money';
import type { PriceAdjustment, PriceEnding } from './adjustment';
import { adjustRetailPrice } from './adjustment';
import type { PriceIssue, PriceReview, PricingPolicy } from './price-change';
import { reviewPriceChange } from './price-change';

/*
 * Cambio masivo de PVP: se calcula el nuevo PVP de cada formato con
 * adjustRetailPrice y se revisa con reviewPriceChange, igual que un cambio
 * individual. Los formatos en rebaja (con precio anterior) se excluyen: su
 * precio anterior está ligado a Ómnibus y se cambian desde su ficha.
 */

export const MAX_BULK_ROWS = 300;

export type BulkVariant = {
  variantId: string;
  productId: string;
  brandName: string;
  productName: string;
  variantLabel: string;
  retailCents: Cents | null;
  compareAtCents: Cents | null;
  /** Solo con permiso de costes; null si no hay coste o no se puede ver. */
  costNetCents: Cents | null;
};

export type BulkRow = BulkVariant & {
  proposedCents: Cents | null;
  changeBp: BasisPoints | null;
  /** Motivo por el que no se puede aplicar; null si se puede. */
  excluded: 'no_price' | 'on_sale' | 'invalid' | 'unchanged' | 'blocked' | null;
  review: PriceReview | null;
  /** Avisos que hay que confirmar en esta fila antes de aplicar. */
  confirm: PriceIssue['code'][];
};

/** «+5», «-10», «2,5» % → puntos básicos (entre -90 % y +300 %). */
export function parsePercent(value: string): BasisPoints | null {
  const match = /^([+-]?)(\d{1,3})(?:[.,](\d{1,2}))?\s*%?$/.exec(value.trim());
  if (!match) return null;
  const [, sign, whole = '0', decimals = ''] = match;
  const bp = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  const signed = sign === '-' ? -bp : bp;
  return signed >= -9000 && signed <= 30000 && signed !== 0 ? signed : null;
}

/** «+2», «-1,50» € → céntimos con signo (distinto de 0). */
export function parseSignedEuros(value: string): Cents | null {
  const text = value.replace(/\s|€/g, '');
  const sign = text.startsWith('-') ? -1 : 1;
  const cents = parseEuros(text.replace(/^[+-]/, ''));
  return cents === null || cents === 0 ? null : sign * cents;
}

export function planBulkPriceChange(
  variants: readonly BulkVariant[],
  adjustment: PriceAdjustment,
  ending: PriceEnding,
  options: { vatBp: BasisPoints; policy: PricingPolicy; at: Date },
): BulkRow[] {
  return variants.map((variant) => {
    const base = {
      ...variant,
      proposedCents: null,
      changeBp: null,
      review: null,
      confirm: [],
    };
    if (variant.retailCents === null) return { ...base, excluded: 'no_price' };
    if (variant.compareAtCents !== null) {
      return { ...base, excluded: 'on_sale' };
    }
    const proposed = adjustRetailPrice(variant.retailCents, adjustment, ending);
    if (proposed === null) return { ...base, excluded: 'invalid' };
    const changeBp = ratioBp(
      proposed - variant.retailCents,
      variant.retailCents,
    );
    if (proposed === variant.retailCents) {
      return {
        ...base,
        proposedCents: proposed,
        changeBp,
        excluded: 'unchanged',
      };
    }
    const review = reviewPriceChange({
      currentRetailGrossCents: variant.retailCents,
      proposedRetailGrossCents: proposed,
      proposedCompareAtGrossCents: null,
      vatBp: options.vatBp,
      costNetCents: variant.costNetCents,
      // Sin precio anterior no hace falta el historial (solo lo usa Ómnibus).
      history: [],
      at: options.at,
      policy: options.policy,
    });
    const blocked = review.issues.some((issue) => issue.severity === 'error');
    return {
      ...base,
      proposedCents: proposed,
      changeBp,
      review,
      excluded: blocked ? 'blocked' : null,
      confirm: review.issues
        .filter((issue) => issue.severity === 'confirm')
        .map((issue) => issue.code),
    };
  });
}
