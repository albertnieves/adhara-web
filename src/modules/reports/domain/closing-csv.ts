/**
 * CSV del cierre de existencias para la gestoría (Excel en español; el
 * formato lo pone src/lib/csv.ts). Los importes van en euros con coma
 * decimal y sin IVA; sin permiso de costes, solo unidades.
 */
import type { CsvCell } from '@/lib/csv';
import type { PeriodCost, PeriodRow } from './inventory-report';
import { addValuation, emptyTotals, valueAtCost } from './inventory-report';

export type ClosingRow = PeriodRow & {
  brandName: string;
  productName: string;
  variantLabel: string;
  sku: string | null;
};

export function eurosCell(cents: number | null): CsvCell {
  if (cents === null) return null;
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

function costNote(opening: PeriodCost, closing: PeriodCost): string | null {
  if (!opening && !closing) return 'Sin coste registrado';
  if (opening?.isLater || closing?.isLater) {
    return 'Coste registrado después de la fecha';
  }
  return null;
}

export function closingCsvRows(
  rows: readonly ClosingRow[],
  withCosts: boolean,
): CsvCell[][] {
  const header: CsvCell[] = [
    'Marca',
    'Perfume',
    'Formato',
    'SKU',
    'Existencias iniciales',
    'Entradas',
    'Ventas',
    'Devoluciones',
    'Mermas y probadores',
    'Ajustes',
    'Traslados',
    'Existencias finales',
  ];
  if (withCosts) {
    header.push(
      'Coste unitario inicial (€ sin IVA)',
      'Valor inicial (€ sin IVA)',
      'Coste unitario final (€ sin IVA)',
      'Valor final (€ sin IVA)',
      'Nota',
    );
  }
  const sorted = [...rows].sort(
    (a, b) =>
      a.brandName.localeCompare(b.brandName, 'es') ||
      a.productName.localeCompare(b.productName, 'es') ||
      a.variantLabel.localeCompare(b.variantLabel, 'es'),
  );
  let opening = emptyTotals();
  let closing = emptyTotals();
  const sums = new Array<number>(8).fill(0);
  const body = sorted.map((row) => {
    const units = [
      row.openingUnits,
      row.receivedUnits,
      row.soldUnits,
      row.returnedUnits,
      row.lostUnits,
      row.adjustedUnits,
      row.transferredUnits,
      row.closingUnits,
    ];
    units.forEach((value, index) => (sums[index]! += value));
    opening = addValuation(opening, row.openingUnits, row.openingCost);
    closing = addValuation(closing, row.closingUnits, row.closingCost);
    const line: CsvCell[] = [
      row.brandName,
      row.productName,
      row.variantLabel,
      row.sku,
      ...units,
    ];
    if (withCosts) {
      line.push(
        eurosCell(row.openingCost?.costNetCents ?? null),
        eurosCell(valueAtCost(row.openingUnits, row.openingCost)),
        eurosCell(row.closingCost?.costNetCents ?? null),
        eurosCell(valueAtCost(row.closingUnits, row.closingCost)),
        costNote(row.openingCost, row.closingCost),
      );
    }
    return line;
  });
  const total: CsvCell[] = ['TOTAL', null, null, null, ...sums];
  if (withCosts) {
    total.push(
      null,
      eurosCell(opening.valueCents),
      null,
      eurosCell(closing.valueCents),
      closing.unitsWithoutCost || opening.unitsWithoutCost
        ? `Sin coste: ${opening.unitsWithoutCost} uds. iniciales y ${closing.unitsWithoutCost} finales no suman`
        : null,
    );
  }
  return [header, ...body, total];
}
