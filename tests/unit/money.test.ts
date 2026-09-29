import { describe, expect, it } from 'vitest';
import {
  divideHalfEven,
  grossToNet,
  netToGross,
  parseEuros,
  ratioBp,
} from '@/lib/money';

describe('dinero en céntimos', () => {
  it('redondea al par más cercano sin coma flotante', () => {
    expect(divideHalfEven(5, 2)).toBe(2);
    expect(divideHalfEven(7, 2)).toBe(4);
    expect(divideHalfEven(-5, 2)).toBe(-2);
    expect(divideHalfEven(-7, 2)).toBe(-4);
    expect(divideHalfEven(10, 3)).toBe(3);
    expect(divideHalfEven(11, 3)).toBe(4);
    expect(divideHalfEven(Number.MAX_SAFE_INTEGER, 1)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('rechaza divisores no positivos y decimales', () => {
    expect(() => divideHalfEven(1, 0)).toThrow(RangeError);
    expect(() => divideHalfEven(1.5, 2)).toThrow(RangeError);
  });

  it('convierte bruto y neto con IVA en puntos básicos', () => {
    expect(grossToNet(2995, 2100)).toBe(2475);
    expect(netToGross(2475, 2100)).toBe(2995);
    expect(grossToNet(121, 2100)).toBe(100);
    expect(grossToNet(0, 2100)).toBe(0);
  });

  it('calcula proporciones en puntos básicos', () => {
    expect(ratioBp(675, 2475)).toBe(2727);
    expect(ratioBp(-500, 2000)).toBe(-2500);
  });

  it.each([
    ['29,95', 2995],
    ['29.95', 2995],
    ['14,5€', 1450],
    ['17', 1700],
    [' 25 € ', 2500],
    ['0,05', 5],
  ])('interpreta %s como %i céntimos', (input, cents) => {
    expect(parseEuros(input)).toBe(cents);
  });

  it.each(['', 'abc', '1.234,56', '12,345', '-3', '25€/'])(
    'rechaza %s',
    (input) => {
      expect(parseEuros(input)).toBeNull();
    },
  );
});
