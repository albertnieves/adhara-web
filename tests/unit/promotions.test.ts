import { describe, expect, it } from 'vitest';
import { checkoutInput } from '@/modules/checkout';
import type { AppliedDiscount, PromotionOffer } from '@/modules/promotions';
import {
  bestOffer,
  chooseDiscount,
  missingCents,
  nextOffer,
  parsePromotionOffers,
  promotionInput,
  promotionStatus,
  promotionSummary,
  discountBatchCsvRows,
  discountBatchFileName,
  discountBatchInput,
  discountBatchStatus,
  discountCodeInput,
  discountErrorFromDb,
  discountStatus,
  formatDiscountValue,
  isoToMadridLocal,
  madridLocalToIso,
  normalizeDiscountCode,
  parsePercent,
} from '@/modules/promotions';

describe('códigos de descuento', () => {
  it('el código se escribe sin distinguir mayúsculas y con su formato', () => {
    expect(normalizeDiscountCode('  club10 ')).toBe('CLUB10');
    expect(normalizeDiscountCode('club-otono-26')).toBe('CLUB-OTONO-26');
    expect(normalizeDiscountCode('abc')).toBeNull();
    expect(normalizeDiscountCode('con espacio')).toBeNull();
    expect(normalizeDiscountCode('otoño')).toBeNull();
    expect(normalizeDiscountCode('-CLUB')).toBeNull();
    expect(normalizeDiscountCode('CLUB--10')).toBeNull();
    expect(normalizeDiscountCode('A'.repeat(31))).toBeNull();
  });

  it('cada motivo de la base tiene su mensaje y el resto no es de un código', () => {
    expect(discountErrorFromDb('discount_invalid')).toBe('invalid');
    expect(discountErrorFromDb('discount_not_started')).toBe('notStarted');
    expect(discountErrorFromDb('discount_expired')).toBe('expired');
    expect(discountErrorFromDb('discount_exhausted')).toBe('exhausted');
    expect(discountErrorFromDb('discount_minimum')).toBe('minimum');
    expect(discountErrorFromDb('discount_not_applicable')).toBe(
      'notApplicable',
    );
    expect(discountErrorFromDb('discount_used')).toBe('used');
    expect(discountErrorFromDb('insufficient_stock')).toBeNull();
  });

  it('porcentajes en puntos básicos, con coma o punto', () => {
    expect(parsePercent('10')).toBe(1000);
    expect(parsePercent('12,5')).toBe(1250);
    expect(parsePercent('7.25 %')).toBe(725);
    expect(parsePercent('100')).toBeNull();
    expect(parsePercent('diez')).toBeNull();
  });

  it('el valor se enseña en el formato de cada idioma', () => {
    const percent = {
      kind: 'percent',
      percentBp: 1250,
      amountCents: null,
    } as const;
    const amount = {
      kind: 'amount',
      percentBp: null,
      amountCents: 500,
    } as const;
    expect(formatDiscountValue(percent)).toMatch(/^12,5\s%$/);
    expect(formatDiscountValue(percent, 'en')).toBe('12.5%');
    expect(formatDiscountValue(amount)).toMatch(/^5\s€$/);
  });

  it('las fechas del formulario son hora de Madrid, también con el cambio de hora', () => {
    // Invierno (UTC+1) y verano (UTC+2).
    expect(madridLocalToIso('2026-12-01T09:00')).toBe(
      '2026-12-01T08:00:00.000Z',
    );
    expect(madridLocalToIso('2026-07-01T09:00')).toBe(
      '2026-07-01T07:00:00.000Z',
    );
    // El 25/10/2026 a las 3:00 vuelve a ser las 2:00.
    expect(madridLocalToIso('2026-10-25T12:00')).toBe(
      '2026-10-25T11:00:00.000Z',
    );
    expect(isoToMadridLocal('2026-07-01T07:00:00.000Z')).toBe(
      '2026-07-01T09:00',
    );
    expect(isoToMadridLocal(null)).toBe('');
    expect(madridLocalToIso('mañana')).toBeNull();
  });

  it('estado para el panel', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    const base = {
      active: true,
      startsAt: null,
      endsAt: null,
      maxUses: null,
      uses: 0,
    };
    expect(discountStatus(base, now)).toBe('active');
    expect(discountStatus({ ...base, active: false }, now)).toBe('inactive');
    expect(
      discountStatus({ ...base, startsAt: '2026-11-11T00:00:00Z' }, now),
    ).toBe('scheduled');
    expect(
      discountStatus({ ...base, endsAt: '2026-11-10T11:59:00Z' }, now),
    ).toBe('expired');
    expect(discountStatus({ ...base, maxUses: 3, uses: 3 }, now)).toBe(
      'exhausted',
    );
  });
});

