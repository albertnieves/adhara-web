export {
  currentMonth,
  dayRangePeriod,
  lastDaysPeriod,
  madridDay,
  monthLabel,
  monthPeriod,
  shiftMonth,
} from './domain/periods';
export type { ReportPeriod } from './domain/periods';
export {
  BUCKET_LABELS,
  MOVEMENT_REPORT_BUCKET,
  REPORT_BUCKETS,
  addValuation,
  balances,
  emptyTotals,
  expectedClosing,
  hasActivity,
  rotation,
  summarize,
  valueAtCost,
} from './domain/inventory-report';
export type {
  GroupSummary,
  PeriodCost,
  PeriodRow,
  PeriodUnits,
  ReportBucket,
  Rotation,
  ValuationTotals,
} from './domain/inventory-report';
export { isBelowMin, marginRows, marginsByBrand } from './domain/margins';
export type { BrandMargin, MarginInput, MarginRow } from './domain/margins';
export { LEAD_TIME_TOLERANCE_DAYS, checkLeadTime } from './domain/purchases';
export type { LeadTimeCheck } from './domain/purchases';
export { closingCsvRows, eurosCell } from './domain/closing-csv';
export type { ClosingRow } from './domain/closing-csv';
export {
  AUDIT_AREAS,
  auditArea,
  auditChanges,
  isAuditArea,
} from './domain/audit';
export type { AuditArea } from './domain/audit';
