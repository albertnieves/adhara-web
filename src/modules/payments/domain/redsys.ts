/*
 * Redsys por redirección (DECISIONS §137). Reglas puras del protocolo: las
 * firmas y la lectura de la notificación están en server/redsys.ts. Fuente:
 * guía de integración por redirección de Redsys (HMAC_SHA256_V1) y los
 * vectores de su documentación que reproducen las pruebas unitarias.
 */

export const REDSYS_PROVIDER = 'redsys';
export const REDSYS_SIGNATURE_VERSION = 'HMAC_SHA256_V1';
/** Euro en ISO 4217 numérico. */
export const REDSYS_CURRENCY_EUR = '978';
/** Autorización (cargo normal) y devolución automática. */
export const REDSYS_AUTHORIZATION = '0';
export const REDSYS_REFUND = '3';

export const REDSYS_ENVIRONMENTS = ['test', 'live'] as const;
export type RedsysEnvironment = (typeof REDSYS_ENVIRONMENTS)[number];

/** Página de pago del banco (el cliente teclea ahí la tarjeta, nunca aquí). */
export const REDSYS_PAYMENT_URL: Readonly<Record<RedsysEnvironment, string>> = {
  test: 'https://sis-t.redsys.es:25443/sis/realizarPago',
  live: 'https://sis.redsys.es/sis/realizarPago',
};

/** Operaciones servidor a servidor (devoluciones, P06). */
export const REDSYS_REST_URL: Readonly<Record<RedsysEnvironment, string>> = {
  test: 'https://sis-t.redsys.es:25443/sis/rest/trataPeticionREST',
  live: 'https://sis.redsys.es/sis/rest/trataPeticionREST',
};

/** Idioma de la página del banco: 1 castellano, 2 inglés, 3 catalán. */
export const REDSYS_LANGUAGE: Readonly<Record<'es' | 'ca' | 'en', string>> = {
  es: '1',
  ca: '3',
  en: '2',
};

/**
 * Resultado de un cargo según Ds_Response: 0000–0099 autorizado; cualquier
 * otro número, denegado o cancelado (p. ej. 9915, el cliente canceló). Sin un
 * número válido no se interpreta.
 */
export function redsysChargeOutcome(
  response: string | undefined,
): 'succeeded' | 'declined' | null {
  if (!response || !/^\d{1,4}$/.test(response.trim())) return null;
  return Number(response) <= 99 ? 'succeeded' : 'declined';
}

/** Devolución aceptada: Ds_Response 0900. */
export function redsysRefundAccepted(response: string | undefined): boolean {
  return Boolean(
    response && /^\d{1,4}$/.test(response) && Number(response) === 900,
  );
}

/** Moneda de la notificación en ISO alfabético; XXX si no es el euro. */
export function redsysCurrency(code: string | undefined): string {
  return code?.trim() === REDSYS_CURRENCY_EUR ? 'EUR' : 'XXX';
}

/** Importe en céntimos («145» → 145) o null si no es un entero positivo. */
export function redsysAmount(value: string | undefined): number | null {
  if (!value || !/^\d{1,10}$/.test(value.trim())) return null;
  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 2_147_483_647
    ? cents
    : null;
}

/** Terminales «1», «01» y «001» son el mismo. */
export function sameTerminal(a: string | undefined, b: string): boolean {
  return Boolean(a && /^\d{1,3}$/.test(a.trim()) && Number(a) === Number(b));
}

/**
 * Identificador de la operación para la base (único por proveedor y
 * resultado): el número de pedido del banco más el código de autorización, o
 * el código de respuesta si no hay autorización. Un reintento de la misma
 * notificación da el mismo identificador y no tiene efecto.
 */
export function redsysTransactionId(params: {
  order: string;
  authorisationCode?: string;
  response: string;
}): string {
  const code = params.authorisationCode?.trim();
  const auth = code && /^[A-Za-z0-9]{1,12}$/.test(code) ? code : null;
  return `${params.order}/${auth ?? `r${params.response.trim()}`}`;
}
