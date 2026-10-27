/*
 * Envíos multitransportista (DECISIONS §171–176): lo que se puede usar en el
 * navegador. Lo del servidor (claves de la plataforma, lecturas del panel y
 * acciones) está en server.ts.
 */
export {
  bracketFor,
  bracketsFromLimits,
  mergeBrackets,
} from './domain/brackets';
export type { RateEntry } from './domain/brackets';
export {
  FIRST_MILE_LABELS,
  HANDOVER_LABELS,
  PROVIDER_LABELS,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONES,
  SHIPPING_ERRORS,
  transitText,
  weightText,
} from './domain/labels';
export {
  PICKUP_API_CARRIERS,
  madridDate,
  madridInstant,
  nextWorkingDays,
} from './domain/pickup';
export {
  decimalToCents,
  gramsFrom,
  kilosText,
  optionCost,
  shippingPrice,
} from './domain/price';
export {
  EMPTY_SHIPPING_QUOTE,
  parseShippingQuote,
  zoneOptions,
} from './domain/quote';
export type {
  ShippingOption,
  ShippingQuote,
  ZoneOptions,
} from './domain/quote';
export {
  HANDED_OVER,
  SHIPMENT_STATUSES,
  isShipmentStatus,
  sendcloudStatus,
} from './domain/status';
export type { ShipmentStatus } from './domain/status';
export { parseParcelEvent } from './domain/webhook';
export type { ParcelEvent } from './domain/webhook';
