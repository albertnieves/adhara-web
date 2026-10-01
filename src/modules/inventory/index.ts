export {
  MOVEMENT_EFFECTS,
  MOVEMENT_PERMISSIONS,
  MOVEMENT_TYPES,
  applyMovement,
  isSignedMovement,
  requiresReason,
  availableUnits,
  stocktakeMovement,
} from './domain/movements';
export type {
  MovementError,
  MovementInput,
  MovementResult,
  MovementType,
  StockLevel,
} from './domain/movements';
export { watchStock } from './domain/stock-watch';
export type {
  FindingKind,
  FindingSeverity,
  StockFinding,
  StockProposal,
  StockSnapshot,
  StockWatchPolicy,
} from './domain/stock-watch';
export { MOVEMENT_LABELS } from './domain/labels';
export { parseMovementFilter } from './domain/movement-filter';
export type { MovementSearch } from './domain/movement-filter';
export {
  FINDING_LABELS,
  SEVERITY_LABELS,
  describeFinding,
} from './domain/labels';
export {
  WATCH_SETTING_LIMITS,
  buildStockSnapshots,
  isWatched,
  summarizeFindings,
} from './domain/watch-snapshot';
export type {
  FindingSummary,
  StockWatchSettings,
  WatchFacts,
  WatchLevel,
} from './domain/watch-snapshot';
export {
  COUNTER_KINDS,
  COUNTER_KIND_LABELS,
  MAX_LINE_QUANTITY,
  MAX_TICKET_LINES,
  MAX_TICKET_REF,
  addToTicket,
  findByCode,
  linesWithoutStock,
  normalizeSearch,
  searchVariants,
  setLineQuantity,
  ticketUnits,
} from './domain/counter';
export type {
  CounterItem,
  CounterKind,
  SearchableVariant,
  TicketLine,
} from './domain/counter';
export { madridMidnight } from './domain/movement-filter';
