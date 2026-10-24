import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import ca from '../../messages/ca.json';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import { LEGAL_COPY } from '@/modules/legal/content';
import { legalDocumentText } from '@/modules/legal/domain/plain-text';
import type { OrderEmailContext, OrderEmailJob } from '@/modules/mail';
import {
  EMAIL_COLORS,
  ORDER_EMAIL_KINDS,
  renderOrderEmail,
} from '@/modules/mail';

vi.mock('server-only', () => ({}));
const { mailConfig } = await import('@/modules/mail/server/config');
const { sendWithResend, RESEND_EMAILS_URL } =
  await import('@/modules/mail/server/resend');

const COPY = { es: es.email, ca: ca.email, en: en.email };

const job: OrderEmailJob = {
  id: 7,
  kind: 'order_paid',
  number: 1014,
  locale: 'es',
  fulfillment: 'click_collect',
  items_cents: 9980,
  discount_cents: 0,
  discount_code: null,
  shipping_cents: 0,
  total_cents: 9980,
  tracking_reference: null,
  full_name: 'Ana <script>alert(1)</script>',
  email: 'ana@test.invalid',
  address: null,
  lines: [
    {
      brand: 'Lattafa',
      name: 'Khamrah',
      size_ml: 100,
      label: null,
      quantity: 2,
      line_total_cents: 9980,
    },
  ],
};

const context: OrderEmailContext = {
  copy: es.email,
  store: {
    address: 'Carrer de Pompeu Fabra 1, Castelldefels',
    hours: 'L–S 10:00–20:00',
    email: 'tienda@test.invalid',
  },
  seller: {
    holder: 'Titular de prueba',
    taxId: 'X0000000X',
    address: 'Carrer de Prova 1, Castelldefels',
  },
  returnsUrl: 'https://latelierdudesert.com/es/envios-y-devoluciones',
  terms: 'CONDICIONES DE VENTA\n\nTexto.',
};

describe('correo de confirmación del pago', () => {
  const email = renderOrderEmail(job, context);

  it('asunto, saludo, resumen y siguiente paso', () => {
    expect(email.to).toBe('ana@test.invalid');
    expect(email.subject).toBe('Pedido Nº 1014 confirmado');
    expect(email.text.startsWith('Hola:\n\n')).toBe(true);
    expect(email.text).toContain(
      'Hemos recibido el pago de tu pedido Nº 1014.',
    );
    expect(email.text).toContain(
      'Te escribiremos cuando esté listo para recoger en la tienda: Carrer de Pompeu Fabra 1, Castelldefels.',
    );
    expect(email.text).toMatch(/Lattafa · Khamrah 100 ml × 2: 99,80\s€/);
    expect(email.text).toMatch(/Recogida en la tienda: Gratis/);
    expect(email.text).toMatch(/Total \(IVA incluido\): 99,80\s€/);
  });

  it('desistimiento, vendedor y contacto; condiciones adjuntas', () => {
    expect(email.text).toContain(
      'Tienes 14 días naturales desde que recibes el pedido para desistir',
    );
    expect(email.text).toContain(
      'https://latelierdudesert.com/es/envios-y-devoluciones',
    );
    expect(email.text).toContain(
      'Vendedor: Titular de prueba, NIF X0000000X, Carrer de Prova 1, Castelldefels.',
    );
    expect(email.text).toContain('escríbenos a tienda@test.invalid');
    expect(email.attachments).toEqual([
      {
        filename: 'condiciones-de-venta.txt',
        content: 'CONDICIONES DE VENTA\n\nTexto.',
      },
    ]);
  });

  it('sin el nombre que escribió el comprador (DECISIONS §168)', () => {
    expect(email.text).not.toContain('Ana');
    expect(email.html).not.toContain('Ana');
  });

  it('el HTML escapa todo lo que viene del cliente', () => {
    const shipped = renderOrderEmail(
      {
        ...job,
        kind: 'shipped',
        fulfillment: 'shipping',
        address: {
          line1: 'Calle <script>alert(1)</script> 1',
          line2: null,
          postal_code: '08860',
          city: 'Castelldefels',
          province: 'Barcelona',
        },
      },
      context,
    );
    expect(shipped.html).not.toContain('<script>');
    expect(shipped.html).toContain(
      'Calle &lt;script&gt;alert(1)&lt;/script&gt; 1',
    );
    expect(shipped.html).toContain('lang="es"');
  });

  it('con código de descuento, la línea del descuento y el total cobrado', () => {
    const text = renderOrderEmail(
      {
        ...job,
        discount_cents: 998,
        discount_code: 'CLUB10',
        total_cents: 8982,
      },
      context,
    ).text;
    expect(text).toMatch(/Descuento \(CLUB10\): −9,98\s€/);
    expect(text).toMatch(/Total \(IVA incluido\): 89,82\s€/);
    expect(email.text).not.toContain('Descuento');
  });

  it('sin datos del vendedor, no inventa la línea', () => {
    expect(
      renderOrderEmail(job, { ...context, seller: null }).text,
    ).not.toContain('Vendedor:');
  });
});

