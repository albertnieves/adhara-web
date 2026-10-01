/**
 * Cumplimiento de los proveedores: el plazo real (de pedido a primera
 * recepción) frente al declarado, que es el que usa el vigilante de
 * Reposición para proponer cantidades.
 */

export type LeadTimeCheck =
  | { kind: 'no_data' }
  | { kind: 'no_declared'; realDays: number }
  | {
      kind: 'ok' | 'slower' | 'faster';
      realDays: number;
      declaredDays: number;
    };

/** Margen de tolerancia antes de sugerir cambiar el plazo declarado. */
export const LEAD_TIME_TOLERANCE_DAYS = 1;

export function checkLeadTime(
  declaredDays: number | null,
  averageRealDays: number | null,
): LeadTimeCheck {
  if (averageRealDays === null) return { kind: 'no_data' };
  const realDays = Math.round(averageRealDays * 10) / 10;
  if (declaredDays === null) return { kind: 'no_declared', realDays };
  const gap = realDays - declaredDays;
  return {
    kind:
      gap > LEAD_TIME_TOLERANCE_DAYS
        ? 'slower'
        : gap < -LEAD_TIME_TOLERANCE_DAYS
          ? 'faster'
          : 'ok',
    realDays,
    declaredDays,
  };
}
