import { describe, expect, it, vi } from 'vitest';
import {
  contactLines,
  displayName,
  exportFileName,
  isCustomerKey,
  parseCustomerList,
  parseCustomerRecord,
} from '../../src/modules/customers/domain/records';
import type { CustomerRecord } from '../../src/modules/customers/domain/records';

vi.mock('server-only', () => ({}));
const { customerKey } =
  await import('../../src/modules/customers/server/admin');

/*
 * Ficha de cliente (A7, DECISIONS §184): la clave opaca de cada email, la
 * lectura validada de lo que devuelve la base y los datos de contacto sin
 * repetir.
 */

// sha256('ana@fichas.invalid'): la misma que usa 25_customer_records.
const ANA = '902d2827482bc29531dca02d011b53a3ecab3f50b7cf85a23dc6f17bbdf3f403';

describe('customerKey', () => {
  it('es el sha256 del email en minúsculas, como private.customer_key', () => {
    expect(customerKey('ana@fichas.invalid')).toBe(ANA);
    expect(customerKey('  Ana@FICHAS.invalid ')).toBe(ANA);
    expect(isCustomerKey(ANA)).toBe(true);
  });

  it('una clave solo tiene 64 cifras hexadecimales en minúscula', () => {
    expect(isCustomerKey('ana@fichas.invalid')).toBe(false);
    expect(isCustomerKey(ANA.toUpperCase())).toBe(false);
    expect(isCustomerKey(ANA.slice(1))).toBe(false);
  });
});

describe('parseCustomerList', () => {
  const row = {
    customer_key: ANA,
    email: 'ana@fichas.invalid',
    full_name: 'Ana',
    orders: 2,
    paid_orders: 1,
    paid_cents: 5000,
    refunded_cents: 1000,
    conversations: 1,
    open_conversations: 1,
    newsletter: 'subscribed',
    has_account: true,
    first_seen_at: '2026-10-30T10:00:00+00:00',
    last_activity_at: '2026-11-02T10:00:00+00:00',
    total_count: 7,
  };

  it('cobrado es lo pagado menos lo devuelto; el total viene en cada fila', () => {
    const { customers, total } = parseCustomerList([row]);
    expect(total).toBe(7);
    expect(customers[0]).toMatchObject({
      key: ANA,
      netCents: 4000,
      newsletter: 'subscribed',
      hasAccount: true,
    });
  });

  it('sin filas, nadie; una fila rara no se enseña', () => {
    expect(parseCustomerList(null)).toEqual({ customers: [], total: 0 });
    expect(() =>
      parseCustomerList([{ ...row, customer_key: 'ana@fichas.invalid' }]),
    ).toThrow();
  });
});

function record(over: Partial<CustomerRecord> = {}): CustomerRecord {
  const address = {
    address_line1: null,
    address_line2: null,
    postal_code: null,
    city: null,
    province: null,
  };
  return {
    key: ANA,
    email: 'ana@fichas.invalid',
    account: null,
    newsletter: null,
    orders: [
      {
        id: 'o2',
        number: 1002,
        status: 'shipped',
        reservation: 'consumed',
        fulfillment: 'shipping',
        total_cents: 3000,
        refunded_cents: 0,
        created_at: '2026-11-01T10:00:00+00:00',
        paid_at: '2026-11-01T10:05:00+00:00',
        with_account: false,
        full_name: 'Ana Pérez',
        phone: '600 000 001',
        country: 'ES',
        ...address,
        address_line1: 'Carrer Major 1',
        postal_code: '08860',
        city: 'Castelldefels',
      },
      {
        id: 'o1',
        number: 1001,
        status: 'completed',
        reservation: 'consumed',
        fulfillment: 'click_collect',
        total_cents: 5000,
        refunded_cents: 0,
        created_at: '2026-10-20T10:00:00+00:00',
        paid_at: '2026-10-20T10:05:00+00:00',
        with_account: false,
        full_name: 'ana pérez',
        phone: null,
        country: null,
        ...address,
      },
    ],
    conversations: [
      {
        id: 'c1',
        number: 1001,
        status: 'resolved',
        channel: 'web_form',
        subject: 'Hola',
        created_at: '2026-10-21T10:00:00+00:00',
        last_message_at: '2026-10-21T11:00:00+00:00',
        full_name: 'Ana P.',
        order_number: 1001,
      },
    ],
    ...over,
  };
}

describe('ficha', () => {
  it('la valida y acepta que no exista', () => {
    expect(parseCustomerRecord(null)).toBeNull();
    expect(parseCustomerRecord(record())).toEqual(record());
    expect(() =>
      parseCustomerRecord({ ...record(), orders: [{ number: 'x' }] }),
    ).toThrow();
  });

  it('datos de contacto sin repetir, con su origen más reciente', () => {
    expect(contactLines(record())).toEqual([
      { label: 'Nombre', value: 'Ana Pérez', source: 'Pedido Nº 1002' },
      { label: 'Nombre', value: 'Ana P.', source: 'Consulta Nº 1001' },
      { label: 'Teléfono', value: '600 000 001', source: 'Pedido Nº 1002' },
      {
        label: 'Dirección',
        value: 'Carrer Major 1, 08860 Castelldefels',
        source: 'Pedido Nº 1002',
      },
    ]);
  });

  it('el nombre de la cuenta manda; si no, el del último pedido', () => {
    expect(displayName(record())).toBe('Ana Pérez');
    expect(
      displayName(
        record({
          account: {
            full_name: 'Ana Cuenta',
            phone: null,
            locale: 'es',
            created_at: '2026-10-01T10:00:00+00:00',
            last_sign_in_at: null,
            address_line1: null,
            address_line2: null,
            postal_code: null,
            city: null,
            province: null,
          },
        }),
      ),
    ).toBe('Ana Cuenta');
    expect(displayName(record({ orders: [], conversations: [] }))).toBeNull();
  });

  it('el archivo de la exportación no lleva el email', () => {
    const name = exportFileName(ANA, new Date('2026-11-02T08:00:00Z'));
    expect(name).toBe('cliente-902d2827482b-2026-11-02.json');
    expect(name).not.toContain('@');
  });
});
