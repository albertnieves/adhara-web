import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  addToCart,
  cartCount,
  checkoutInput,
  fieldErrors,
  parseCart,
  serializeCart,
  setLineQuantity,
  shippingCost,
  shippingZone,
} from '@/modules/checkout';

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('cesta en la cookie', () => {
  it('lee y escribe «id:cantidad.id:cantidad»', () => {
    const lines = [
      { variantId: A, quantity: 2 },
      { variantId: B, quantity: 1 },
    ];
    expect(parseCart(serializeCart(lines))).toEqual(lines);
    expect(cartCount(lines)).toBe(3);
  });

  it('ignora lo que no entiende y junta repetidos sin pasar del tope', () => {
    expect(
      parseCart(`${A}:2.basura.${B}:0.${B}:-1.${A}:9.${id(3)}:x.${id(4)}`),
    ).toEqual([{ variantId: A, quantity: MAX_LINE_QUANTITY }]);
    expect(parseCart(undefined)).toEqual([]);
    expect(parseCart('')).toEqual([]);
  });

  it(`como mucho ${MAX_CART_LINES} formatos distintos`, () => {
    const many = Array.from({ length: MAX_CART_LINES + 5 }, (_, i) => ({
      variantId: id(i + 1),
      quantity: 1,
    }));
    expect(parseCart(serializeCart(many))).toHaveLength(MAX_CART_LINES);
    const full = parseCart(serializeCart(many));
    expect(addToCart(full, id(999))).toEqual({ ok: false, reason: 'full' });
  });

  it('añadir suma una unidad hasta el tope por formato', () => {
    const first = addToCart([], A);
    expect(first).toEqual({ ok: true, lines: [{ variantId: A, quantity: 1 }] });
    const second = first.ok ? addToCart(first.lines, A) : first;
    expect(second).toEqual({
      ok: true,
      lines: [{ variantId: A, quantity: 2 }],
    });
    expect(
      addToCart([{ variantId: A, quantity: MAX_LINE_QUANTITY }], A),
    ).toEqual({ ok: false, reason: 'max_quantity' });
  });

  it('cambiar la cantidad a 0 quita el formato; nunca pasa del tope', () => {
    const lines = [
      { variantId: A, quantity: 2 },
      { variantId: B, quantity: 1 },
    ];
    expect(setLineQuantity(lines, A, 0)).toEqual([
      { variantId: B, quantity: 1 },
    ]);
    expect(setLineQuantity(lines, B, 99)).toEqual([
      { variantId: A, quantity: 2 },
      { variantId: B, quantity: MAX_LINE_QUANTITY },
    ]);
  });
});

describe('zonas de envío (las mismas que private.shipping_zone)', () => {
  it.each([
    ['08860', 'peninsula'],
    ['28001', 'peninsula'],
    ['50001', 'peninsula'],
    ['07001', 'baleares'],
    ['07800', 'baleares'],
    [' 08860 ', 'peninsula'],
    ['35001', null],
    ['38001', null],
    ['51001', null],
    ['52001', null],
    ['00123', null],
    ['53000', null],
    ['0886', null],
    ['08860a', null],
  ])('%s → %s', (code, zone) => {
    expect(shippingZone(code)).toBe(zone);
  });

  it('la migración usa el mismo patrón y las mismas exclusiones', () => {
    const sql = readFileSync(
      new URL(
        '../../supabase/migrations/20261012120000_web_checkout.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(sql).toContain("'^(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$'");
    expect(sql).toContain("left(p_postal_code, 2) = '07' then 'baleares'");
    expect(sql).toContain("left(p_postal_code, 2) in ('35', '38', '51', '52')");
  });

  it('envío gratis desde el importe, incluido', () => {
    const rate = {
      zone: 'peninsula' as const,
      priceCents: 495,
      freeFromCents: 6000,
    };
    expect(shippingCost(5999, rate)).toBe(495);
    expect(shippingCost(6000, rate)).toBe(0);
    expect(shippingCost(9999, { ...rate, freeFromCents: null })).toBe(495);
  });
});

describe('formulario de finalizar compra', () => {
  const base = {
    requestId: '6f1d5b8e-2a3c-4c5d-8e9f-0a1b2c3d4e5f',
    locale: 'es',
    fulfillment: 'click_collect',
    fullName: '  Ana Pérez ',
    email: ' Ana@Ejemplo.COM ',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    province: '',
    acceptTerms: 'on',
  };

  it('la recogida solo necesita nombre, email y aceptar las condiciones', () => {
    const parsed = checkoutInput.parse(base);
    expect(parsed.fullName).toBe('Ana Pérez');
    expect(parsed.email).toBe('ana@ejemplo.com');
  });

  it('sin aceptar las condiciones no se compra', () => {
    const result = checkoutInput.safeParse({ ...base, acceptTerms: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error.issues)).toEqual({
        acceptTerms: 'termsRequired',
      });
    }
  });

  it('el envío exige teléfono, calle, población y un código postal con envío', () => {
    const result = checkoutInput.safeParse({
      ...base,
      fulfillment: 'shipping',
      postalCode: '35001',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error.issues)).toEqual({
        phone: 'phoneRequired',
        addressLine1: 'addressRequired',
        city: 'cityRequired',
        postalCode: 'zoneUnavailable',
      });
    }
    expect(
      checkoutInput.safeParse({
        ...base,
        fulfillment: 'shipping',
        phone: '+34 600 000 000',
        addressLine1: 'Carrer Major 1',
        postalCode: '07001',
        city: 'Palma',
      }).success,
    ).toBe(true);
  });

  it('un email o un teléfono raros tienen su mensaje', () => {
    const result = checkoutInput.safeParse({
      ...base,
      email: 'sin-arroba',
      phone: 'llámame',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error.issues)).toEqual({
        email: 'emailInvalid',
        phone: 'phoneInvalid',
      });
    }
  });
});
