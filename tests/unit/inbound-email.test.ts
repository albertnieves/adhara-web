import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  bareAddress,
  displayName,
  findReplyToken,
  htmlToText,
  parseReceivedEvent,
  readReceivedEmail,
  replyAddress,
  stripQuotedReply,
} from '@/modules/messaging';

vi.mock('server-only', () => ({}));

const { inboundConfig, verifyWebhookSignature, contactEnabled } =
  await import('@/modules/messaging/server/config');

const TOKEN = '0123456789abcdef0123456789abcdef';

describe('firma de los webhooks de Resend (Svix)', () => {
  // Vector de ejemplo de la documentación de Svix («Verifying payloads
  // manually»): la parte base64 de su secreto de ejemplo, la que va después
  // del prefijo «whsec_» (no es un secreto de nadie).
  const key = Buffer.from('plJ3nmyCDGBKInavdOK15jsl', 'base64');
  const payload = '{"event_type":"ping","data":{"success":true}}';
  const headers = {
    id: 'msg_loFOjxBNrRLzqYUf',
    timestamp: '1731705121',
    signature: 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=',
  };

  it('acepta la firma del ejemplo de Svix', () => {
    expect(verifyWebhookSignature(key, headers, payload, 1731705121)).toBe(
      true,
    );
  });

  it('acepta si una de varias firmas coincide (cambio de secreto)', () => {
    expect(
      verifyWebhookSignature(
        key,
        { ...headers, signature: `v1,AAAA ${headers.signature}` },
        payload,
        1731705121,
      ),
    ).toBe(true);
  });

  it('rechaza el cuerpo cambiado, otro secreto, otra versión y sin cabeceras', () => {
    expect(
      verifyWebhookSignature(key, headers, `${payload} `, 1731705121),
    ).toBe(false);
    expect(
      verifyWebhookSignature(
        Buffer.from('otro-secreto-de-prueba'),
        headers,
        payload,
        1731705121,
      ),
    ).toBe(false);
    expect(
      verifyWebhookSignature(
        key,
        { ...headers, signature: headers.signature.replace('v1,', 'v2,') },
        payload,
        1731705121,
      ),
    ).toBe(false);
    expect(
      verifyWebhookSignature(
        key,
        { ...headers, signature: null },
        payload,
        1731705121,
      ),
    ).toBe(false);
  });

  it('rechaza una hora firmada con más de 5 minutos de diferencia', () => {
    expect(
      verifyWebhookSignature(key, headers, payload, 1731705121 + 301),
    ).toBe(false);
    expect(
      verifyWebhookSignature(key, headers, payload, 1731705121 - 301),
    ).toBe(false);
    expect(
      verifyWebhookSignature(key, headers, payload, 1731705121 + 299),
    ).toBe(true);
  });

  it('firma igual que la implementación de referencia con un secreto propio', () => {
    const own = Buffer.from('secreto-de-pruebas-de-32-bytes!!');
    const body = JSON.stringify({ type: 'email.received' });
    const signature = createHmac('sha256', own)
      .update(`msg_1.1700000000.${body}`)
      .digest('base64');
    expect(
      verifyWebhookSignature(
        own,
        { id: 'msg_1', timestamp: '1700000000', signature: `v1,${signature}` },
        body,
        1700000000,
      ),
    ).toBe(true);
  });
});

describe('configuración del correo entrante', () => {
  it('lee el subdominio y el secreto; ignora los mal escritos', () => {
    const ok = inboundConfig({
      INBOUND_EMAIL_DOMAIN: ' Respuestas.LatelierDuDesert.com ',
      RESEND_WEBHOOK_SECRET: `whsec_${Buffer.from('x'.repeat(24)).toString('base64')}`,
    });
    expect(ok.domain).toBe('respuestas.latelierdudesert.com');
    expect(ok.webhookKey?.toString()).toBe('x'.repeat(24));
    const bad = inboundConfig({
      INBOUND_EMAIL_DOMAIN: 'no es un dominio',
      RESEND_WEBHOOK_SECRET: 'sin-prefijo',
    });
    expect(bad).toEqual({ domain: null, webhookKey: null });
    expect(inboundConfig({})).toEqual({ domain: null, webhookKey: null });
  });

  it('el formulario solo con CONTACT_FORM=1', () => {
    expect(contactEnabled({ CONTACT_FORM: '1' })).toBe(true);
    expect(contactEnabled({ CONTACT_FORM: 'true' })).toBe(false);
    expect(contactEnabled({})).toBe(false);
  });
});

