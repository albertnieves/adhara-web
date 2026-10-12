import { createOrdersClient } from '@/lib/supabase/privileged';
import { redsysConfig } from '@/modules/payments/server/config';
import { readRedsysNotification } from '@/modules/payments/server/redsys';

/**
 * Notificación online de Redsys (P04, DECISIONS §137): el banco avisa del
 * resultado de cada pago, servidor a servidor, aunque el cliente cierre la
 * pestaña. Es lo único que registra un cobro: primero la firma, el comercio,
 * el terminal y el tipo de operación; después web_order_record_payment
 * decide bajo el bloqueo del pedido. Hasta que la base confirma no se
 * responde 200, así el banco puede reintentar. No se guardan ni se escriben
 * en los registros los parámetros recibidos.
 */
export const dynamic = 'force-dynamic';

const MAX_BODY = 16 * 1024;

export async function POST(request: Request) {
  const config = redsysConfig();
  if (!config) return new Response(null, { status: 503 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY)
    return new Response(null, { status: 413 });

  let body: URLSearchParams;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return new Response(null, { status: 413 });
    body = new URLSearchParams(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const result = readRedsysNotification(config, {
    Ds_SignatureVersion: body.get('Ds_SignatureVersion') ?? undefined,
    Ds_MerchantParameters: body.get('Ds_MerchantParameters') ?? undefined,
    Ds_Signature: body.get('Ds_Signature') ?? undefined,
  });
  if (!result.ok) {
    console.warn('[pagos] notificación descartada:', result.reason);
    // Firmada por el banco pero no es un cobro de este comercio: recibida.
    return new Response(null, {
      status: result.reason === 'bad_signature' ? 400 : 200,
    });
  }

  const supabase = createOrdersClient();
  if (!supabase) return new Response(null, { status: 503 });
  const { charge } = result;
  const { data, error } = await supabase.rpc('web_order_record_payment', {
    p_provider: charge.provider,
    p_reference: charge.reference,
    p_transaction_id: charge.transactionId,
    p_outcome: charge.outcome,
    p_amount_cents: charge.amountCents,
    p_currency: charge.currency,
  });
  if (error) {
    console.error('[pagos] no se pudo registrar el cobro', error.code);
    return new Response(null, { status: 500 });
  }
  const decision = data as { action: string; reason: string | null };
  if (decision.action === 'reject' || decision.action === 'review')
    console.warn('[pagos] cobro', decision.action, decision.reason);
  return new Response('OK', { status: 200 });
}
