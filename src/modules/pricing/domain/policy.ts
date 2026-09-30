import type { PricingPolicy } from './price-change';

/**
 * Umbrales PROVISIONALES hasta que el negocio los fije (docs/ADMIN_PLAN.md,
 * A2 «Necesito»): sin costes registrados el margen es desconocido, y un cambio
 * de PVP de un 20 % o más pide confirmación explícita.
 */
export const PROVISIONAL_PRICING_POLICY: PricingPolicy = {
  minMarginBp: 0,
  confirmChangeAboveBp: 2000,
};

/** IVA general en España (21 %), pendiente de confirmar con la asesoría fiscal. */
export const VAT_GENERAL_BP = 2100;