describe('direcciones', () => {
  it('lee la dirección y el nombre de «Nombre <dirección>»', () => {
    expect(bareAddress('Clienta Prova <Clienta@Example.COM>')).toBe(
      'clienta@example.com',
    );
    expect(bareAddress(' solo@example.com ')).toBe('solo@example.com');
    expect(displayName('"Prova, Clienta" <c@example.com>')).toBe(
      'Prova, Clienta',
    );
    expect(displayName('c@example.com')).toBeNull();
    expect(displayName(null)).toBeNull();
  });

  it('encuentra la clave en la dirección de respuesta del subdominio', () => {
    const address = replyAddress(TOKEN, 'respuestas.example.com');
    expect(address).toBe(`consulta-${TOKEN}@respuestas.example.com`);
    expect(
      findReplyToken(
        ['tienda@example.com', `L’Atelier <${address.toUpperCase()}>`],
        'respuestas.example.com',
      ),
    ).toBe(TOKEN);
    expect(findReplyToken([address], 'otro.example.com')).toBeNull();
    expect(findReplyToken([address], null)).toBe(TOKEN);
    expect(
      findReplyToken(['consulta-123@respuestas.example.com'], null),
    ).toBeNull();
  });
});

describe('evento y correo de Resend', () => {
  it('lee email.received e ignora otros eventos', () => {
    expect(
      parseReceivedEvent({
        type: 'email.received',
        created_at: '2026-10-16T08:00:00Z',
        data: {
          email_id: 'e-1',
          from: 'c@example.com',
          to: ['a@x.com'],
          cc: ['b@x.com'],
          received_for: ['c@x.com'],
          attachments: [],
        },
      }),
    ).toEqual({
      emailId: 'e-1',
      recipients: ['a@x.com', 'b@x.com', 'c@x.com'],
    });
    expect(parseReceivedEvent({ type: 'email.sent', data: {} })).toBeNull();
    expect(() => parseReceivedEvent({ type: 'email.received' })).toThrow();
  });

  it('deja el texto del cliente, su nombre, Message-ID, adjuntos y DMARC', () => {
    const email = readReceivedEmail({
      object: 'email',
      id: 'e-1',
      from: 'Clienta@Example.com',
      to: [`consulta-${TOKEN}@r.example.com`],
      subject: '  Re: Mi pedido (Consulta nº 1001) ',
      text: 'Gracias, ya lo tengo.\r\n\r\nEl jue, 16 oct 2026 a las 10:00, L’Atelier du Désert <pedidos@example.com> escribió:\r\n> Hola',
      html: '<p>Gracias</p>',
      headers: { from: 'Clienta Prova <clienta@example.com>' },
      message_id: '<abc@mail.example.com>',
      attachments: [{ id: '1' }, { id: '2' }],
      authentication: { spf: 'pass', dkim: 'pass', dmarc: 'pass' },
    });
    expect(email).toEqual({
      fromEmail: 'clienta@example.com',
      fromName: 'Clienta Prova',
      subject: 'Re: Mi pedido (Consulta nº 1001)',
      body: 'Gracias, ya lo tengo.',
      messageId: '<abc@mail.example.com>',
      attachments: 2,
      trusted: true,
      recipients: [`consulta-${TOKEN}@r.example.com`],
    });
  });

  it('sin texto, lo saca del HTML; DMARC fallido no es de fiar', () => {
    const email = readReceivedEmail({
      from: 'x@example.com',
      subject: null,
      text: null,
      html: '<html><head><style>p{}</style></head><body><p>Hola &amp; <b>gracias</b></p><script>alert(1)</script><div>Adiós&nbsp;&#8212;&#x21;</div></body></html>',
      authentication: { dmarc: 'fail' },
    });
    expect(email.body).toBe('Hola & gracias\nAdiós —!');
    expect(email.subject).toBe('');
    expect(email.trusted).toBe(false);
    expect(email.attachments).toBe(0);
    expect(email.messageId).toBeNull();
  });
});

describe('texto del correo', () => {
  it('quita el hilo citado de Gmail en es, ca y en (también en dos líneas)', () => {
    expect(
      stripQuotedReply(
        'Perfecte!\n\nEl dc., 15 d’oct. 2026 a les 18:00, L’Atelier <x@y.com> va escriure:\n> Hola',
      ),
    ).toBe('Perfecte!');
    expect(
      stripQuotedReply(
        'Thanks!\n\nOn Wed, Oct 15, 2026 at 6:00 PM L’Atelier <x@y.com>\nwrote:\n\n> Hi',
      ),
    ).toBe('Thanks!');
  });

  it('quita el separador de Outlook y lo citado al final con «>»', () => {
    expect(
      stripQuotedReply(
        'Vale.\n\n________________________________\nDe: L’Atelier\nEnviado: jueves',
      ),
    ).toBe('Vale.');
    expect(stripQuotedReply('Sí.\n\n> antes\n> más')).toBe('Sí.');
    expect(stripQuotedReply('> mi respuesta va dentro\n\nGracias')).toBe(
      '> mi respuesta va dentro\n\nGracias',
    );
  });

  it('si todo es cita, no pierde el mensaje', () => {
    expect(stripQuotedReply('> solo cita')).toBe('> solo cita');
  });

  it('el HTML se reduce a texto sin etiquetas', () => {
    expect(
      htmlToText('<p>Uno</p><p>Dos<br>Tres</p><img src=x onerror=alert(1)>'),
    ).toBe('Uno\nDos\nTres');
  });
});
