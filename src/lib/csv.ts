/**
 * CSV para abrir en Excel en español: separador «;», BOM UTF-8 y CRLF.
 * Los textos que empiezan por = + - @ se prefijan con «'» para que Excel no
 * los ejecute como fórmula (inyección CSV); los números van tal cual.
 */
export type CsvCell = string | number | null;

function cell(value: CsvCell): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: CsvCell[][]): string {
  return `﻿${rows.map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`;
}
