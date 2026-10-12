import { expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { createCipheriv, createHmac } from 'node:crypto';

/*
 * Banco simulado (P07): la página de pago de Redsys la sirve page.route y
 * sus notificaciones las firma esta prueba con la clave de un solo uso de
 * REDSYS_SECRET_KEY (e2e.yml la genera en cada ejecución). La firma está
 * escrita aquí aparte, sin el código de la tienda: si las dos coinciden con
 * los vectores del manual (tests/unit/redsys.test.ts), coinciden entre sí.
 */

export const GATEWAY = 'https://sis-t.redsys.es:25443/sis/realizarPago';

function key() {
  const value = process.env.REDSYS_SECRET_KEY;
  if (!value) throw new Error('Falta REDSYS_SECRET_KEY (TPV simulado)');
  return value;
}

export function merchantCode() {
  return process.env.REDSYS_MERCHANT_CODE ?? '';
}

function sign(order: string, encoded: string) {
  const data = Buffer.from(order);
  const cipher = createCipheriv(
    'des-ede3-cbc',
    Buffer.from(key(), 'base64'),
    Buffer.alloc(8),
  );
  cipher.setAutoPadding(false);
  const orderKey = Buffer.concat([
    cipher.update(
      Buffer.concat([data, Buffer.alloc((8 - (data.length % 8)) % 8)]),
    ),
    cipher.final(),
  ]);
  return createHmac('sha256', orderKey).update(encoded).digest('base64');
}

export type BankVisit = {
  params: Record<string, string>;
  /** La firma de la tienda coincide con la que calcula el banco. */
  signatureOk: boolean;
};

/** Sirve la página del banco y apunta cada formulario que le llega. */
export async function fakeBank(page: Page): Promise<BankVisit[]> {
  const visits: BankVisit[] = [];
  await page.route(GATEWAY, async (route) => {
    const form = new URLSearchParams(route.request().postData() ?? '');
    const encoded = form.get('Ds_MerchantParameters') ?? '';
    const params = JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf8'),
    ) as Record<string, string>;
    visits.push({
      params,
      signatureOk:
        form.get('Ds_SignatureVersion') === 'HMAC_SHA256_V1' &&
        form.get('Ds_Signature') ===
          sign(params.DS_MERCHANT_ORDER ?? '', encoded),
    });
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="es"><title>Banco simulado</title><main><h1>Banco simulado</h1></main></html>',
    });
  });
  return visits;
}

/** Espera a que el navegador llegue al banco y devuelve lo que envió. */
export async function nextVisit(
  page: Page,
  visits: BankVisit[],
  count: number,
) {
  await expect(
    page.getByRole('heading', { name: 'Banco simulado' }),
  ).toBeVisible();
  await expect.poll(() => visits.length).toBe(count);
  const visit = visits[count - 1]!;
  expect(visit.signatureOk, 'firma de la tienda').toBe(true);
  return visit.params;
}

export type Notification = {
  order: string;
  amount: string;
  response?: string;
  authorisation?: string;
  currency?: string;
  transactionType?: string;
  merchant?: string;
};

/** Cuerpo de una notificación online como la del banco (valores en URL). */
export function notificationBody(
  n: Notification,
  tamper?: (encoded: string) => string,
) {
  const params = {
    Ds_Date: encodeURIComponent('12/10/2026'),
    Ds_Hour: encodeURIComponent('18:03'),
    Ds_SecurePayment: '1',
    Ds_Amount: n.amount,
    Ds_Currency: n.currency ?? '978',
    Ds_Order: n.order,
    Ds_MerchantCode: n.merchant ?? merchantCode(),
    Ds_Terminal: '001',
    Ds_Response: n.response ?? '0000',
    Ds_MerchantData: '',
    Ds_TransactionType: n.transactionType ?? '0',
    Ds_ConsumerLanguage: '1',
    Ds_AuthorisationCode: n.authorisation ?? '123456',
  };
  const encoded = Buffer.from(JSON.stringify(params)).toString('base64');
  return {
    Ds_SignatureVersion: 'HMAC_SHA256_V1',
    Ds_MerchantParameters: tamper ? tamper(encoded) : encoded,
    // Como el banco: base64 URL.
    Ds_Signature: sign(n.order, encoded)
      .replace(/\+/g, '-')
      .replace(/\//g, '_'),
  };
}

/** El banco avisa a la tienda, servidor a servidor. */
export async function notify(
  request: APIRequestContext,
  body: Record<string, string>,
) {
  return request.post('/api/pagos/redsys', { form: body });
}