describe('avisos de entrega', () => {
  it('listo para recoger: dirección, horario y número; sin adjuntos', () => {
    const email = renderOrderEmail(
      { ...job, kind: 'ready_for_pickup', locale: 'ca' },
      { ...context, copy: ca.email },
    );
    expect(email.subject).toBe(
      'La teva comanda núm. 1014 està a punt per recollir',
    );
    expect(email.text).toContain('Horari: L–S 10:00–20:00.');
    expect(email.text).toContain('Porta el número de comanda.');
    expect(email.text).not.toContain('desistir');
    expect(email.attachments).toEqual([]);
  });

  it('enviado: dirección de envío y seguimiento', () => {
    const email = renderOrderEmail(
      {
        ...job,
        kind: 'shipped',
        locale: 'en',
        fulfillment: 'shipping',
        shipping_cents: 495,
        total_cents: 10475,
        tracking_reference: 'TRK-123',
        address: {
          line1: 'Carrer Major 1',
          line2: '2º 1ª',
          postal_code: '07001',
          city: 'Palma',
          province: null,
        },
      },
      { ...context, copy: en.email },
    );
    expect(email.subject).toBe('Your order no. 1014 is on its way');
    expect(email.text).toContain(
      'has left for this address: Carrer Major 1, 2º 1ª, 07001 Palma.',
    );
    expect(email.text).toContain('Tracking number: TRK-123.');
    expect(email.text).toMatch(/Delivery: €4\.95/);
  });

  it('todos los correos existen en los tres idiomas', () => {
    for (const locale of ['es', 'ca', 'en'] as const)
      for (const kind of ORDER_EMAIL_KINDS)
        expect(() =>
          renderOrderEmail(
            { ...job, kind, locale },
            { ...context, copy: COPY[locale] },
          ),
        ).not.toThrow();
  });

  it('los colores son los tokens de globals.css', () => {
    const css = readFileSync(
      new URL('../../src/app/globals.css', import.meta.url),
      'utf8',
    );
    for (const [name, value] of Object.entries(EMAIL_COLORS))
      expect(css).toContain(`--color-${name}: ${value};`);
  });
});

describe('condiciones de venta en texto plano', () => {
  const text = legalDocumentText(
    LEGAL_COPY.es,
    'terms',
    {
      holder: 'Titular',
      taxId: 'X0000000X',
      email: 'tienda@test.invalid',
      storeAddress: 'Carrer de Pompeu Fabra 1, Castelldefels',
    },
    {
      href: (doc, hash) =>
        `https://latelierdudesert.com/es/${doc}${hash ? `#${hash}` : ''}`,
      updated: '12 de octubre de 2026',
    },
  );

  it('título, fecha y apartados, con los enlaces como URL completas', () => {
    expect(
      text.startsWith(LEGAL_COPY.es.documents.terms.title.toUpperCase()),
    ).toBe(true);
    expect(text).toContain('12 de octubre de 2026');
    expect(text).toContain('https://latelierdudesert.com/es/shipping#');
    for (const section of LEGAL_COPY.es.documents.terms.sections.slice(0, 2))
      expect(text).toContain(section.title.toUpperCase());
  });

  it('sin marcadores sueltos: lo pendiente no se publica', () => {
    expect(text).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(text).not.toMatch(/\]\(doc:/);
  });
});

describe('Resend', () => {
  const email = {
    ...renderOrderEmail(job, context),
    replyTo: 'tienda@test.invalid',
  };

  it('configuración: clave y remitente válidos o nada', () => {
    expect(
      mailConfig({
        RESEND_API_KEY: 'clave',
        EMAIL_FROM: 'L’Atelier du Désert <pedidos@latelierdudesert.com>',
      }),
    ).toEqual({
      apiKey: 'clave',
      from: 'L’Atelier du Désert <pedidos@latelierdudesert.com>',
    });
    expect(
      mailConfig({ RESEND_API_KEY: 'clave', EMAIL_FROM: 'pedidos' }),
    ).toBeNull();
    expect(
      mailConfig({ EMAIL_FROM: 'pedidos@latelierdudesert.com' }),
    ).toBeNull();
  });

  it('una petición con idempotencia, respuesta y adjunto en base64', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ id: 're_123' }, { status: 200 }),
    );
    const result = await sendWithResend(
      { apiKey: 'clave', from: 'pedidos@latelierdudesert.com' },
      email,
      'order-email-7',
      fetcher,
    );
    expect(result).toEqual({ ok: true, id: 're_123' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(RESEND_EMAILS_URL);
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer clave',
      'Idempotency-Key': 'order-email-7',
    });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      from: 'pedidos@latelierdudesert.com',
      to: ['ana@test.invalid'],
      reply_to: 'tienda@test.invalid',
      subject: 'Pedido Nº 1014 confirmado',
    });
    expect(
      Buffer.from(body.attachments[0].content, 'base64').toString('utf8'),
    ).toBe('CONDICIONES DE VENTA\n\nTexto.');
  });

  it('errores como código, sin la respuesta', async () => {
    const config = { apiKey: 'clave', from: 'pedidos@latelierdudesert.com' };
    expect(
      await sendWithResend(config, email, 'k', async () =>
        Response.json({ message: 'ana@test.invalid no vale' }, { status: 422 }),
      ),
    ).toEqual({ ok: false, error: 'http_422' });
    expect(
      await sendWithResend(config, email, 'k', async () => {
        throw new Error('sin red');
      }),
    ).toEqual({ ok: false, error: 'network' });
    expect(
      await sendWithResend(config, email, 'k', async () =>
        Response.json({}, { status: 200 }),
      ),
    ).toEqual({ ok: false, error: 'no_id' });
  });
});
