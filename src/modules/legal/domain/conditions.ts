import type { TrackingVendor } from '@/modules/tracking';
import { activeCategories } from '@/modules/tracking';
import type { LegalBlock, LegalCondition, LegalRow } from './types';

/**
 * Condiciones que se cumplen con estos proveedores configurados: cada
 * proveedor, su tipo y `optional`, o `noOptional` si no hay ninguno.
 */
export function legalConditions(
  vendors: readonly TrackingVendor[],
): ReadonlySet<LegalCondition> {
  const set = new Set<LegalCondition>(vendors);
  for (const category of activeCategories(vendors)) set.add(category);
  set.add(vendors.length > 0 ? 'optional' : 'noOptional');
  return set;
}

/**
 * Fecha de los textos de analítica y publicidad. La política de cookies y la
 * de privacidad la muestran si es posterior a `LEGAL_UPDATED_AT` y hay
 * cookies opcionales: al encenderlas, la fecha cambia sola.
 */
export const TRACKING_TEXTS_UPDATED_AT = '2026-10-29';

/** Fecha de la versión que se publica de un texto con esa configuración. */
export function legalUpdatedAt(
  base: string,
  doc: string,
  conditions: ReadonlySet<LegalCondition>,
): string {
  const tracking =
    conditions.has('optional') && (doc === 'cookies' || doc === 'privacy');
  return tracking && TRACKING_TEXTS_UPDATED_AT > base
    ? TRACKING_TEXTS_UPDATED_AT
    : base;
}

/** Las celdas de una fila y su condición, si la tiene. */
export function rowParts(row: LegalRow): {
  cells: string[];
  when: LegalCondition | null;
} {
  return Array.isArray(row)
    ? { cells: row, when: null }
    : { cells: row.cells, when: row.when };
}

/** Los bloques que se publican con esa configuración (sin grupos ni filas que no tocan). */
export function activeBlocks(
  blocks: readonly LegalBlock[],
  conditions: ReadonlySet<LegalCondition>,
): LegalBlock[] {
  return blocks.flatMap((block): LegalBlock[] => {
    if (typeof block === 'string') return [block];
    if ('when' in block)
      return conditions.has(block.when)
        ? activeBlocks(block.blocks, conditions)
        : [];
    if ('table' in block)
      return [
        {
          table: {
            ...block.table,
            rows: block.table.rows.filter((row) => {
              const { when } = rowParts(row);
              return when === null || conditions.has(when);
            }),
          },
        },
      ];
    return [block];
  });
}
