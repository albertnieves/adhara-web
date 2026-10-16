import { cronGuard } from '@/lib/cron';
import { sendOrderEmails } from '@/modules/mail/server';
import { sendMessageEmails } from '@/modules/messaging/server';

/**
 * Tarea programada (Vercel Cron cada 5 minutos, vercel.json): envía los
 * correos de los pedidos (P06) y las respuestas de la bandeja de mensajes
 * (A6.1) que sigan en la cola. Normalmente ya salen al confirmarse el pago,
 * cambiar la entrega o responder desde el panel; esto recoge los que fallaron
 * o esperaban al proveedor. Solo responde a quien envía CRON_SECRET.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const orders = await sendOrderEmails(25);
  const messages = await sendMessageEmails(25);
  return Response.json({ ok: true, ...orders, messages });
}
