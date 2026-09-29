import type { BasisPoints, Cents } from '@/lib/money';
import { isNonNegativeCents, ratioBp } from '@/lib/money';
import type { Margin } from './margin';
import { computeMargin } from './margin';
import type { PricePeriod } from './omnibus';
import { lowestPriceInWindow } from './omnibus';

/** Umbrales del negocio; vivirán en la configuración de la tienda, no en código. */
export type PricingPolicy = {
  minMarginBp: BasisPoints;
  confirmChangeAboveBp: BasisPoints;
};

/**
 * error: bloquea el cambio. confirm: exige confirmación explícita de quien
 * lo aplica (queda en el registro). info: solo se muestra.
 */
export type PriceIssue =
  | { code: 'invalid_amount'; severity: 'error' }
  | { code: 'compare_at_not_higher'; severity: 'error' }
  | { code: 'omnibus_no_history'; severity: 'error' }
  | {
      code: 'omnibus_reference_exceeded';
      severity: 'error';
      referenceCents: Cents;
    }
  | { code: 'below_cost'; severity: 'confirm' }
  | { code: 'below_min_margin'; severity: 'confirm'; marginBp: BasisPoints }
  | { code: 'large_change'; severity: 'confirm'; changeBp: BasisPoints }
  | { code: 'margin_unknown'; severity: 'info' };

export type PriceIssueCode = PriceIssue['code'];

export type PriceChangeInput = {
  currentRetailGrossCents: Cents | null;
  proposedRetailGrossCents: Cents;
  /** Precio anterior tachado; solo al anunciar una rebaja. */
  proposedCompareAtGrossCents: Cents | null;
  vatBp: BasisPoints;
  costNetCents: Cents | null;
  history: readonly PricePeriod[];
  at: Date;
  policy: PricingPolicy;
};

export type PriceReview = { issues: PriceIssue[]; margin: Margin | null };

function isPositiveCents(value: number): boolean {
  return isNonNegativeCents(value) && value > 0;
}

export function reviewPriceChange(input: PriceChangeInput): PriceReview {
  const retail = input.proposedRetailGrossCents;
  const compareAt = input.proposedCompareAtGrossCents;
  if (
    !isPositiveCents(retail) ||
    (compareAt !== null && !isPositiveCents(compareAt)) ||
    !isNonNegativeCents(input.vatBp) ||
    (input.costNetCents !== null && !isNonNegativeCents(input.costNetCents))
  ) {
    return {
      issues: [{ code: 'invalid_amount', severity: 'error' }],
      margin: null,
    };
  }

  const issues: PriceIssue[] = [];
  if (compareAt !== null) {
    const reference = lowestPriceInWindow(input.history, input.at);
    if (compareAt <= retail) {
      issues.push({ code: 'compare_at_not_higher', severity: 'error' });
    } else if (reference === null) {
      issues.push({ code: 'omnibus_no_history', severity: 'error' });
    } else if (compareAt > reference) {
      issues.push({
        code: 'omnibus_reference_exceeded',
        severity: 'error',
        referenceCents: reference,
      });
    }
  }

  const margin = computeMargin({
    retailGrossCents: retail,
    vatBp: input.vatBp,
    costNetCents: input.costNetCents,
  });
  if (margin.kind === 'unknown') {
    issues.push({ code: 'margin_unknown', severity: 'info' });
  } else if (margin.marginCents < 0) {
    issues.push({ code: 'below_cost', severity: 'confirm' });
  } else if (
    margin.marginBp !== null &&
    margin.marginBp < input.policy.minMarginBp
  ) {
    issues.push({
      code: 'below_min_margin',
      severity: 'confirm',
      marginBp: margin.marginBp,
    });
  }

  const current = input.currentRetailGrossCents;
  if (current !== null && current > 0) {
    const changeBp = ratioBp(retail - current, current);
    if (Math.abs(changeBp) >= input.policy.confirmChangeAboveBp) {
      issues.push({ code: 'large_change', severity: 'confirm', changeBp });
    }
  }

  return { issues, margin };
}

export function hasBlockingIssues(review: PriceReview): boolean {
  return review.issues.some((issue) => issue.severity === 'error');
}

/** Confirmaciones que faltan; el servidor rechaza el cambio si no está vacía. */
export function missingConfirmations(
  review: PriceReview,
  confirmed: readonly PriceIssueCode[],
): PriceIssueCode[] {
  return review.issues
    .filter(
      (issue) =>
        issue.severity === 'confirm' && !confirmed.includes(issue.code),
    )
    .map((issue) => issue.code);
}
