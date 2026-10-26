import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  SHIPMENT_STATUSES,
  bracketsFromLimits,
  decimalToCents,
  gramsFrom,
  kilosText,
  madridInstant,
  mergeBrackets,
  nextWorkingDays,
  optionCost,
  parseParcelEvent,
  parseShippingQuote,
  sendcloudStatus,
  shippingPrice,
} from '@/modules/shipping';

vi.mock('server-only', () => ({}));

const { validSendcloudSignature } =
  await import('@/modules/shipping/server/webhook');
const { sendcloudApiBase, sendcloudConfig } =
  await import('@/modules/shipping/server/sendcloud/config');
const { collectServiceRates } = await import('@/modules/shipping/server/sync');

/*
 * Envíos multitransportista (DECISIONS §171–176): precio por peso con las
 * mismas reglas que la base, tramos de la plataforma, avisos firmados y
 * recogidas en hora de Madrid.
 */

const migration = readFileSync(
  new URL(
    '../../supabase/migrations/20261025120000_shipping_carriers.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('precio del envío', () => {
  it('coste sin IVA → con IVA, al céntimo hacia arriba, más el recargo', () => {
    expect(shippingPrice(400, 2100, 0)).toBe(484);
    expect(shippingPrice(333, 2100, 50)).toBe(453);
    expect(shippingPrice(700, 2100, 0)).toBe(847);
    expect(shippingPrice(0, 2100, 0)).toBe(0);
    expect(shippingPrice(1000, 0, 0)).toBe(1000);
  });

  it('la base usa la misma fórmula', () => {
    expect(migration).toContain(
      'select (ceil(p_cost_cents::numeric * (10000 + p_vat_bps) / 10000)',
    );
    expect(migration).toContain('+ p_surcharge_cents)::integer;');
  });

  it('gratis solo en los servicios que cuentan y desde el mínimo, incluido', () => {
    const option = { priceCents: 484, freeEligible: true };
    expect(optionCost(option, 5999, 6000)).toBe(484);
    expect(optionCost(option, 6000, 6000)).toBe(0);
    expect(optionCost({ ...option, freeEligible: false }, 6000, 6000)).toBe(
      484,
    );
    expect(optionCost(option, 100000, null)).toBe(484);
    // Igual que web_order_create.
    expect(migration).toContain('when v_free_eligible');
    expect(migration).toContain(
      'and v_items_cents - v_discount_cents >= v_rate.free_from_cents',
    );
  });

  it('lee importes y pesos de la plataforma', () => {
    expect(decimalToCents('15.50')).toBe(1550);
    expect(decimalToCents('4.000')).toBe(400);
    expect(decimalToCents('4.005')).toBe(401);
    expect(decimalToCents('7')).toBe(700);
    expect(decimalToCents('-1')).toBeNull();
    expect(gramsFrom({ value: '0.001', unit: 'kg' })).toBe(1);
    expect(gramsFrom({ value: '23.001', unit: 'kg' })).toBe(23001);
    expect(gramsFrom({ value: '450', unit: 'g' })).toBe(450);
    expect(gramsFrom({ value: '1', unit: 'stone' })).toBeNull();
    expect(kilosText(550)).toBe('0.550');
  });
});

describe('tramos de peso', () => {
  const entry = (
    min: number,
    max: number,
    cost: number,
    lead: number | null = 24,
  ) => ({
    minWeightG: min,
    maxWeightG: max,
    costCents: cost,
    leadTimeHours: lead,
  });

  it('con varias referencias, el coste más alto de cada peso', () => {
    const palma = [entry(1, 1000, 500), entry(1001, 5000, 700)];
    const eivissa = [entry(1, 2000, 650, 48), entry(2001, 5000, 900, 48)];
    expect(mergeBrackets([palma, eivissa], 10000)).toEqual([
      entry(1, 1000, 650, 48),
      entry(1001, 2000, 700, 48),
      entry(2001, 5000, 900, 48),
    ]);
  });

  it('un peso que alguna referencia no cotiza no entra', () => {
    const a = [entry(1, 5000, 500)];
    const b = [entry(1, 2000, 500)];
    expect(mergeBrackets([a, b], 10000)).toEqual([entry(1, 2000, 500)]);
    expect(mergeBrackets([a, []], 10000)).toEqual([]);
  });

  it('junta tramos iguales y corta en el peso máximo', () => {
    expect(
      mergeBrackets(
        [
          [
            entry(1, 1000, 500),
            entry(1001, 3000, 500),
            entry(3001, 30000, 900),
          ],
        ],
        10000,
      ),
    ).toEqual([entry(1, 3000, 500), entry(3001, 10000, 900)]);
  });

  it('los tramos escritos a mano empiezan donde acaba el anterior', () => {
    expect(
      bracketsFromLimits([
        { upToG: 1000, costCents: 400 },
        { upToG: 2000, costCents: 500 },
      ]),
    ).toEqual({
      ok: true,
      rates: [entry(1, 1000, 400, null), entry(1001, 2000, 500, null)],
    });
    expect(
      bracketsFromLimits([
        { upToG: 2000, costCents: 400 },
        { upToG: 1000, costCents: 500 },
      ]).ok,
    ).toBe(false);
  });
});

