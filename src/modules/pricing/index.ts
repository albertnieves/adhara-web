export { computeMargin } from './domain/margin';
export type { Margin } from './domain/margin';
export { OMNIBUS_WINDOW_DAYS, lowestPriceInWindow } from './domain/omnibus';
export type { PricePeriod } from './domain/omnibus';
export {
  hasBlockingIssues,
  missingConfirmations,
  reviewPriceChange,
} from './domain/price-change';
export type {
  PriceChangeInput,
  PriceIssue,
  PriceIssueCode,
  PriceReview,
  PricingPolicy,
} from './domain/price-change';
export { adjustRetailPrice } from './domain/adjustment';
export type { PriceAdjustment, PriceEnding } from './domain/adjustment';
export { PROVISIONAL_PRICING_POLICY, VAT_GENERAL_BP } from './domain/policy';
export { PRICE_ISSUE_LABELS } from './domain/labels';
export {
  MAX_BULK_ROWS,
  parsePercent,
  parseSignedEuros,
  planBulkPriceChange,
} from './domain/bulk';
export type { BulkRow, BulkVariant } from './domain/bulk';
