/*
 * API v3 de Sendcloud simulada para las pruebas de los envíos (DECISIONS
 * §171–176). Solo local: la arranca playwright.local.config.ts y la tienda la
 * usa con SENDCLOUD_TEST_API_URL, que el código solo acepta si es una
 * dirección local. Exige la autenticación básica de la integración y apunta
 * cada llamada (GET /__calls) para que las pruebas comprueben lo que se pidió.
 *
 * Servicios: Correos Paq Estándar (4 € hasta 1 kg y 5 € hasta 5 kg; en
 * Baleares 8 y 10 €), SEUR 24 (6 € hasta 2 kg; 12 € en Baleares) y una
 * entrega en oficina, que la tienda no vende (pide un punto de recogida).
 */
import type { IncomingMessage } from 'node:http';
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_SENDCLOUD_PORT ?? 3997);
const AUTH = `Basic ${Buffer.from(
  `${process.env.SENDCLOUD_PUBLIC_KEY ?? 'sc_publica_local'}:${process.env.SENDCLOUD_SECRET_KEY ?? 'sc_secreta_local'}`,
).toString('base64')}`;

type Call = { method: string; path: string; body: unknown };
const calls: Call[] = [];
const references = new Set<string>();
// Números de paquete distintos en cada arranque (la base local guarda los de
// ejecuciones anteriores y no admite dos paquetes con el mismo número).
let next = (Math.floor(Date.now() / 1000) % 100000) * 100;

function body(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = '';
    request.on('data', (chunk) => (text += chunk));
    request.on('end', () => resolve(text));
    request.on('error', reject);
  });
}

const kg = (grams: number) => (grams / 1000).toFixed(3);

function quote(minG: number, maxG: number, euros: string, hours: number) {
  return {
    weight: {
      min: { value: kg(minG), unit: 'kg' },
      max: { value: kg(maxG), unit: 'kg' },
    },
    lead_time: hours,
    price: {
      breakdown: [],
      total: { value: euros, currency: 'EUR' },
    },
  };
}

function options(grams: number, postalCode: string) {
  const island = postalCode.startsWith('07');
  const correos =
    grams <= 1000
      ? quote(1, 1000, island ? '8.00' : '4.00', 48)
      : grams <= 5000
        ? quote(1001, 5000, island ? '10.00' : '5.00', 48)
        : null;
  const seur =
    grams <= 2000 ? quote(1, 2000, island ? '12.00' : '6.00', 24) : null;
  return [
    {
      code: 'correos:paq-estandar',
      name: 'Correos Paq Estándar',
      carrier: { code: 'correos', name: 'Correos' },
      product: { code: 'correos:paq', name: 'Paq Estándar' },
      functionalities: {
        first_mile: 'dropoff',
        last_mile: 'home_delivery',
        dangerous_goods: false,
      },
      contract: { id: 11 },
      requirements: {
        fields: [],
        export_documents: false,
        is_service_point_required: false,
      },
      quotes: correos ? [correos] : [],
    },
    {
      code: 'seur:24',
      name: 'SEUR 24',
      carrier: { code: 'seur', name: 'SEUR' },
      product: { code: 'seur:24', name: 'SEUR 24' },
      functionalities: {
        first_mile: 'pickup_dropoff',
        last_mile: 'home_delivery',
        dangerous_goods: false,
      },
      contract: { id: 22 },
      requirements: {
        fields: [],
        export_documents: false,
        is_service_point_required: false,
      },
      quotes: seur ? [seur] : [],
    },
    {
      code: 'correos:oficina',
      name: 'Correos en oficina',
      carrier: { code: 'correos', name: 'Correos' },
      product: { code: 'correos:oficina', name: 'En oficina' },
      functionalities: {
        first_mile: 'dropoff',
        last_mile: 'service_point',
        dangerous_goods: false,
      },
      contract: { id: 11 },
      requirements: {
        fields: [],
        export_documents: false,
        is_service_point_required: true,
      },
      quotes: grams <= 30000 ? [quote(1, 30000, '3.00', 72)] : [],
    },
  ];
}

