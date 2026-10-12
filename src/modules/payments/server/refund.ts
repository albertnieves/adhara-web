import 'server-only';
import {
  REDSYS_CURRENCY_EUR,
  REDSYS_REFUND,
  REDSYS_REST_URL,
  redsysRefundAccepted,
} from '../domain/redsys';
import type { RedsysConfig } from './config';
import { signRedsysRequest, verifyRedsysMessage } from './redsys';

export type RefundOutcome = {
  status: 'succeeded' | 'failed' | 'unknown';
  /** Ds_Response o el código SIS del banco; el motivo si no hubo respuesta. */
  code: string;
};

/**
 * Dirección de las operaciones REST. Solo en el entorno de pruebas se puede
 * apuntar a otra (REDSYS_TEST_REST_URL, el banco simulado de las pruebas):
 * con el entorno real siempre es la de Redsys.
 */
export function redsysRestUrl(
  config: Pick<RedsysConfig, 'environment'>,
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env.REDSYS_TEST_REST_URL?.trim();
  return config.environment === 'test' && override
    ? override
    : REDSYS_REST_URL[config.environment];
}

/**
 * Devolución (tipo 3) de un cobro por la API REST de Redsys. Solo la
 * respuesta firmada del banco con 0900 la da por hecha; un error SIS es un
 * rechazo, y cualquier otra cosa (sin red, sin respuesta, firma que no
 * cuadra) queda como «sin respuesta clara» para comprobarla en el portal.
 */
export async function redsysRefund(
  config: RedsysConfig,
  refund: { reference: string; amountCents: number },
  fetcher: typeof fetch = fetch,
): Promise<RefundOutcome> {
  const message = signRedsysRequest(config, {
    DS_MERCHANT_AMOUNT: String(refund.amountCents),
    DS_MERCHANT_ORDER: refund.reference,
    DS_MERCHANT_MERCHANTCODE: config.merchantCode,
    DS_MERCHANT_CURRENCY: REDSYS_CURRENCY_EUR,
    DS_MERCHANT_TRANSACTIONTYPE: REDSYS_REFUND,
    DS_MERCHANT_TERMINAL: config.terminal,
  });
  let response: Response;
  try {
    response = await fetcher(redsysRestUrl(config), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { status: 'unknown', code: 'network' };
  }
  if (!response.ok)
    return { status: 'unknown', code: `http_${response.status}` };
  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return { status: 'unknown', code: 'invalid_response' };
  if (typeof body.errorCode === 'string' && body.errorCode)
    return { status: 'failed', code: body.errorCode.slice(0, 20) };
  const params = verifyRedsysMessage(config, {
    Ds_SignatureVersion: String(body.Ds_SignatureVersion ?? ''),
    Ds_MerchantParameters: String(body.Ds_MerchantParameters ?? ''),
    Ds_Signature: String(body.Ds_Signature ?? ''),
  });
  if (!params) return { status: 'unknown', code: 'bad_signature' };
  const get = (name: string) =>
    Object.entries(params)
      .find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]
      ?.trim();
  if (
    get('Ds_Order') !== refund.reference ||
    get('Ds_Amount') !== String(refund.amountCents) ||
    get('Ds_MerchantCode') !== config.merchantCode
  )
    return { status: 'unknown', code: 'mismatch' };
  const code = (get('Ds_Response') ?? '').slice(0, 20);
  return redsysRefundAccepted(code)
    ? { status: 'succeeded', code }
    : { status: 'failed', code: code || 'no_response' };
}
