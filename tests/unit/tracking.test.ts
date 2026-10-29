import { describe, expect, it } from 'vitest';
import {
  ALL_DENIED,
  ALL_GRANTED,
  activeCategories,
  activeVendors,
  consentNeeded,
  grantedVendors,
  NO_TRACKING,
  parseConsent,
  serializeConsent,
  TRACKING_CONSENT_VERSION,
  trackingConfig,
  trackingConfigIssues,
  vendorCalls,
} from '../../src/modules/tracking';
import type {
  CommerceEvent,
  TrackedItem,
  TrackingConfig,
  TrackingVendor,
} from '../../src/modules/tracking';
import { consentFromCookieHeader } from '../../src/modules/tracking/domain/consent';

/*
 * Analítica y publicidad con consentimiento (DECISIONS §178): qué proveedores
 * se configuran, cómo se guarda y se lee la elección y qué recibe cada uno.
 */

const ENV = {
  NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-ABC123XYZ9',
  NEXT_PUBLIC_GOOGLE_ADS_ID: 'AW-123456789',
  NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL: 'AbC-dEf_123',
  NEXT_PUBLIC_META_PIXEL_ID: '1234567890123456',
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: 'CABCDEFGHIJ1234567890',
};

const FULL: TrackingConfig = {
  ga4: 'G-ABC123XYZ9',
  googleAds: { id: 'AW-123456789', purchaseLabel: 'AbC-dEf_123' },
  meta: '1234567890123456',
  tiktok: 'CABCDEFGHIJ1234567890',
};

describe('configuración', () => {
  it('lee los cuatro proveedores con sus IDs', () => {
    expect(trackingConfig(ENV)).toEqual(FULL);
    expect(activeVendors(FULL)).toEqual(['ga4', 'googleAds', 'meta', 'tiktok']);
    expect(activeCategories(['meta'])).toEqual(['ads']);
    expect(activeCategories(['tiktok', 'ga4'])).toEqual(['analytics', 'ads']);
  });

  it('sin variables no hay nada, y la etiqueta de compra es opcional', () => {
    expect(trackingConfig({})).toEqual(NO_TRACKING);
    expect(activeVendors(NO_TRACKING)).toEqual([]);
    expect(
      trackingConfig({ NEXT_PUBLIC_GOOGLE_ADS_ID: 'AW-123456789' }).googleAds,
    ).toEqual({ id: 'AW-123456789', purchaseLabel: null });
  });

  it('las Preview nunca miden, aunque hereden los IDs', () => {
    expect(trackingConfig({ ...ENV, VERCEL_ENV: 'preview' })).toEqual(
      NO_TRACKING,
    );
    expect(trackingConfig({ ...ENV, VERCEL_ENV: 'production' })).toEqual(FULL);
  });

  it('un ID con otro formato se ignora y se señala sin mostrar su valor', () => {
    const env = {
      NEXT_PUBLIC_GA_MEASUREMENT_ID: 'UA-1234-1',
      NEXT_PUBLIC_META_PIXEL_ID: '<script>',
      NEXT_PUBLIC_TIKTOK_PIXEL_ID: ' CABCDEFGHIJ1234567890 ',
    };
    expect(trackingConfig(env)).toEqual({
      ...NO_TRACKING,
      tiktok: 'CABCDEFGHIJ1234567890',
    });
    const issues = trackingConfigIssues(env);
    expect(issues).toEqual([
      'NEXT_PUBLIC_GA_MEASUREMENT_ID no tiene el formato esperado.',
      'NEXT_PUBLIC_META_PIXEL_ID no tiene el formato esperado.',
    ]);
    expect(issues.join(' ')).not.toContain('<script>');
    expect(trackingConfigIssues(ENV)).toEqual([]);
  });
});