describe('formulario del panel', () => {
  const form = {
    id: '',
    code: ' club10 ',
    description: '  Campaña de otoño ',
    kind: 'percent',
    value: '10',
    minItems: '',
    startsAt: '',
    endsAt: '',
    maxUses: '',
    oncePerEmail: true,
    excludeSaleItems: false,
    active: true,
  };

  it('un porcentaje sin límites', () => {
    expect(discountCodeInput.parse(form)).toEqual({
      id: null,
      code: 'CLUB10',
      description: 'Campaña de otoño',
      kind: 'percent',
      percentBp: 1000,
      amountCents: null,
      minItemsCents: null,
      startsAt: null,
      endsAt: null,
      maxUses: null,
      oncePerEmail: true,
      excludeSaleItems: false,
      active: true,
    });
  });

  it('un importe con mínimo, fechas y usos', () => {
    const input = discountCodeInput.parse({
      ...form,
      kind: 'amount',
      value: '5',
      minItems: '49,90',
      startsAt: '2026-11-01T00:00',
      endsAt: '2026-11-30T23:59',
      maxUses: '100',
    });
    expect(input).toMatchObject({
      amountCents: 500,
      percentBp: null,
      minItemsCents: 4990,
      startsAt: '2026-10-31T23:00:00.000Z',
      endsAt: '2026-11-30T22:59:00.000Z',
      maxUses: 100,
    });
  });

  it('rechaza lo que la base no aceptaría, con un mensaje para el equipo', () => {
    const message = (overrides: Record<string, unknown>) => {
      const result = discountCodeInput.safeParse({ ...form, ...overrides });
      return result.success ? null : result.error.issues[0]?.message;
    };
    expect(message({ code: 'con espacio' })).toMatch(/letras o números/);
    expect(message({ value: '95' })).toBe('Entre el 1 % y el 90 %.');
    expect(message({ value: '0,5' })).toBe('Entre el 1 % y el 90 %.');
    expect(message({ kind: 'amount', value: '0,50' })).toBe(
      'Entre 1 € y 1.000 €.',
    );
    expect(message({ minItems: 'mucho' })).toMatch(/importe/);
    expect(message({ maxUses: '0' })).toMatch(/a partir de 1/);
    expect(
      message({ startsAt: '2026-11-02T00:00', endsAt: '2026-11-01T00:00' }),
    ).toMatch(/después del inicio/);
    expect(message({ startsAt: 'pronto' })).toBe('Fecha no válida.');
  });
});

