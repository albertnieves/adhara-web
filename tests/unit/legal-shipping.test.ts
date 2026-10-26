import { describe, expect, it } from 'vitest';
import { es } from '../../src/modules/legal/content/es';
import {
  freeShippingText,
  shippingCostText,
} from '../../src/modules/legal/domain/shipping';

/*
 * Gastos de envío de los textos legales con las tarifas del panel
 * (DECISIONS §168): lo mismo que cobra el checkout, en cada idioma, y sin
 * línea mientras no se ofrezca el envío.
 */

const nbsp = (text: string | null) => text?.replace(/ /g, ' ') ?? null;
const rates = [
  { zone: 'baleares', priceCents: 1000, freeFromCents: 12000 },
  { zone: 'peninsula', priceCents: 400, freeFromCents: 6000 },
] as const;

describe('gastos de envío en los textos legales', () => {
  it('las dos zonas, en orden y en los tres idiomas', () => {
    expect(nbsp(shippingCostText(rates, 'es'))).toBe(
      '4 € en la península y 10 € en las Illes Balears',
    );
    expect(nbsp(freeShippingText(rates, 'es'))).toBe(
      '60 € en la península y 120 € en las Illes Balears',
    );
    expect(nbsp(shippingCostText(rates, 'ca'))).toBe(
      '4 € a la península i 10 € a les Illes Balears',
    );
    expect(nbsp(shippingCostText(rates, 'en'))).toBe(
      '€4 to mainland Spain and €10 to the Balearic Islands',
    );
  });

  it('con céntimos y una sola zona', () => {
    expect(
      nbsp(
        shippingCostText(
          [{ zone: 'peninsula', priceCents: 495, freeFromCents: null }],
          'es',
        ),
      ),
    ).toBe('4,95 € en la península');
  });

  it('sin tarifas activas no hay línea; sin envío gratis, tampoco esa', () => {
    expect(shippingCostText([], 'es')).toBeNull();
    expect(freeShippingText([], 'es')).toBeNull();
    expect(
      freeShippingText(
        [{ zone: 'peninsula', priceCents: 400, freeFromCents: null }],
        'es',
      ),
    ).toBeNull();
    expect(
      nbsp(
        freeShippingText(
          [
            { zone: 'peninsula', priceCents: 400, freeFromCents: 6000 },
            { zone: 'baleares', priceCents: 1000, freeFromCents: null },
          ],
          'es',
        ),
      ),
    ).toBe('60 € en la península');
  });

  it('encaja en las frases de «Envíos y devoluciones»', () => {
    const lines = es.documents.shipping.sections
      .flatMap((section) => section.blocks)
      .flatMap((block) =>
        typeof block === 'object' && 'list' in block ? block.list : [],
      );
    expect(lines).toContain('Gastos de envío: {shippingCost}.');
    expect(lines).toContain('Envío gratis a partir de {freeShippingFrom}.');
  });
});
