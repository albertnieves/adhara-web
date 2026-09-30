import type { PriceIssue } from './price-change';

/** Textos de los avisos de precio en el panel (español). */
export const PRICE_ISSUE_LABELS: Readonly<Record<PriceIssue['code'], string>> =
  {
    invalid_amount: 'El importe no es válido.',
    compare_at_not_higher:
      'El precio anterior debe ser mayor que el nuevo PVP.',
    omnibus_no_history:
      'No hay historial de 30 días: no se puede anunciar una rebaja todavía (Ómnibus).',
    omnibus_reference_exceeded:
      'El precio anterior supera el PVP más bajo de los últimos 30 días (Ómnibus).',
    below_cost: 'El PVP queda por debajo del coste.',
    below_min_margin: 'El margen queda por debajo del mínimo.',
    large_change: 'Es un cambio de precio grande (20 % o más).',
    margin_unknown: 'Sin coste registrado: el margen no se puede calcular.',
  };