describe('estados y avisos de Sendcloud', () => {
  it('los mismos estados que la base', () => {
    for (const status of SHIPMENT_STATUSES)
      expect(migration).toContain(`'${status}'`);
  });

  it('clasifica por el mensaje y, si no, por los ids documentados', () => {
    expect(sendcloudStatus(null, 'Ready to send')).toBe('label_created');
    expect(sendcloudStatus(22, 'Shipment picked up by driver')).toBe(
      'in_transit',
    );
    expect(sendcloudStatus(null, 'Driver en route')).toBe('out_for_delivery');
    expect(sendcloudStatus(null, 'Awaiting customer pickup')).toBe(
      'at_pickup_point',
    );
    expect(sendcloudStatus(11, 'Something new')).toBe('delivered');
    expect(sendcloudStatus(null, 'Delivery attempt failed')).toBe('exception');
    expect(sendcloudStatus(null, 'Returned to sender')).toBe('returned');
    expect(sendcloudStatus(1999, 'Cancellation request')).toBeNull();
    expect(sendcloudStatus(null, '')).toBeNull();
  });

  it('firma HMAC-SHA256 con el ejemplo de la documentación', () => {
    const body = '{"key": "value"}';
    const signature =
      '1eed4b3d41f4653ac64fd56f1bf1cbfd349e4482cbc11dff7134bd93e5da4b0a';
    expect(validSendcloudSignature(body, signature, 'secretkey')).toBe(true);
    expect(
      validSendcloudSignature(body, signature.toUpperCase(), 'secretkey'),
    ).toBe(true);
    expect(validSendcloudSignature(`${body} `, signature, 'secretkey')).toBe(
      false,
    );
    expect(validSendcloudSignature(body, signature, 'otra')).toBe(false);
    expect(validSendcloudSignature(body, null, 'secretkey')).toBe(false);
    expect(validSendcloudSignature(body, 'abc', 'secretkey')).toBe(false);
  });

  it('del aviso solo se usa el paquete, el estado, la hora y el seguimiento', () => {
    const event = parseParcelEvent({
      action: 'parcel_status_changed',
      timestamp: 1761400000123,
      parcel: {
        id: 9001,
        name: 'Destinatario',
        address: 'Carrer 1',
        tracking_number: 'SEUR9001',
        tracking_url: 'https://tracking.example/SEUR9001',
        status: { id: 11, message: 'Delivered' },
      },
    });
    expect(event).toEqual({
      parcelId: '9001',
      status: 'delivered',
      providerStatusId: 11,
      message: 'Delivered',
      at: new Date(1761400000123).toISOString(),
      trackingNumber: 'SEUR9001',
      trackingUrl: 'https://tracking.example/SEUR9001',
    });
    expect(JSON.stringify(event)).not.toContain('Destinatario');
  });

  it('segundos o milisegundos; sin https no hay enlace; otras acciones, nada', () => {
    const at = parseParcelEvent({
      action: 'parcel_status_changed',
      timestamp: 1761400000,
      parcel: {
        id: '7',
        tracking_url: 'http://x',
        status: { id: 3, message: 'En route to sorting center' },
      },
    });
    expect(at?.at).toBe(new Date(1761400000000).toISOString());
    expect(at?.trackingUrl).toBeNull();
    expect(parseParcelEvent({ action: 'integration_connected' })).toBeNull();
    expect(
      parseParcelEvent({
        action: 'parcel_status_changed',
        parcel: {
          id: 1,
          status: { id: 1999, message: 'Cancellation request' },
        },
      }),
    ).toBeNull();
  });
});

describe('recogidas en hora de Madrid', () => {
  it('convierte la hora local a UTC en invierno y en verano', () => {
    expect(madridInstant('2026-10-27', '10:00')).toBe(
      '2026-10-27T09:00:00.000Z',
    );
    expect(madridInstant('2026-07-01', '10:00')).toBe(
      '2026-07-01T08:00:00.000Z',
    );
    expect(madridInstant('2026-13-01', '10:00')).toBeNull();
    expect(madridInstant('2026-10-27', '25:00')).toBeNull();
  });

  it('los próximos días laborables desde mañana', () => {
    // Viernes 23/10/2026 por la tarde en Madrid.
    expect(nextWorkingDays(new Date('2026-10-23T16:00:00Z'), 3)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ]);
  });
});

