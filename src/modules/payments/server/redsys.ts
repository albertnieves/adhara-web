import 'server-only';
import { createCipheriv, createHmac, timingSafeEqual } from 'node:crypto';
import {
  REDSYS_AUTHORIZATION,
  REDSYS_CURRENCY_EUR,
  REDSYS_LANGUAGE,
  REDSYS_PAYMENT_URL,
  REDSYS_PROVIDER,
  REDSYS_SIGNATURE_VERSION,
  redsysAmount,
  redsysChargeOutcome,
  redsysCurrency,
  redsysTransactionId,
  sameTerminal,
} from '../domain/redsys';
import type { RedsysConfig } from './config';

/*
 * Firma HMAC_SHA256_V1 de Redsys: la clave de cada operación es el número de
 * pedido cifrado con 3DES-CBC (IV a ceros, relleno con ceros) con la clave
 * del comercio, y la firma es el HMAC-SHA256 de Ds_MerchantParameters (el
 * texto en base64, tal cual) con esa clave, en base64. Las notificaciones
 * llegan en base64 URL; se comparan los bytes, no el texto.
 */

/** Clave de una operación (número de pedido del banco). */
export function redsysOrderKey(secretKey: string, order: string): Buffer {
  const data = Buffer.from(order, 'utf8');
  const padded = Buffer.concat([
    data,
    Buffer.alloc((8 - (data.length % 8)) % 8),
  ]);
  const cipher = createCipheriv(
    'des-ede3-cbc',
    Buffer.from(secretKey, 'base64'),
    Buffer.alloc(8),
  );
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]);
}

/** Firma de Ds_MerchantParameters para un número de pedido, en base64. */
export function redsysSign(
  secretKey: string,
  order: string,
  merchantParameters: string,
): string {
  return createHmac('sha256', redsysOrderKey(secretKey, order))
    .update(merchantParameters)
    .digest('base64');
}

/**
 * Parámetros en JSON y base64. Los caracteres no ASCII van escapados
 * (\uXXXX): JSON válido que el banco lee igual en cualquier codificación.
 */
export function encodeMerchantParameters(
  params: Readonly<Record<string, string>>,
): string {
  const json = JSON.stringify(params).replace(
    /[\u0080-￿]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  return Buffer.from(json, 'utf8').toString('base64');
}

/** Lee Ds_MerchantParameters (base64 o base64 URL); null si no es JSON plano. */
export function decodeMerchantParameters(
  value: string,
): Record<string, string> | null {
  if (!value || value.length > 8192 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value))
    return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      Buffer.from(
        value.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8'),
    );
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return null;
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(parsed)) {
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    let text = String(raw);
    // Las notificaciones traen los valores codificados como en una URL.
    try {
      text = decodeURIComponent(text.replace(/\+/g, ' '));
    } catch {
      // Se queda como llegó.
    }
    result[key] = text;
  }
  return result;
}

/** Igualdad de firmas en tiempo constante, aceptando base64 y base64 URL. */
export function sameSignature(expected: string, received: string): boolean {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(received)) return false;
  const a = Buffer.from(expected, 'base64');
  const b = Buffer.from(
    received.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );
  return a.length === 32 && a.length === b.length && timingSafeEqual(a, b);
}

/** Campo sin distinguir mayúsculas (Ds_Order, DS_ORDER). */
function field(params: Record<string, string>, name: string) {
  const key = Object.keys(params).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : params[key];
}

export type SignedMessage = {
  Ds_SignatureVersion: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
};

/**
 * Comprueba la firma de un mensaje del banco (notificación o respuesta REST)
 * y devuelve sus parámetros, o null si no es auténtico.
 */
export function verifyRedsysMessage(
  config: Pick<RedsysConfig, 'secretKey'>,
  message: Partial<SignedMessage>,
): Record<string, string> | null {
  if (message.Ds_SignatureVersion !== REDSYS_SIGNATURE_VERSION) return null;
  const encoded = message.Ds_MerchantParameters ?? '';
  const params = decodeMerchantParameters(encoded);
  const order = params && field(params, 'Ds_Order');
  if (!params || !order || !/^[A-Za-z0-9]{4,12}$/.test(order)) return null;
  const expected = redsysSign(config.secretKey, order, encoded);
  return sameSignature(expected, message.Ds_Signature ?? '') ? params : null;
}

