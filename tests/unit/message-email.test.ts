import { describe, expect, it, vi } from 'vitest';
import ca from '../../messages/ca.json';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import type { MessageEmailJob } from '@/modules/mail';
import { messageEmailSubject, renderMessageEmail } from '@/modules/mail';

vi.mock('server-only', () => ({}));

const { sendWithResend } = await import('@/modules/mail/server/resend');
const { resendApiBase } = await import('@/modules/mail/server/config');

const JOB: MessageEmailJob = {
  id: 7,
  number: 1001,
  locale: 'ca',
  subject: 'On és la meva comanda?',
  body: 'Bon dia,\nja l’hem enviat <hoy>.',
  full_name: 'Clienta',
  email: 'clienta@example.com',
  token: '0123456789abcdef0123456789abcdef',
  quoted: 'Hola,\nencara no m’ha arribat.',
  in_reply_to: '<msg-1@mail.example.com>',
};

const CTX = {
  copy: ca.messageEmail,
  store: { address: 'Carrer de Pompeu Fabra 1, Castelldefels' },
  siteUrl: 'https://latelierdudesert.com/ca',
};

describe('respuesta del panel por email', () => {
  it('los tres idiomas tienen los mismos textos', () => {
    expect(Object.keys(ca.messageEmail)).toEqual(Object.keys(es.messageEmail));
    expect(Object.keys(en.messageEmail)).toEqual(Object.keys(es.messageEmail));
  });

  it('asunto con «Re:» y el número, sin repetirlos', () => {
    expect(messageEmailSubject('Mi pedido', 'Consulta nº 1001')).toBe(
      'Re: Mi pedido (Consulta nº 1001)',
    );
    expect(
      messageEmailSubject(
        'RE: Fwd: Mi pedido (Consulta nº 1001)',
        'Consulta nº 1001',
      ),
    ).toBe('Re: Mi pedido (Consulta nº 1001)');
  });

  it('texto con la respuesta, la firma y el mensaje del cliente citado', () => {
    const email = renderMessageEmail(JOB, CTX);
    expect(email.to).toBe('clienta@example.com');
    expect(email.subject).toBe(
      'Re: On és la meva comanda? (Consulta núm. 1001)',
    );
    expect(email.text).toBe(
      [
        'Bon dia,\nja l’hem enviat <hoy>.',
        'L’Atelier du Désert · Perfumeria àrab a Castelldefels\nCarrer de Pompeu Fabra 1, Castelldefels\nhttps://latelierdudesert.com/ca',
        'Per continuar la conversa, respon aquest correu.',
        'El teu missatge:\n> Hola,\n> encara no m’ha arribat.',
      ].join('\n\n'),
    );
    expect(email.attachments).toEqual([]);
  });

  it('el HTML escapa lo que escribe el personal y el cliente', () => {
    const email = renderMessageEmail(
      { ...JOB, quoted: '<script>alert(1)</script>' },
      CTX,
    );
    expect(email.html).toContain('ja l’hem enviat &lt;hoy&gt;.');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('<html lang="ca">');
  });

  it('se encadena al correo del cliente solo con un Message-ID válido', () => {
    expect(renderMessageEmail(JOB, CTX).headers).toEqual({
      'In-Reply-To': '<msg-1@mail.example.com>',
      References: '<msg-1@mail.example.com>',
    });
    expect(
      renderMessageEmail({ ...JOB, in_reply_to: 'x\r\nBcc: a@b.c' }, CTX)
        .headers,
    ).toEqual({});
    expect(
      renderMessageEmail({ ...JOB, in_reply_to: null, quoted: null }, CTX),
    ).toMatchObject({ headers: {} });
  });

  it('Resend recibe «Responder a» y las cabeceras', async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ id: 're_1' }), { status: 200 }),
    );
    const email = renderMessageEmail(JOB, CTX);
    const result = await sendWithResend(
      { apiKey: 're_test', from: 'L’Atelier <hola@example.com>' },
      { ...email, replyTo: `consulta-${JOB.token}@r.example.com` },
      'message-email-7',
      fetcher as unknown as typeof fetch,
    );
    expect(result).toEqual({ ok: true, id: 're_1' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.reply_to).toBe(`consulta-${JOB.token}@r.example.com`);
    expect(body.headers).toEqual(email.headers);
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      'message-email-7',
    );
  });

  it('la API simulada de las pruebas solo puede ser local', () => {
    expect(resendApiBase({})).toBe('https://api.resend.com');
    expect(
      resendApiBase({ RESEND_TEST_API_URL: 'http://localhost:3998/' }),
    ).toBe('http://localhost:3998');
    expect(
      resendApiBase({ RESEND_TEST_API_URL: 'https://evil.example.com' }),
    ).toBe('https://api.resend.com');
    expect(resendApiBase({ RESEND_TEST_API_URL: 'http://10.0.0.1:80' })).toBe(
      'https://api.resend.com',
    );
  });
});
