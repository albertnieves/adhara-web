import { describe, expect, it, vi } from 'vitest';
import {
  redsysAmount,
  redsysChargeOutcome,
  redsysCurrency,
  redsysRefundAccepted,
  redsysTransactionId,
  sameTerminal,
} from '@/modules/payments/domain/redsys';

vi.mock('server-only', () => ({}));

const { redsysConfig } = await import('@/modules/payments/server/config');
const {
  decodeMerchantParameters,
  encodeMerchantParameters,
  readRedsysNotification,
  redsysOrderKey,
  redsysPaymentForm,
  redsysSign,
  sameSignature,
  signRedsysRequest,
  verifyRedsysMessage,
} = await import('@/modules/payments/server/redsys');

/*
 * Vector de ejemplo de la documentación de Redsys (clave de pruebas pública
 * del manual, no la del comercio), el mismo que usan las librerías
 * node-redsys-api y redsys-pos en sus pruebas: si la firma coincide con la
 * del banco, coincide con la de su ejemplo.
 */
const DOC_KEY = 'Mk9m98IfEblmPfrpsawt7BmxObt98Jev';
const DOC_REQUEST = {
  DS_MERCHANT_AMOUNT: '145',
  DS_MERCHANT_ORDER: '1',
  DS_MERCHANT_MERCHANTCODE: '999008881',
  DS_MERCHANT_CURRENCY: '978',
  DS_MERCHANT_TRANSACTIONTYPE: '0',
  DS_MERCHANT_TERMINAL: '871',
  DS_MERCHANT_MERCHANTURL: '',
  DS_MERCHANT_URLOK: '',
  DS_MERCHANT_URLKO: '',
};
const DOC_REQUEST_PARAMS =
  'eyJEU19NRVJDSEFOVF9BTU9VTlQiOiIxNDUiLCJEU19NRVJDSEFOVF9PUkRFUiI6IjEiLCJEU19NRVJDSEFOVF9NRVJDSEFOVENPREUiOiI5OTkwMDg4ODEiLCJEU19NRVJDSEFOVF9DVVJSRU5DWSI6Ijk3OCIsIkRTX01FUkNIQU5UX1RSQU5TQUNUSU9OVFlQRSI6IjAiLCJEU19NRVJDSEFOVF9URVJNSU5BTCI6Ijg3MSIsIkRTX01FUkNIQU5UX01FUkNIQU5UVVJMIjoiIiwiRFNfTUVSQ0hBTlRfVVJMT0siOiIiLCJEU19NRVJDSEFOVF9VUkxLTyI6IiJ9';
const DOC_NOTIFICATION = {
  Ds_SignatureVersion: 'HMAC_SHA256_V1',
  Ds_MerchantParameters:
    'eyJEc19EYXRlIjoiMDklMkYxMSUyRjIwMTUiLCJEc19Ib3VyIjoiMTglM0EwMyIsIkRzX1NlY3VyZVBheW1lbnQiOiIwIiwiRHNfQ2FyZF9Db3VudHJ5IjoiNzI0IiwiRHNfQW1vdW50IjoiMTQ1IiwiRHNfQ3VycmVuY3kiOiI5NzgiLCJEc19PcmRlciI6IjAwNjkiLCJEc19NZXJjaGFudENvZGUiOiI5OTkwMDg4ODEiLCJEc19UZXJtaW5hbCI6Ijg3MSIsIkRzX1Jlc3BvbnNlIjoiMDAwMCIsIkRzX01lcmNoYW50RGF0YSI6IiIsIkRzX1RyYW5zYWN0aW9uVHlwZSI6IjAiLCJEc19Db25zdW1lckxhbmd1YWdlIjoiMSIsIkRzX0F1dGhvcmlzYXRpb25Db2RlIjoiMDgyMTUwIn0=',
  Ds_Signature: '6DVpRPAPoChZh2cgaWnLqlfFsKeXdRfAO_tz-UrxJcU=',
};
const DOC_CONFIG = {
  merchantCode: '999008881',
  terminal: '871',
  secretKey: DOC_KEY,
  environment: 'test' as const,
  merchantName: 'Prueba',
};

/* Clave de pruebas pública del entorno de Redsys, con los vectores de redsys-pos. */
const SANDBOX_KEY = 'sq7HjrUOBfKmC576ILgskD5srU870gJ7';