describe('elección guardada', () => {
  const at = 1793318400;

  it('se guarda y se lee igual', () => {
    const value = serializeConsent(
      { analytics: true, ads: false },
      ['meta', 'ga4'],
      at,
    );
    expect(value).toBe(`${TRACKING_CONSENT_VERSION}~10~ga4.meta~${at}`);
    expect(parseConsent(value)).toEqual({
      version: TRACKING_CONSENT_VERSION,
      choice: { analytics: true, ads: false },
      vendors: ['ga4', 'meta'],
      at,
    });
    expect(
      consentFromCookieHeader(
        `NEXT_LOCALE=es; atelier_cookies=${encodeURIComponent(value)}; x=1`,
      ),
    ).toEqual(parseConsent(value));
  });

  it('un valor manipulado o de otro formato no cuenta como elección', () => {
    for (const value of [
      '',
      'si',
      `${TRACKING_CONSENT_VERSION}~11~ga4~${at}~x`,
      `${TRACKING_CONSENT_VERSION}~21~ga4~${at}`,
      `${TRACKING_CONSENT_VERSION}~11~ga4.evil~${at}`,
      `ayer~11~ga4~${at}`,
      `${TRACKING_CONSENT_VERSION}~11~ga4~mañana`,
    ])
      expect(parseConsent(value), value).toBeNull();
    expect(consentFromCookieHeader('atelier_cookies=%E0%A4%A')).toBeNull();
  });

  it('pregunta sin elección, con otra versión o con un proveedor nuevo en un tipo aceptado', () => {
    const configured: TrackingVendor[] = ['ga4', 'meta'];
    const stored = (
      choice: typeof ALL_GRANTED,
      vendors: TrackingVendor[],
      version = TRACKING_CONSENT_VERSION,
    ) => parseConsent(serializeConsent(choice, vendors, at, version));

    expect(consentNeeded(null, [])).toBe(false);
    expect(consentNeeded(null, configured)).toBe(true);
    expect(consentNeeded(stored(ALL_GRANTED, configured), configured)).toBe(
      false,
    );
    expect(
      consentNeeded(stored(ALL_GRANTED, configured, '2020-01-01'), configured),
    ).toBe(true);
    // Aceptó la publicidad con Meta; ahora también hay TikTok: se pregunta.
    expect(
      consentNeeded(stored(ALL_GRANTED, configured), [...configured, 'tiktok']),
    ).toBe(true);
    // Rechazó la publicidad: TikTok sigue rechazado y no se pregunta.
    expect(
      consentNeeded(stored({ analytics: true, ads: false }, configured), [
        ...configured,
        'tiktok',
      ]),
    ).toBe(false);
  });

  it('solo carga los proveedores aceptados que el visitante conocía', () => {
    const configured: TrackingVendor[] = ['ga4', 'meta', 'tiktok'];
    const choice = parseConsent(
      serializeConsent({ analytics: false, ads: true }, ['ga4', 'meta'], at),
    );
    expect(grantedVendors(choice, configured)).toEqual(['meta']);
    expect(grantedVendors(null, configured)).toEqual([]);
    expect(
      grantedVendors(
        parseConsent(serializeConsent(ALL_DENIED, configured, at)),
        configured,
      ),
    ).toEqual([]);
  });
});

describe('eventos', () => {
  const item: TrackedItem = {
    id: 'variante-1',
    name: 'Asad',
    brand: 'Lattafa',
    variant: '100 ml',
    priceCents: 3290,
    quantity: 2,
  };
  const all = new Set<TrackingVendor>(['ga4', 'googleAds', 'meta', 'tiktok']);

  it('sin proveedores aceptados no se llama a nadie', () => {
    const event: CommerceEvent = { type: 'view_item', item };
    expect(vendorCalls(event, FULL, new Set())).toEqual([]);
  });

  it('añadir a la cesta llega a cada proveedor en su formato y en euros', () => {
    const calls = vendorCalls({ type: 'add_to_cart', item }, FULL, all);
    expect(calls.map((call) => call.target)).toEqual(['gtag', 'fbq', 'ttq']);
    expect(calls[0]!.args).toEqual([
      'event',
      'add_to_cart',
      {
        currency: 'EUR',
        value: 65.8,
        items: [
          {
            item_id: 'variante-1',
            item_name: 'Asad',
            item_brand: 'Lattafa',
            item_variant: '100 ml',
            price: 32.9,
            quantity: 2,
            id: 'variante-1',
            google_business_vertical: 'retail',
          },
        ],
      },
    ]);
    expect(calls[1]!.args[1]).toBe('AddToCart');
    expect(calls[2]!.args[0]).toBe('AddToCart');
  });

  it('la compra lleva el mismo ID en cada proveedor y la conversión de Ads con su etiqueta', () => {
    const calls = vendorCalls(
      {
        type: 'purchase',
        orderNumber: 1042,
        valueCents: 5980,
        shippingCents: 400,
        coupon: 'OTONO',
      },
      FULL,
      all,
    );
    expect(calls).toEqual([
      {
        target: 'gtag',
        args: [
          'event',
          'purchase',
          {
            transaction_id: '1042',
            value: 59.8,
            currency: 'EUR',
            shipping: 4,
            coupon: 'OTONO',
          },
        ],
      },
      {
        target: 'gtag',
        args: [
          'event',
          'conversion',
          {
            send_to: 'AW-123456789/AbC-dEf_123',
            value: 59.8,
            currency: 'EUR',
            transaction_id: '1042',
          },
        ],
      },
      {
        target: 'fbq',
        args: [
          'track',
          'Purchase',
          { value: 59.8, currency: 'EUR', content_type: 'product' },
          { eventID: 'pedido-1042' },
        ],
      },
      {
        target: 'ttq',
        args: [
          'Purchase',
          { value: 59.8, currency: 'EUR', content_type: 'product' },
          { event_id: 'pedido-1042' },
        ],
      },
    ]);
  });

  it('solo analítica aceptada: Google Analytics sí; Ads, Meta y TikTok no', () => {
    const calls = vendorCalls(
      {
        type: 'purchase',
        orderNumber: 7,
        valueCents: 1000,
        shippingCents: 0,
        coupon: null,
      },
      FULL,
      new Set<TrackingVendor>(['ga4']),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args[1]).toBe('purchase');
  });

  it('nunca envía datos de contacto', () => {
    const events: CommerceEvent[] = [
      { type: 'view_item', item },
      { type: 'begin_checkout', items: [item], valueCents: 6580 },
      { type: 'lead' },
    ];
    const text = JSON.stringify(
      events.flatMap((event) => vendorCalls(event, FULL, all)),
    );
    expect(text).not.toMatch(/email|phone|telefono|address|direccion|@/i);
  });
});
