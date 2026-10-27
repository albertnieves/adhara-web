/*
 * Tramos de peso de un servicio (DECISIONS §172). La plataforma cotiza un peso
 * cada vez y responde con el tramo que lo contiene; la sincronización recorre
 * los tramos de varios códigos postales de referencia de cada zona y los junta
 * aquí. Gramos enteros, ambos extremos incluidos.
 */

export type RateEntry = {
  minWeightG: number;
  maxWeightG: number;
  /** Coste del transportista sin IVA. */
  costCents: number;
  leadTimeHours: number | null;
};

function covering(entries: readonly RateEntry[], grams: number) {
  return entries.filter((e) => e.minWeightG <= grams && grams <= e.maxWeightG);
}

/**
 * Tramos de una zona a partir de lo que cotizó cada referencia (sources). Un
 * peso solo entra si todas las referencias lo cotizan, con el coste más alto y
 * el plazo más largo: el precio no se queda corto en ninguna parte de la zona
 * (Eivissa y Menorca pueden costar más que Palma). Nada por encima de
 * maxWeightG. Los tramos contiguos iguales se juntan.
 */
export function mergeBrackets(
  sources: readonly (readonly RateEntry[])[],
  maxWeightG: number,
): RateEntry[] {
  if (sources.length === 0 || sources.some((s) => s.length === 0)) return [];
  const bounds = new Set<number>();
  for (const source of sources)
    for (const entry of source) {
      bounds.add(entry.minWeightG);
      bounds.add(entry.maxWeightG + 1);
    }
  const points = [...bounds].sort((a, b) => a - b);
  const merged: RateEntry[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const min = points[i]!;
    const max = Math.min(points[i + 1]! - 1, maxWeightG);
    if (min > maxWeightG || max < min) break;
    const hits = sources.map((source) => covering(source, min));
    if (hits.some((hit) => hit.length === 0)) continue;
    const all = hits.flat();
    const cost = Math.max(...all.map((e) => e.costCents));
    const leads = all.flatMap((e) =>
      e.leadTimeHours === null ? [] : [e.leadTimeHours],
    );
    const lead = leads.length > 0 ? Math.max(...leads) : null;
    const last = merged.at(-1);
    if (
      last &&
      last.maxWeightG + 1 === min &&
      last.costCents === cost &&
      last.leadTimeHours === lead
    ) {
      last.maxWeightG = max;
    } else {
      merged.push({
        minWeightG: min,
        maxWeightG: max,
        costCents: cost,
        leadTimeHours: lead,
      });
    }
  }
  return merged;
}

/** Tramo que contiene un peso, si hay. */
export function bracketFor<
  T extends { minWeightG: number; maxWeightG: number },
>(rates: readonly T[], grams: number): T | undefined {
  return rates.find((r) => r.minWeightG <= grams && grams <= r.maxWeightG);
}

/**
 * Tramos escritos a mano («hasta» en gramos y su coste), en orden: cada uno
 * empieza donde acaba el anterior. Devuelve el motivo si no valen.
 */
export function bracketsFromLimits(
  rows: readonly { upToG: number; costCents: number }[],
): { ok: true; rates: RateEntry[] } | { ok: false; reason: string } {
  const rates: RateEntry[] = [];
  let min = 1;
  for (const [index, row] of rows.entries()) {
    if (!Number.isSafeInteger(row.upToG) || row.upToG < min)
      return {
        ok: false,
        reason: `El tramo ${index + 1} tiene que llegar a más peso que el anterior.`,
      };
    if (row.upToG > 100000)
      return { ok: false, reason: 'Ningún tramo pasa de 100 kg.' };
    if (!Number.isSafeInteger(row.costCents) || row.costCents < 0)
      return {
        ok: false,
        reason: `El coste del tramo ${index + 1} no es válido.`,
      };
    rates.push({
      minWeightG: min,
      maxWeightG: row.upToG,
      costCents: row.costCents,
      leadTimeHours: null,
    });
    min = row.upToG + 1;
  }
  return { ok: true, rates };
}