const server = createServer(async (request, response) => {
  const json = (status: number, value: unknown) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(value));
  };
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
  if (request.method === 'GET' && url.pathname === '/health')
    return json(200, { ok: true });
  if (request.method === 'GET' && url.pathname === '/__calls')
    return json(200, calls);
  if (request.headers.authorization !== AUTH)
    return json(401, {
      errors: [
        {
          status: '401',
          code: 'authentication_failed',
          detail: 'Invalid credentials',
        },
      ],
    });

  const text = request.method === 'POST' ? await body(request) : '';
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  calls.push({
    method: request.method ?? 'GET',
    path: url.pathname + url.search,
    body: data,
  });

  if (request.method === 'POST' && url.pathname === '/shipping-options') {
    const parcel = (
      data?.parcels as { weight: { value: string } }[] | undefined
    )?.[0];
    const grams = Math.round(Number(parcel?.weight.value ?? '0') * 1000);
    const to =
      (data?.to_address as { postal_code?: string } | undefined)?.postal_code ??
      '';
    const code = data?.shipping_option_code as string | undefined;
    const list = options(grams, to).filter((o) => !code || o.code === code);
    return json(200, { data: list, message: null });
  }

  if (request.method === 'POST' && url.pathname === '/shipments/announce') {
    const reference = String(data?.external_reference_id ?? '');
    if (references.has(reference))
      return json(409, {
        errors: [
          {
            status: '409',
            code: 'conflict',
            detail:
              'A shipment with this external_reference_id already exists.',
          },
        ],
      });
    references.add(reference);
    const code = (
      data?.ship_with as { properties: { shipping_option_code: string } }
    ).properties.shipping_option_code;
    const carrier = code.startsWith('seur')
      ? { code: 'seur', name: 'SEUR' }
      : { code: 'correos', name: 'Correos' };
    const n = next++;
    return json(201, {
      data: {
        id: `sc-envio-${n}`,
        carrier,
        parcels: [
          {
            id: 9000 + n,
            status: { code: 'READY_TO_SEND', message: 'Ready to send' },
            tracking_number: `TRK${9000 + n}`,
            tracking_url: `https://tracking.example/TRK${9000 + n}`,
          },
        ],
      },
    });
  }

  const cancel = /^\/shipments\/([^/]+)\/cancel$/.exec(url.pathname);
  if (request.method === 'POST' && cancel)
    return json(200, {
      data: { status: 'cancelled', message: 'Shipment has been cancelled' },
    });

  if (
    request.method === 'GET' &&
    /^\/parcels\/\d+\/documents\/label$/.test(url.pathname)
  ) {
    response.writeHead(200, { 'Content-Type': 'application/pdf' });
    response.end('%PDF-1.4\n% Etiqueta simulada\n%%EOF\n');
    return;
  }

  if (request.method === 'POST' && url.pathname === '/pickups') {
    const n = next++;
    return json(201, {
      data: {
        id: 500 + n,
        status: 'ANNOUNCING',
        carrier_code: data?.carrier_code,
      },
    });
  }

  if (request.method === 'GET' && url.pathname === '/service-points') {
    const day = [{ start_time: '09:00', end_time: '14:00' }];
    return json(200, {
      data: {
        results: [
          {
            id: 4401,
            name: 'Oficina de Correos de Castelldefels',
            carrier: {
              code: url.searchParams.get('carrier_code') ?? 'correos',
              name: 'Correos',
              logo_url: null,
              icon_url: null,
              map_pin_url: null,
            },
            operating_carrier: {
              code: 'correos',
              name: 'Correos',
              logo_url: null,
              icon_url: null,
              map_pin_url: null,
            },
            carrier_service_point_id: 'CO-08860',
            carrier_shop_type: null,
            general_shop_type: 'post_office',
            address: {
              street: 'Avinguda de la Constitució',
              house_number: '10',
              postal_code: '08860',
              city: 'Castelldefels',
              country_code: 'ES',
            },
            position: { latitude: 41.28, longitude: 1.97 },
            contact: { email: '', phone: '' },
            opening_times: {
              monday: day,
              tuesday: day,
              wednesday: day,
              thursday: day,
              friday: day,
              saturday: null,
              sunday: null,
            },
            is_open_tomorrow: true,
            next_open_at: null,
            is_expired: false,
            distance: 450,
          },
        ],
        geocoding: null,
      },
    });
  }

  return json(404, {
    errors: [{ status: '404', code: 'not_found', detail: 'Not found' }],
  });
});

server.listen(PORT, 'localhost');
