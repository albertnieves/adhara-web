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

/**
 * Primer detalle legible de un error de la API: {errors: [{detail}]} en los
 * recursos y {error: {message}} en la puerta de entrada de la API v3 (la que
 * contesta 401 a unas claves que no valen).
 */
export function errorDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const errors = (body as { errors?: unknown }).errors;
  if (Array.isArray(errors)) {
    const first = errors[0] as
      { detail?: unknown; title?: unknown } | undefined;
    const text = first?.detail ?? first?.title;
    if (typeof text === 'string') return text.slice(0, 300);
  }
  const error = (body as { error?: unknown }).error;
  if (typeof error === 'string') return error.slice(0, 300);
  if (error && typeof error === 'object') {
    const text = (error as { message?: unknown }).message;
    if (typeof text === 'string') return text.slice(0, 300);
  }
  const message = (body as { message?: unknown }).message;
  return typeof message === 'string' ? message.slice(0, 300) : null;
}

/**
 * Lo que ve el panel de un error de la API (detrás de «Sendcloud: »), con el
 * código HTTP: un 401 son las claves y un 403, un permiso o el plan.
 */
export function errorMessage(status: number, body: unknown): string {
  const detail = errorDetail(body);
  const said = detail ? `: «${detail}»` : '';
  if (status === 401)
    return `las claves de la integración no valen (401${said}). Revisa SENDCLOUD_PUBLIC_KEY y SENDCLOUD_SECRET_KEY en Vercel y que la integración «Sendcloud API» no exija OAuth2.`;
  if (status === 403)
    return `estas claves no tienen permiso para esta operación (403${said}): puede ser un permiso de la integración o el plan de la cuenta.`;
  return detail ? `${detail} (${status})` : `respondió ${status}.`;
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
    const message = errorMessage(response.status, data);
    // Sin datos del pedido ni claves: solo la ruta, el código y el motivo.
    console.warn('[envios] Sendcloud', path, response.status, message);
    throw new SendcloudError(response.status, message);
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