describe('opciones de la cesta', () => {
  it('lee web_shipping_quote y descarta lo que no entiende', () => {
    expect(
      parseShippingQuote({
        weight_g: 550,
        zones: [
          {
            zone: 'peninsula',
            free_from_cents: 6000,
            options: [
              {
                service_id: '00000000-0000-4000-8000-0000000024e1',
                label: 'Correos · Paq Estándar',
                carrier_name: 'Correos',
                transit_days: 2,
                price_cents: 484,
                free_eligible: true,
              },
            ],
          },
        ],
      }),
    ).toEqual({
      weightG: 550,
      zones: [
        {
          zone: 'peninsula',
          freeFromCents: 6000,
          options: [
            {
              serviceId: '00000000-0000-4000-8000-0000000024e1',
              label: 'Correos · Paq Estándar',
              carrierName: 'Correos',
              transitDays: 2,
              priceCents: 484,
              freeEligible: true,
            },
          ],
        },
      ],
    });
    expect(parseShippingQuote({ zones: 'x' })).toEqual({
      weightG: null,
      zones: [],
    });
  });
});

describe('conexión con Sendcloud', () => {
  it('sin las dos claves no hay plataforma; la de firma es la secreta si no hay otra', () => {
    expect(sendcloudConfig({ SENDCLOUD_PUBLIC_KEY: 'pub' })).toBeNull();
    expect(
      sendcloudConfig({
        SENDCLOUD_PUBLIC_KEY: 'pub',
        SENDCLOUD_SECRET_KEY: 'sec',
      })?.webhookSecret,
    ).toBe('sec');
    expect(
      sendcloudConfig({
        SENDCLOUD_PUBLIC_KEY: 'pub',
        SENDCLOUD_SECRET_KEY: 'sec',
        SENDCLOUD_WEBHOOK_SECRET: 'firma',
      })?.webhookSecret,
    ).toBe('firma');
  });

  it('la API simulada solo vale en local', () => {
    expect(sendcloudApiBase({})).toBe('https://panel.sendcloud.sc/api/v3');
    expect(
      sendcloudApiBase({ SENDCLOUD_TEST_API_URL: 'http://localhost:3997/' }),
    ).toBe('http://localhost:3997');
    expect(
      sendcloudApiBase({ SENDCLOUD_TEST_API_URL: 'https://evil.example' }),
    ).toBe('https://panel.sendcloud.sc/api/v3');
  });
});

describe('sincronización de tarifas', () => {
  const config = {
    publicKey: 'p',
    secretKey: 's',
    webhookSecret: 's',
    apiBase: 'http://localhost:3997',
  };
  type FetchInput = { to: { postalCode: string }; weightG: number };

  it('recorre los tramos y deja fuera los de punto de recogida', async () => {
    const calls: string[] = [];
    const fetcher = async (_: unknown, input: FetchInput) => {
      calls.push(`${input.to.postalCode}:${input.weightG}`);
      const island = input.to.postalCode.startsWith('07');
      const correos =
        input.weightG <= 1000
          ? {
              minWeightG: 1,
              maxWeightG: 1000,
              costCents: island ? 900 : 400,
              leadTimeHours: 48,
            }
          : input.weightG <= 5000
            ? {
                minWeightG: 1001,
                maxWeightG: 5000,
                costCents: island ? 1200 : 500,
                leadTimeHours: 48,
              }
            : null;
      return [
        {
          code: 'correos:paq',
          name: 'Paq Estándar',
          carrierCode: 'correos',
          carrierName: 'Correos',
          contractId: null,
          firstMile: 'dropoff',
          lastMile: 'home_delivery',
          dangerousGoods: false,
          servicePointRequired: false,
          quotes: correos ? [correos] : [],
        },
        {
          code: 'correos:oficina',
          name: 'En oficina',
          carrierCode: 'correos',
          carrierName: 'Correos',
          contractId: null,
          firstMile: 'dropoff',
          lastMile: 'service_point',
          dangerousGoods: false,
          servicePointRequired: true,
          quotes: [
            {
              minWeightG: 1,
              maxWeightG: 30000,
              costCents: 300,
              leadTimeHours: 48,
            },
          ],
        },
      ];
    };
    const services = await collectServiceRates(
      config,
      { postalCode: '08860', city: 'Castelldefels' },
      10000,
      fetcher as never,
    );
    expect(services.map((s) => s.code)).toEqual(['correos:paq']);
    expect(services[0]!.rates).toEqual([
      {
        zone: 'peninsula',
        min_weight_g: 1,
        max_weight_g: 1000,
        cost_cents: 400,
        lead_time_hours: 48,
      },
      {
        zone: 'peninsula',
        min_weight_g: 1001,
        max_weight_g: 5000,
        cost_cents: 500,
        lead_time_hours: 48,
      },
      {
        zone: 'baleares',
        min_weight_g: 1,
        max_weight_g: 1000,
        cost_cents: 900,
        lead_time_hours: 48,
      },
      {
        zone: 'baleares',
        min_weight_g: 1001,
        max_weight_g: 5000,
        cost_cents: 1200,
        lead_time_hours: 48,
      },
    ]);
    // Cada referencia pregunta 1 g, 1001 g y 5001 g (sin más tramos).
    expect(calls.filter((c) => c.startsWith('28001'))).toEqual([
      '28001:1',
      '28001:1001',
      '28001:5001',
    ]);
  });
});
