/*
 * API REST de Redsys simulada para las pruebas del panel (devoluciones, P06).
 * Solo local: la arranca playwright.local.config.ts y la tienda la usa con
 * REDSYS_TEST_REST_URL, que el código solo acepta con REDSYS_ENVIRONMENT=test.
 * Firma sus respuestas con REDSYS_SECRET_KEY como el banco. POST /siguiente
 * con {"modo": "aceptar" | "rechazar" | "error_sis" | "sin_respuesta"} decide
 * la próxima respuesta; GET /peticiones devuelve lo que ha recibido.
 */
import { createCipheriv, createHmac } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_REDSYS_PORT ?? 3999);
type Mode = 'aceptar' | 'rechazar' | 'error_sis' | 'sin_respuesta';
let next: Mode = 'aceptar';
const received: Record<string, string>[] = [];

function sign(order: string, encoded: string) {
  const key = process.env.REDSYS_SECRET_KEY ?? '';
  const data = Buffer.from(order);
  const cipher = createCipheriv(
    'des-ede3-cbc',
    Buffer.from(key, 'base64'),
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

function body(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = '';
    request.on('data', (chunk) => (text += chunk));
    request.on('end', () => resolve(text));
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  const json = (status: number, value: unknown) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(value));
  };
  if (request.method === 'GET' && request.url === '/health')
    return json(200, { ok: true });
  if (request.method === 'GET' && request.url === '/peticiones')
    return json(200, received);
  if (request.method === 'POST' && request.url === '/siguiente') {
    next = (JSON.parse(await body(request)) as { modo: Mode }).modo;
    return json(200, { ok: true, modo: next });
  }
  if (
    request.method !== 'POST' ||
    request.url !== '/sis/rest/trataPeticionREST'
  )
    return json(404, {});

  const message = JSON.parse(await body(request)) as Record<string, string>;
  const encoded = message.Ds_MerchantParameters ?? '';
  const params = JSON.parse(
    Buffer.from(encoded, 'base64').toString('utf8'),
  ) as Record<string, string>;
  const order = params.DS_MERCHANT_ORDER ?? '';
  if (message.Ds_Signature !== sign(order, encoded))
    return json(200, { errorCode: 'SIS0042' });
  received.push(params);
  const mode = next;
  next = 'aceptar';
  if (mode === 'sin_respuesta') return json(504, {});
  if (mode === 'error_sis') return json(200, { errorCode: 'SIS0057' });
  const answer = {
    Ds_Amount: params.DS_MERCHANT_AMOUNT,
    Ds_Currency: params.DS_MERCHANT_CURRENCY,
    Ds_Order: order,
    Ds_MerchantCode: params.DS_MERCHANT_MERCHANTCODE,
    Ds_Terminal: params.DS_MERCHANT_TERMINAL,
    Ds_Response: mode === 'rechazar' ? '0950' : '0900',
    Ds_TransactionType: params.DS_MERCHANT_TRANSACTIONTYPE,
    Ds_AuthorisationCode: '654321',
  };
  const encodedAnswer = Buffer.from(JSON.stringify(answer)).toString('base64');
  return json(200, {
    Ds_SignatureVersion: 'HMAC_SHA256_V1',
    Ds_MerchantParameters: encodedAnswer,
    Ds_Signature: sign(order, encodedAnswer),
  });
});

server.listen(PORT, 'localhost');
