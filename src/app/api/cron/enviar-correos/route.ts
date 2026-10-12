import { cronGuard } from '@/lib/cron';
import { sendOrderEmails } from '@/modules/mail/server';

/**
 * Tarea programada (Vercel Cron cada 5 minutos, vercel.json): envía los
 * correos de los pedidos que sigan en la cola (P06). Normalmente ya salen al
 * confirmarse el pago o cambiar la entrega; esto recoge los que fallaron o
 * esperaban al proveedor. Solo responde a quien envía CRON_SECRET.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const result = await sendOrderEmails(25);
  return Response.json({ ok: true, ...result });
}