/** Mensaje firmado para el banco (formulario de pago o petición REST). */
export function signRedsysRequest(
  config: Pick<RedsysConfig, 'secretKey'>,
  params: Readonly<Record<string, string>>,
): SignedMessage {
  const order = params.DS_MERCHANT_ORDER ?? '';
  const encoded = encodeMerchantParameters(params);
  return {
    Ds_SignatureVersion: REDSYS_SIGNATURE_VERSION,
    Ds_MerchantParameters: encoded,
    Ds_Signature: redsysSign(config.secretKey, order, encoded),
  };
}

export type PaymentForm = { url: string; fields: SignedMessage };

/**
 * Formulario que el navegador envía al banco para pagar un intento. El
 * importe y la referencia salen de la base (web_order_create o
 * web_order_new_attempt), nunca del navegador.
 */
export function redsysPaymentForm(
  config: RedsysConfig,
  payment: {
    reference: string;
    amountCents: number;
    locale: 'es' | 'ca' | 'en';
    description: string;
    notificationUrl: string;
    okUrl: string;
    koUrl: string;
  },
): PaymentForm {
  return {
    url: REDSYS_PAYMENT_URL[config.environment],
    fields: signRedsysRequest(config, {
      DS_MERCHANT_AMOUNT: String(payment.amountCents),
      DS_MERCHANT_ORDER: payment.reference,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: REDSYS_CURRENCY_EUR,
      DS_MERCHANT_TRANSACTIONTYPE: REDSYS_AUTHORIZATION,
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: payment.notificationUrl,
      DS_MERCHANT_URLOK: payment.okUrl,
      DS_MERCHANT_URLKO: payment.koUrl,
      DS_MERCHANT_CONSUMERLANGUAGE: REDSYS_LANGUAGE[payment.locale],
      DS_MERCHANT_PRODUCTDESCRIPTION: payment.description.slice(0, 125),
      DS_MERCHANT_MERCHANTNAME: config.merchantName.slice(0, 25),
    }),
  };
}

export type ChargeNotification = {
  provider: typeof REDSYS_PROVIDER;
  reference: string;
  transactionId: string;
  outcome: 'succeeded' | 'declined';
  amountCents: number;
  currency: string;
  /** Ds_Response tal cual, para la cronología del pedido. */
  response: string;
};

export type NotificationResult =
  | { ok: true; charge: ChargeNotification }
  | {
      ok: false;
      reason: 'bad_signature' | 'wrong_merchant' | 'not_a_charge' | 'invalid';
    };

/**
 * Notificación online del banco (POST con Ds_SignatureVersion,
 * Ds_MerchantParameters y Ds_Signature). Solo es un cobro de este comercio
 * si la firma es buena y coinciden comercio, terminal y tipo de operación;
 * lo demás se descarta sin tocar la base.
 */
export function readRedsysNotification(
  config: RedsysConfig,
  message: Partial<SignedMessage>,
): NotificationResult {
  const params = verifyRedsysMessage(config, message);
  if (!params) return { ok: false, reason: 'bad_signature' };
  const get = (name: string) => field(params, name)?.trim();
  if (
    get('Ds_MerchantCode') !== config.merchantCode ||
    !sameTerminal(get('Ds_Terminal'), config.terminal)
  )
    return { ok: false, reason: 'wrong_merchant' };
  if (get('Ds_TransactionType') !== REDSYS_AUTHORIZATION)
    return { ok: false, reason: 'not_a_charge' };
  const reference = get('Ds_Order') ?? '';
  const response = get('Ds_Response') ?? '';
  const outcome = redsysChargeOutcome(response);
  const amountCents = redsysAmount(get('Ds_Amount'));
  if (!outcome || amountCents === null) return { ok: false, reason: 'invalid' };
  return {
    ok: true,
    charge: {
      provider: REDSYS_PROVIDER,
      reference,
      transactionId: redsysTransactionId({
        order: reference,
        authorisationCode: get('Ds_AuthorisationCode'),
        response,
      }),
      outcome,
      amountCents,
      currency: redsysCurrency(get('Ds_Currency')),
      response,
    },
  };
}
