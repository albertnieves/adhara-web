import { describe, expect, it } from 'vitest';
import { es } from '../../src/modules/legal/content/es';
import {
  freeShippingText,
  shippingCostText,
} from '../../src/modules/legal/domain/shipping';

/*
 * Gastos de envío de los textos legales con las zonas del panel (DECISIONS
 * §168, §172): el precio depende del peso y del transportista, en cada
 * idioma, y sin línea mientras no se ofrezca el envío.
 */

const nbsp = (text: string | null) => text?.replace(/\u00a0/g, ' ') ?? null;
const zones = [
  { zone: 'baleares', freeFromCents: 12000 },
  { zone: 'peninsula', freeFromCents: 6000 },
] as const;

describe('gastos de envío en los textos legales', () => {
  it('las dos zonas, en orden y en los tres idiomas', () => {
    expect(shippingCostText(zones, 'es')).toBe(
      'según el peso del pedido y el transportista que elijas, en la península y en las Illes Balears; el importe se muestra antes de pagar',
    );
    expect(nbsp(freeShippingText(zones, 'es'))).toBe(
      '60 € en la península y 120 € en las Illes Balears, con las opciones de envío que lo indican al pagar',
    );
    expect(shippingCostText(zones, 'ca')).toBe(
      'segons el pes de la comanda i el transportista que triïs, a la península i a les Illes Balears; l’import es mostra abans de pagar',
    );
    expect(shippingCostText(zones, 'en')).toBe(
      'based on the weight of your order and the carrier you choose, to mainland Spain and to the Balearic Islands; the amount is shown before you pay',
    );
  });

  it('una sola zona', () => {
    expect(
      shippingCostText([{ zone: 'peninsula', freeFromCents: null }], 'es'),
    ).toBe(
      'según el peso del pedido y el transportista que elijas, en la península; el importe se muestra antes de pagar',
    );
  });

  it('sin zonas activas no hay línea; sin envío gratis, tampoco esa', () => {
    expect(shippingCostText([], 'es')).toBeNull();
    expect(freeShippingText([], 'es')).toBeNull();
    expect(
      freeShippingText([{ zone: 'peninsula', freeFromCents: null }], 'es'),
    ).toBeNull();
    expect(
      nbsp(
        freeShippingText(
          [
            { zone: 'peninsula', freeFromCents: 6000 },
            { zone: 'baleares', freeFromCents: null },
          ],
          'es',
        ),
      ),
    ).toBe(
      '60 € en la península, con las opciones de envío que lo indican al pagar',
    );
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
