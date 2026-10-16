import { describe, expect, it } from 'vitest';
import { checkoutInput } from '@/modules/checkout';
import {
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
