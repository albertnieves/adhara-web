import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/csv';

describe('toCsv', () => {
  it('usa «;», BOM y CRLF, y entrecomilla lo necesario', () => {
    expect(
      toCsv([
        ['a', 'b;c'],
        ['d "e"', null],
      ]),
    ).toBe('﻿a;"b;c"\r\n"d ""e""";\r\n');
  });

  it('neutraliza fórmulas en textos pero no en números', () => {
    expect(toCsv([['=HYPERLINK("x")', '-1', -1, '@SUM(A1)']])).toBe(
      `﻿"'=HYPERLINK(""x"")";'-1;-1;'@SUM(A1)\r\n`,
    );
  });
});
