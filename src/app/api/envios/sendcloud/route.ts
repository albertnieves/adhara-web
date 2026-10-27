import { after } from 'next/server';
import { createShippingClient } from '@/lib/supabase/privileged';
import { sendOrderEmails } from '@/modules/mail/server';
import { parseParcelEvent } from '@/modules/shipping';
import { sendcloudConfig } from '@/modules/shipping/server/sendcloud/config';
import { validSendcloudSignature } from '@/modules/shipping/server/webhook';

/**
 * Avisos de seguimiento de Sendcloud (DECISIONS §175): cada cambio de estado
 * de un paquete creado por la tienda llega firmado. Primero la firma; después
 * web_shipment_event apunta el estado (sin repetir los reintentos) y avanza el
 * pedido: en camino → «Enviado» (con el correo y el seguimiento), entregado →
 * «Completado». No se guardan la dirección ni el destinatario del aviso.
 * Mientras la base no lo confirma no se responde 200, así la plataforma
 * reintenta.
 */
export const dynamic = 'force-dynamic';

const MAX_BODY = 64 * 1024;

export async function POST(request: Request) {
  const config = sendcloudConfig();
  if (!config) return new Response(null, { status: 503 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY)
    return new Response(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
  if (
    !validSendcloudSignature(
      raw,
      request.headers.get('sendcloud-signature'),
      config.webhookSecret,
    )
  )
    return new Response(null, { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const event = parseParcelEvent(body);
  // Firmado pero sin un cambio de estado que importe (prueba, integración…).
  if (!event) return new Response('OK', { status: 200 });

  const supabase = createShippingClient();
  if (!supabase) return new Response(null, { status: 503 });
  const { data, error } = await supabase.rpc('web_shipment_event', {
    p_provider: 'sendcloud',
    p_parcel_id: event.parcelId,
    p_status: event.status,
    p_provider_status_id: event.providerStatusId as number,
    p_message: event.message,
    p_at: event.at,
    ...(event.trackingNumber && { p_tracking_number: event.trackingNumber }),
    ...(event.trackingUrl && { p_tracking_url: event.trackingUrl }),
  });
  if (error) {
    console.error(
      '[envios] no se pudo apuntar el aviso',
      error.code,
      error.message,
    );
    return new Response(null, { status: 500 });
  }
  const result = data as { known: boolean; order_status?: string };
  if (!result.known) console.warn('[envios] aviso de un paquete desconocido');
  // «Enviado» encola el correo con el seguimiento: sale después de responder.
  if (result.order_status === 'shipped')
    after(() => sendOrderEmails(5).then(() => undefined));
  return new Response('OK', { status: 200 });
}