describe('firma HMAC_SHA256_V1 de Redsys', () => {
  it('clave de la operación: 3DES del número de pedido', () => {
    expect(redsysOrderKey(DOC_KEY, '1').toString('base64')).toBe(
      'Lr6bLJYWKrk=',
    );
    expect(redsysOrderKey(SANDBOX_KEY, '0').toString('base64')).toBe(
      'Qyx5NZhbucY=',
    );
    expect(redsysOrderKey(SANDBOX_KEY, '1234567890').toString('base64')).toBe(
      'ntVrJPxp2xlsetWVajPl0g==',
    );
    expect(
      redsysOrderKey(SANDBOX_KEY, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').toString(
        'base64',
      ),
    ).toBe('zpFLv7NacMPOXx570s2BAdR9fZue1crKaHX2S/0/f/8=');
  });

  it('parámetros y firma de una petición, como el ejemplo del manual', () => {
    expect(encodeMerchantParameters(DOC_REQUEST)).toBe(DOC_REQUEST_PARAMS);
    expect(redsysSign(DOC_KEY, '1', DOC_REQUEST_PARAMS)).toBe(
      '3TEI5WyvHf1D/whByt1ENgFH/HPIP9UFuB6LkCYgj+E=',
    );
    expect(signRedsysRequest({ secretKey: DOC_KEY }, DOC_REQUEST)).toEqual({
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      Ds_MerchantParameters: DOC_REQUEST_PARAMS,
      Ds_Signature: '3TEI5WyvHf1D/whByt1ENgFH/HPIP9UFuB6LkCYgj+E=',
    });
  });

  it('una notificación auténtica del manual se lee y se valida', () => {
    expect(
      verifyRedsysMessage({ secretKey: DOC_KEY }, DOC_NOTIFICATION),
    ).toMatchObject({
      Ds_Date: '09/11/2015',
      Ds_Hour: '18:03',
      Ds_Amount: '145',
      Ds_Order: '0069',
      Ds_Response: '0000',
      Ds_AuthorisationCode: '082150',
    });
    expect(readRedsysNotification(DOC_CONFIG, DOC_NOTIFICATION)).toEqual({
      ok: true,
      charge: {
        provider: 'redsys',
        reference: '0069',
        transactionId: '0069/082150',
        outcome: 'succeeded',
        amountCents: 145,
        currency: 'EUR',
        response: '0000',
      },
    });
  });

  it('notificaciones reales de redsys-pos: pago aceptado y pago cancelado', () => {
    const config = {
      ...DOC_CONFIG,
      secretKey: SANDBOX_KEY,
      terminal: '1',
    };
    const accepted = {
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      Ds_MerchantParameters:
        'eyJEc19EYXRlIjoiMjglMkYwNSUyRjIwMTgiLCJEc19Ib3VyIjoiMTAlM0E0NCIsIkRzX1NlY3VyZVBheW1lbnQiOiIxIiwiRHNfQW1vdW50IjoiNjcwMCIsIkRzX0N1cnJlbmN5IjoiOTc4IiwiRHNfT3JkZXIiOiIwMDAwRkI5QTE3MiIsIkRzX01lcmNoYW50Q29kZSI6IjMzNjcwNDY1NSIsIkRzX1Rlcm1pbmFsIjoiMDAxIiwiRHNfUmVzcG9uc2UiOiIwMDAwIiwiRHNfVHJhbnNhY3Rpb25UeXBlIjoiMCIsIkRzX01lcmNoYW50RGF0YSI6IiIsIkRzX0F1dGhvcmlzYXRpb25Db2RlIjoiMjE4MDQ4IiwiRHNfQ29uc3VtZXJMYW5ndWFnZSI6IjEiLCJEc19DYXJkX0NvdW50cnkiOiI3MjQiLCJEc19DYXJkX0JyYW5kIjoiMSJ9',
      Ds_Signature: '3Fg6oB4URw8ykL-hkvdYPW4RKvT3ikz6qAv6WMHFH2I=',
    };
    expect(
      readRedsysNotification(
        { ...config, merchantCode: '336704655' },
        accepted,
      ),
    ).toEqual({
      ok: true,
      charge: {
        provider: 'redsys',
        reference: '0000FB9A172',
        transactionId: '0000FB9A172/218048',
        outcome: 'succeeded',
        amountCents: 6700,
        currency: 'EUR',
        response: '0000',
      },
    });
    const cancelled = {
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      Ds_MerchantParameters:
        'eyJEc19EYXRlIjoiMTAlMkYwNiUyRjIwMTgiLCJEc19Ib3VyIjoiMjAlM0EyMCIsIkRzX1NlY3VyZVBheW1lbnQiOiIwIiwiRHNfQW1vdW50IjoiNjAwMCIsIkRzX0N1cnJlbmN5IjoiOTc4IiwiRHNfT3JkZXIiOiIwMDAwNTcyNzkxRCIsIkRzX01lcmNoYW50Q29kZSI6IjM0NjM4MTkwOCIsIkRzX1Rlcm1pbmFsIjoiMDAxIiwiRHNfUmVzcG9uc2UiOiI5OTE1IiwiRHNfTWVyY2hhbnREYXRhIjoiIiwiRHNfVHJhbnNhY3Rpb25UeXBlIjoiMCIsIkRzX0NvbnN1bWVyTGFuZ3VhZ2UiOiIxIiwiRHNfRXJyb3JDb2RlIjoiU0lTOTkxNSIsIkRzX0F1dGhvcmlzYXRpb25Db2RlIjoiKysrKysrIn0=',
      Ds_Signature: 'qJ0OTUI5YMuyHEdt0uxVZ-nlYFqKlMXXlc9WT-4auCs=',
    };
    expect(
      readRedsysNotification(
        { ...config, merchantCode: '346381908' },
        cancelled,
      ),
    ).toEqual({
      ok: true,
      charge: {
        provider: 'redsys',
        reference: '0000572791D',
        transactionId: '0000572791D/r9915',
        outcome: 'declined',
        amountCents: 6000,
        currency: 'EUR',
        response: '9915',
      },
    });
  });

  it('una firma cambiada, otra clave o parámetros tocados no valen', () => {
    const tampered = {
      ...DOC_NOTIFICATION,
      Ds_Signature: DOC_NOTIFICATION.Ds_Signature.replace('6DV', '6DW'),
    };
    expect(readRedsysNotification(DOC_CONFIG, tampered)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
    expect(
      readRedsysNotification(
        { ...DOC_CONFIG, secretKey: SANDBOX_KEY },
        DOC_NOTIFICATION,
      ),
    ).toEqual({ ok: false, reason: 'bad_signature' });
    // Importe alterado: el texto cambia y la firma deja de cuadrar.
    const params = decodeMerchantParameters(
      DOC_NOTIFICATION.Ds_MerchantParameters,
    )!;
    const altered = encodeMerchantParameters({ ...params, Ds_Amount: '1' });
    expect(
      readRedsysNotification(DOC_CONFIG, {
        ...DOC_NOTIFICATION,
        Ds_MerchantParameters: altered,
      }),
    ).toEqual({ ok: false, reason: 'bad_signature' });
    expect(
      readRedsysNotification(DOC_CONFIG, {
        ...DOC_NOTIFICATION,
        Ds_SignatureVersion: 'HMAC_SHA512_V2',
      }),
    ).toEqual({ ok: false, reason: 'bad_signature' });
    expect(readRedsysNotification(DOC_CONFIG, {})).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
    expect(sameSignature('AAAA', 'AAAA')).toBe(false);
    expect(sameSignature('x'.repeat(44), '<script>')).toBe(false);
  });

  it('firmada bien pero de otro comercio o de otro tipo: no es un cobro nuestro', () => {
    expect(
      readRedsysNotification(
        { ...DOC_CONFIG, merchantCode: '123456789' },
        DOC_NOTIFICATION,
      ),
    ).toEqual({ ok: false, reason: 'wrong_merchant' });
    expect(
      readRedsysNotification(
        { ...DOC_CONFIG, terminal: '1' },
        DOC_NOTIFICATION,
      ),
    ).toEqual({ ok: false, reason: 'wrong_merchant' });
    const params = decodeMerchantParameters(
      DOC_NOTIFICATION.Ds_MerchantParameters,
    )!;
    const refund = signRedsysRequest(
      { secretKey: DOC_KEY },
      {
        ...params,
        DS_MERCHANT_ORDER: params.Ds_Order!,
        Ds_TransactionType: '3',
      },
    );
    expect(readRedsysNotification(DOC_CONFIG, refund)).toEqual({
      ok: false,
      reason: 'not_a_charge',
    });
  });
});

describe('formulario de pago', () => {
  const config = { ...DOC_CONFIG, merchantName: 'L’Atelier du Désert' };
  const form = redsysPaymentForm(config, {
    reference: '123456789012',
    amountCents: 5485,
    locale: 'ca',
    description: 'Comanda núm. 1001',
    notificationUrl: 'https://latelierdudesert.com/api/pagos/redsys',
    okUrl:
      'https://latelierdudesert.com/api/pagos/redsys/retorno?resultado=ok&idioma=ca',
    koUrl:
      'https://latelierdudesert.com/api/pagos/redsys/retorno?resultado=ko&idioma=ca',
  });

  it('va al entorno elegido con importe, referencia, idioma y URL de aviso', () => {
    expect(form.url).toBe('https://sis-t.redsys.es:25443/sis/realizarPago');
    expect(
      redsysPaymentForm(
        { ...config, environment: 'live' },
        {
          reference: '123456789012',
          amountCents: 1,
          locale: 'es',
          description: '',
          notificationUrl: '',
          okUrl: '',
          koUrl: '',
        },
      ).url,
    ).toBe('https://sis.redsys.es/sis/realizarPago');
    expect(decodeMerchantParameters(form.fields.Ds_MerchantParameters)).toEqual(
      {
        DS_MERCHANT_AMOUNT: '5485',
        DS_MERCHANT_ORDER: '123456789012',
        DS_MERCHANT_MERCHANTCODE: '999008881',
        DS_MERCHANT_CURRENCY: '978',
        DS_MERCHANT_TRANSACTIONTYPE: '0',
        DS_MERCHANT_TERMINAL: '871',
        DS_MERCHANT_MERCHANTURL:
          'https://latelierdudesert.com/api/pagos/redsys',
        DS_MERCHANT_URLOK:
          'https://latelierdudesert.com/api/pagos/redsys/retorno?resultado=ok&idioma=ca',
        DS_MERCHANT_URLKO:
          'https://latelierdudesert.com/api/pagos/redsys/retorno?resultado=ko&idioma=ca',
        DS_MERCHANT_CONSUMERLANGUAGE: '3',
        DS_MERCHANT_PRODUCTDESCRIPTION: 'Comanda núm. 1001',
        DS_MERCHANT_MERCHANTNAME: 'L’Atelier du Désert',
      },
    );
  });

  it('los acentos viajan escapados en el JSON y la firma es la del banco', () => {
    const json = Buffer.from(
      form.fields.Ds_MerchantParameters,
      'base64',
    ).toString('utf8');
    expect(json).toMatch(/^[\x20-\x7e]+$/);
    expect(json).toContain('n\\u00fam.');
    expect(form.fields.Ds_Signature).toBe(
      redsysSign(DOC_KEY, '123456789012', form.fields.Ds_MerchantParameters),
    );
  });
});

describe('reglas del protocolo', () => {
  it.each([
    ['0000', 'succeeded'],
    ['0099', 'succeeded'],
    ['99', 'succeeded'],
    ['0100', 'declined'],
    ['0190', 'declined'],
    ['9915', 'declined'],
    ['', null],
    ['OK', null],
    [undefined, null],
  ])('Ds_Response %s → %s', (code, outcome) => {
    expect(redsysChargeOutcome(code)).toBe(outcome);
  });

  it('devolución aceptada solo con 0900', () => {
    expect(redsysRefundAccepted('0900')).toBe(true);
    expect(redsysRefundAccepted('0000')).toBe(false);
    expect(redsysRefundAccepted('0950')).toBe(false);
  });

  it('moneda, importe, terminal e identificador de la operación', () => {
    expect(redsysCurrency('978')).toBe('EUR');
    expect(redsysCurrency('840')).toBe('XXX');
    expect(redsysAmount('5485')).toBe(5485);
    expect(redsysAmount('0')).toBeNull();
    expect(redsysAmount('12.5')).toBeNull();
    expect(redsysAmount('99999999999')).toBeNull();
    expect(sameTerminal('001', '1')).toBe(true);
    expect(sameTerminal('2', '1')).toBe(false);
    expect(
      redsysTransactionId({
        order: '1',
        authorisationCode: '++++++',
        response: '0190',
      }),
    ).toBe('1/r0190');
  });

  it('configuración: todo o nada, y el entorno siempre explícito', () => {
    const env = {
      REDSYS_MERCHANT_CODE: '999008881',
      REDSYS_TERMINAL: '1',
      REDSYS_SECRET_KEY: SANDBOX_KEY,
      REDSYS_ENVIRONMENT: 'test',
    };
    expect(redsysConfig(env)).toMatchObject({
      merchantCode: '999008881',
      environment: 'test',
      merchantName: 'L’Atelier du Désert',
    });
    expect(redsysConfig({ ...env, REDSYS_ENVIRONMENT: undefined })).toBeNull();
    expect(redsysConfig({ ...env, REDSYS_ENVIRONMENT: 'prod' })).toBeNull();
    expect(redsysConfig({ ...env, REDSYS_SECRET_KEY: 'corta' })).toBeNull();
    expect(redsysConfig({ ...env, REDSYS_MERCHANT_CODE: '12' })).toBeNull();
    expect(redsysConfig({})).toBeNull();
  });
});

describe('devoluciones por la API REST', async () => {
  const { redsysRefund, redsysRestUrl } =
    await import('@/modules/payments/server/refund');
  const config = { ...DOC_CONFIG, terminal: '1' };
  /** Respuesta del banco firmada con la clave del comercio. */
  const bank = (params: Record<string, string>) =>
    signRedsysRequest(
      { secretKey: DOC_KEY },
      { ...params, DS_MERCHANT_ORDER: params.Ds_Order ?? '' },
    );
  const answer = (body: unknown, status = 200) =>
    vi.fn(async () => Response.json(body, { status }));
  const refund = { reference: '123456789012', amountCents: 4990 };
  const accepted = {
    Ds_Amount: '4990',
    Ds_Currency: '978',
    Ds_Order: '123456789012',
    Ds_MerchantCode: '999008881',
    Ds_Terminal: '1',
    Ds_Response: '0900',
    Ds_TransactionType: '3',
  };

  it('pide una devolución firmada (tipo 3) por el importe y la referencia', async () => {
    const fetcher = answer(bank(accepted));
    expect(await redsysRefund(config, refund, fetcher)).toEqual({
      status: 'succeeded',
      code: '0900',
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://sis-t.redsys.es:25443/sis/rest/trataPeticionREST',
    );
    const sent = JSON.parse(String(init.body));
    expect(decodeMerchantParameters(sent.Ds_MerchantParameters)).toEqual({
      DS_MERCHANT_AMOUNT: '4990',
      DS_MERCHANT_ORDER: '123456789012',
      DS_MERCHANT_MERCHANTCODE: '999008881',
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '3',
      DS_MERCHANT_TERMINAL: '1',
    });
    expect(sent.Ds_Signature).toBe(
      redsysSign(DOC_KEY, '123456789012', sent.Ds_MerchantParameters),
    );
  });

  it('el banco la rechaza: con su código, o con un error SIS', async () => {
    expect(
      await redsysRefund(
        config,
        refund,
        answer(bank({ ...accepted, Ds_Response: '0950' })),
      ),
    ).toEqual({ status: 'failed', code: '0950' });
    expect(
      await redsysRefund(config, refund, answer({ errorCode: 'SIS0057' })),
    ).toEqual({ status: 'failed', code: 'SIS0057' });
  });

  it('sin respuesta clara nunca se da por hecha ni por rechazada', async () => {
    const forged = bank(accepted);
    forged.Ds_Signature = forged.Ds_Signature.replace(/^./, (c) =>
      c === 'A' ? 'B' : 'A',
    );
    for (const [fetcher, code] of [
      [answer(forged), 'bad_signature'],
      [answer(bank({ ...accepted, Ds_Amount: '1' })), 'mismatch'],
      [answer(bank({ ...accepted, Ds_Order: '999999999999' })), 'mismatch'],
      [answer({}, 502), 'http_502'],
      [vi.fn(async () => new Response('no es json')), 'invalid_response'],
      [
        vi.fn(async () => {
          throw new Error('sin red');
        }),
        'network',
      ],
    ] as const)
      expect(await redsysRefund(config, refund, fetcher)).toEqual({
        status: 'unknown',
        code,
      });
  });

  it('el banco simulado solo se puede usar en el entorno de pruebas', () => {
    const env = { REDSYS_TEST_REST_URL: 'http://localhost:3999/rest' };
    expect(redsysRestUrl({ environment: 'test' }, env)).toBe(
      'http://localhost:3999/rest',
    );
    expect(redsysRestUrl({ environment: 'live' }, env)).toBe(
      'https://sis.redsys.es/sis/rest/trataPeticionREST',
    );
  });
});
