import { z } from 'zod';
import { requirePermission } from '@/modules/auth/server';
import { downloadLabel } from '@/modules/shipping/server/sendcloud/api';
import { SendcloudError } from '@/modules/shipping/server/sendcloud/client';
import { sendcloudConfig } from '@/modules/shipping/server/sendcloud/config';

/**
 * Etiqueta en PDF de un envío del pedido, al momento desde la plataforma (no
 * se guarda): A6 para impresora de etiquetas o A4. orders.fulfill con MFA.
 */
export const dynamic = 'force-dynamic';

function text(status: number, body: string) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase } = await requirePermission('orders.fulfill');
  const { id } = await params;
  const url = new URL(request.url);
  const shipmentId = url.searchParams.get('envio');
  const paper = url.searchParams.get('papel') === 'A4' ? 'A4' : 'A6';
  if (
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(shipmentId).success
  )
    return text(400, 'Etiqueta no válida.');
  const { data: shipment } = await supabase
    .from('shipments')
    .select('provider, provider_parcel_id, status, orders!inner(number)')
    .eq('id', shipmentId as string)
    .eq('order_id', id)
    .maybeSingle();
  if (
    !shipment ||
    shipment.provider !== 'sendcloud' ||
    !shipment.provider_parcel_id
  )
    return text(
      404,
      'Esta etiqueta no es de la plataforma: está en la web del transportista.',
    );
  if (shipment.status === 'cancelled')
    return text(410, 'La etiqueta está cancelada.');
  const config = sendcloudConfig();
  if (!config) return text(503, 'Sendcloud no está conectado.');
  try {
    const pdf = await downloadLabel(config, shipment.provider_parcel_id, paper);
    const number = (shipment.orders as { number: number }).number;
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="etiqueta-pedido-${number}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return text(
      502,
      error instanceof SendcloudError
        ? `Sendcloud: ${error.message}`
        : 'No se pudo descargar la etiqueta.',
    );
  }
}
