/*
 * API de Resend simulada para las pruebas de la bandeja de mensajes (A6.1).
 * Solo local: la arranca playwright.local.config.ts y la tienda la usa con
 * RESEND_TEST_API_URL, que el código solo acepta si es una dirección local.
 * POST /__inbound guarda un correo «recibido» que después sirve
 * GET /emails/receiving/:id, como la API real (exige la clave en Bearer).
 */
import type { IncomingMessage } from 'node:http';
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_RESEND_PORT ?? 3998);
const received = new Map<string, unknown>();

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
  if (request.method === 'POST' && request.url === '/__inbound') {
    const email = JSON.parse(await body(request)) as { id: string };
    received.set(email.id, email);
    return json(200, { ok: true });
  }
  const match = /^\/emails\/receiving\/([^/?]+)$/.exec(request.url ?? '');
  if (request.method === 'GET' && match) {
    if (!/^Bearer \S+$/.test(request.headers.authorization ?? ''))
      return json(401, { name: 'missing_api_key' });
    const email = received.get(decodeURIComponent(match[1]!));
    return email
      ? json(200, { object: 'email', ...(email as object) })
      : json(404, { name: 'not_found' });
  }
  return json(404, {});
});

server.listen(PORT, 'localhost');