describe('código en «Finalizar compra»', () => {
  const order = {
    requestId: '0b7c8f5e-6a5d-4c4e-9f0e-1d2c3b4a5f60',
    locale: 'es',
    fulfillment: 'click_collect',
    fullName: 'Ana',
    email: 'ana@test.invalid',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    province: '',
    acceptTerms: 'on',
  };

  it('sin código, el pedido va sin código; con él, normalizado', () => {
    expect(checkoutInput.parse(order).discountCode).toBeNull();
    expect(
      checkoutInput.parse({ ...order, discountCode: '' }).discountCode,
    ).toBeNull();
    expect(
      checkoutInput.parse({ ...order, discountCode: ' club10 ' }).discountCode,
    ).toBe('CLUB10');
  });

  it('un código con otro formato no llega a la base', () => {
    const result = checkoutInput.safeParse({
      ...order,
      discountCode: 'con espacio',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['discountCode']);
  });
});

/*
 * Lotes de códigos únicos (DECISIONS §185): el formulario, el estado del lote
 * y el CSV para Sender.
 */
describe('discountBatchInput', () => {
  const base = {
    name: ' Bienvenida al Club ',
    prefix: 'club',
    kind: 'percent',
    value: '10',
    minItems: '',
    startsAt: '',
    endsAt: '2026-11-30T23:59',
    excludeSaleItems: false,
    audience: 'subscribers',
    count: '',
  };

  it('para el Club no pide número; el prefijo va en mayúsculas', () => {
    const parsed = discountBatchInput.parse(base);
    expect(parsed).toMatchObject({
      name: 'Bienvenida al Club',
      prefix: 'CLUB',
      percentBp: 1000,
      amountCents: null,
      audience: 'subscribers',
      count: null,
    });
    expect(parsed.endsAt).toBe('2026-11-30T22:59:00.000Z');
  });

  it('un número fijo de 1 a 5.000', () => {
    const counted = { ...base, audience: 'count', kind: 'amount', value: '5' };
    expect(
      discountBatchInput.parse({ ...counted, count: '200' }),
    ).toMatchObject({ count: 200, amountCents: 500 });
    for (const count of ['', '0', '5001', '2,5'])
      expect(discountBatchInput.safeParse({ ...counted, count }).success).toBe(
        false,
      );
  });

  it('rechaza un prefijo con guiones o de una letra, y descuentos fuera de rango', () => {
    for (const prefix of ['C', 'CLUB-2026', 'DEMASIADOLARGO', 'CLUB NOV'])
      expect(discountBatchInput.safeParse({ ...base, prefix }).success).toBe(
        false,
      );
    expect(discountBatchInput.safeParse({ ...base, value: '95' }).success).toBe(
      false,
    );
    expect(discountBatchInput.safeParse({ ...base, name: '  ' }).success).toBe(
      false,
    );
  });
});

describe('discountBatchStatus', () => {
  const batch = {
    activeCodes: 3,
    codes: 3,
    usedCodes: 1,
    startsAt: null,
    endsAt: null,
  };
  const now = new Date('2026-11-02T10:00:00Z');

  it('apagado si no queda ningún código encendido; caducado; todos usados', () => {
    expect(discountBatchStatus(batch, now)).toBe('active');
    expect(discountBatchStatus({ ...batch, activeCodes: 0 }, now)).toBe(
      'inactive',
    );
    expect(
      discountBatchStatus({ ...batch, endsAt: '2026-11-01T00:00:00Z' }, now),
    ).toBe('expired');
    expect(discountBatchStatus({ ...batch, usedCodes: 3 }, now)).toBe(
      'exhausted',
    );
    expect(
      discountBatchStatus({ ...batch, startsAt: '2026-11-05T00:00:00Z' }, now),
    ).toBe('scheduled');
  });
});

describe('CSV del lote', () => {
  it('email y código para Sender, y si está usado o apagado', () => {
    expect(
      discountBatchCsvRows([
        {
          code: 'CLUB-7KQ4MZ9X',
          email: 'ana@test.invalid',
          active: true,
          used: false,
        },
        { code: 'CLUB-PB3WX2HT', email: null, active: false, used: true },
      ]),
    ).toEqual([
      ['email', 'codigo', 'usado', 'activo'],
      ['ana@test.invalid', 'CLUB-7KQ4MZ9X', 'no', 'sí'],
      ['', 'CLUB-PB3WX2HT', 'sí', 'no'],
    ]);
    expect(
      discountBatchFileName('CLUB', new Date('2026-11-02T08:00:00Z')),
    ).toBe('codigos-club-2026-11-02.csv');
  });
});

/*
 * Promociones automáticas (DECISIONS §186): el formulario del panel, lo que
 * enseña la tienda y la regla con los códigos (no se suman: el que más
 * descuenta; si empatan, la promoción).
 */
describe('promotionInput', () => {
  const base = {
    id: '',
    name: ' Black Friday ',
    kind: 'percent',
    value: '10',
    minItems: '100',
    brandId: '',
    excludeSaleItems: false,
    startsAt: '2026-11-27T00:00',
    endsAt: '2026-11-30T23:59',
    active: true,
  };

  it('un porcentaje desde un importe, con fechas de Madrid y todas las casas', () => {
    expect(promotionInput.parse(base)).toEqual({
      id: null,
      name: 'Black Friday',
      kind: 'percent',
      percentBp: 1000,
      amountCents: null,
      minItemsCents: 10_000,
      brandId: null,
      excludeSaleItems: false,
      startsAt: '2026-11-26T23:00:00.000Z',
      endsAt: '2026-11-30T22:59:00.000Z',
      active: true,
    });
  });

  it('un importe fijo de una casa', () => {
    const brandId = '0b7c8f5e-6a5d-4c4e-9f0e-1d2c3b4a5f60';
    const parsed = promotionInput.parse({
      ...base,
      kind: 'amount',
      value: '15',
      minItems: '80,50',
      brandId,
    });
    expect(parsed).toMatchObject({
      percentBp: null,
      amountCents: 1500,
      minItemsCents: 8050,
      brandId,
    });
  });

  it('rechaza lo que la base no aceptaría, con un mensaje para el equipo', () => {
    const message = (input: Partial<typeof base>) =>
      promotionInput.safeParse({ ...base, ...input }).error?.issues[0]?.message;
    expect(message({ name: '  ' })).toMatch(/nombre/);
    expect(message({ value: '95' })).toMatch(/90 %/);
    expect(message({ minItems: '' })).toMatch(/desde cuánto/);
    expect(message({ minItems: '0,50' })).toMatch(/mínimo 1 €/);
    expect(message({ kind: 'amount', value: '100', minItems: '100' })).toMatch(
      /mayor que el descuento/,
    );
    expect(
      message({ startsAt: '2026-12-01T00:00', endsAt: '2026-11-30T00:00' }),
    ).toMatch(/después del inicio/);
  });
});

describe('promotionStatus y resumen del panel', () => {
  const now = new Date('2026-11-28T12:00:00Z');
  it('activa, programada, terminada o apagada', () => {
    const p = { active: true, startsAt: null, endsAt: null };
    expect(promotionStatus(p, now)).toBe('active');
    expect(
      promotionStatus({ ...p, startsAt: '2026-11-29T00:00:00Z' }, now),
    ).toBe('scheduled');
    expect(promotionStatus({ ...p, endsAt: '2026-11-28T11:00:00Z' }, now)).toBe(
      'expired',
    );
    expect(promotionStatus({ ...p, active: false }, now)).toBe('inactive');
  });

  it('el resumen dice el descuento, desde cuánto y qué casas', () => {
    expect(
      promotionSummary({
        kind: 'percent',
        percentBp: 1500,
        amountCents: null,
        minItemsCents: 6000,
        brandName: 'Lattafa',
        excludeSaleItems: true,
      }),
    ).toMatch(/^−15\s%\sdesde 60\s€ · solo Lattafa · sin rebajados$/);
  });
});

describe('promociones en la tienda', () => {
  const offer = (over: Partial<PromotionOffer>): PromotionOffer => ({
    id: '0b7c8f5e-6a5d-4c4e-9f0e-1d2c3b4a5f60',
    kind: 'percent',
    percentBp: 1000,
    amountCents: null,
    minItemsCents: 10_000,
    brandName: null,
    excludeSaleItems: false,
    endsAt: null,
    eligibleCents: 8000,
    discountCents: 0,
    ...over,
  });

  it('lee la respuesta de la base y descarta lo que no entiende', () => {
    expect(
      parsePromotionOffers([
        {
          id: '0b7c8f5e-6a5d-4c4e-9f0e-1d2c3b4a5f60',
          kind: 'amount',
          percent_bp: null,
          amount_cents: 500,
          min_items_cents: 5000,
          brand_name: 'Casa B',
          exclude_sale_items: false,
          ends_at: '2026-11-30T22:59:00+00:00',
          eligible_cents: 5000,
          discount_cents: 500,
        },
      ]),
    ).toEqual([
      offer({
        kind: 'amount',
        percentBp: null,
        amountCents: 500,
        minItemsCents: 5000,
        brandName: 'Casa B',
        endsAt: '2026-11-30T22:59:00+00:00',
        eligibleCents: 5000,
        discountCents: 500,
      }),
    ]);
    expect(parsePromotionOffers([{ id: 'x' }])).toEqual([]);
    expect(parsePromotionOffers(null)).toEqual([]);
  });

  it('la mejor es la que más descuenta; sin ninguna alcanzada, ninguna', () => {
    const a = offer({ id: 'a', discountCents: 1200 });
    const b = offer({ id: 'b', discountCents: 1500 });
    expect(bestOffer([a, b])?.id).toBe('b');
    expect(bestOffer([offer({})])).toBeNull();
  });

  it('«te faltan»: la más cercana que mejoraría lo que ya hay', () => {
    const near = offer({
      id: 'near',
      minItemsCents: 9000,
      eligibleCents: 8000,
    });
    const far = offer({ id: 'far', minItemsCents: 15_000 });
    expect(nextOffer([far, near])?.id).toBe('near');
    expect(missingCents(near)).toBe(1000);
    // Ya hay una que da 12 €: un 10 % desde 100 € (10 €) no mejora nada.
    const got = offer({ id: 'got', discountCents: 1200, minItemsCents: 6000 });
    expect(nextOffer([got, offer({ id: 'small' })])).toBeNull();
    // Una casa que no está en la cesta no se propone.
    expect(nextOffer([offer({ eligibleCents: 0 })])).toBeNull();
  });

  it('no se suman: el código si descuenta más; si empatan, la promoción', () => {
    const promotion = offer({ discountCents: 1200 });
    const code = (cents: number): AppliedDiscount => ({
      code: 'CLUB',
      discountCents: cents,
      excludesSaleItems: false,
    });
    expect(chooseDiscount(code(1500), promotion)).toEqual({
      source: 'code',
      discountCents: 1500,
    });
    expect(chooseDiscount(code(1200), promotion)).toEqual({
      source: 'promotion',
      discountCents: 1200,
    });
    expect(chooseDiscount(null, promotion).source).toBe('promotion');
    expect(chooseDiscount(code(500), null)).toEqual({
      source: 'code',
      discountCents: 500,
    });
    expect(chooseDiscount(null, null)).toEqual({
      source: null,
      discountCents: 0,
    });
  });
});

describe('descuento enseñado en «Finalizar compra»', () => {
  const order = {
    requestId: '0b7c8f5e-6a5d-4c4e-9f0e-1d2c3b4a5f60',
    locale: 'es',
    fulfillment: 'click_collect',
    fullName: 'Ana',
    email: 'ana@test.invalid',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    province: '',
    acceptTerms: 'on',
  };
  it('llega a la base en céntimos; sin él o raro, 0 (nunca bloquea)', () => {
    expect(
      checkoutInput.parse({ ...order, expectedDiscount: '1200' })
        .expectedDiscount,
    ).toBe(1200);
    expect(checkoutInput.parse(order).expectedDiscount).toBe(0);
    expect(
      checkoutInput.parse({ ...order, expectedDiscount: '-5' })
        .expectedDiscount,
    ).toBe(0);
    expect(
      checkoutInput.parse({ ...order, expectedDiscount: '12.5' })
        .expectedDiscount,
    ).toBe(0);
  });
});
