import 'server-only';
import type { SendcloudConfig } from './config';

/*
 * Peticiones a la API v3 de Sendcloud sin SDK: autenticación básica con las
 * claves de la integración, 20 s de espera como mucho y la respuesta en JSON
 * (o en bytes, para las etiquetas). Nada de esto llega al navegador.
 */

export class SendcloudError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SendcloudError';
  }
}

function authorization(config: SendcloudConfig): string {
  return `Basic ${Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64')}`;
}

/** Primer detalle legible de un error de la API ({errors: [{detail}]}). */
function errorDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const errors = (body as { errors?: unknown }).errors;
  if (Array.isArray(errors)) {
    const first = errors[0] as
      { detail?: unknown; title?: unknown } | undefined;
    const text = first?.detail ?? first?.title;
    if (typeof text === 'string') return text.slice(0, 300);
  }
  const message = (body as { message?: unknown }).message;
  return typeof message === 'string' ? message.slice(0, 300) : null;
}

export async function sendcloudJson<T = unknown>(
  config: SendcloudConfig,
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<{ status: number; data: T }> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBase}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: authorization(config),
        Accept: 'application/json',
        ...(init.body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    });
  } catch (error) {
    throw new SendcloudError(
      0,
      error instanceof Error && error.name === 'TimeoutError'
        ? 'Sendcloud no respondió a tiempo.'
        : 'No se pudo conectar con Sendcloud.',
    );
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    throw new SendcloudError(
      response.status,
      errorDetail(data) ??
        (response.status === 401 || response.status === 403
          ? 'Sendcloud rechazó las claves de la integración.'
          : `Sendcloud respondió ${response.status}.`),
    );
  }
  return { status: response.status, data: data as T };
}

export async function sendcloudBytes(
  config: SendcloudConfig,
  path: string,
  accept: string,
): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBase}${path}`, {
      headers: { Authorization: authorization(config), Accept: accept },
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    });
  } catch {
    throw new SendcloudError(0, 'No se pudo conectar con Sendcloud.');
  }
  if (!response.ok)
    throw new SendcloudError(
      response.status,
      `Sendcloud respondió ${response.status} al pedir la etiqueta.`,
    );
  return response.arrayBuffer();
}
