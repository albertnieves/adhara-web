import { cronGuard } from '@/lib/cron';
import { createOrdersClient } from '@/lib/supabase/privileged';

/**
 * Tarea programada (Vercel Cron cada 5 minutos, vercel.json; posible con el
 * plan Pro, DECISIONS §134): devuelve al stock las reservas de los pedidos web
 * que caducaron sin pago (web_order_release_expired). Solo responde a quien
 * envía CRON_SECRET; sin él configurado, no hace nada.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const supabase = createOrdersClient();
  if (!supabase)
    return Response.json(
      { ok: false, message: 'Supabase no configurado' },
      { status: 503 },
    );
  // Tandas de 200 hasta vaciar la cola (con un tope): si alguien deja muchos
  // pedidos sin pagar, sus reservas no se quedan esperando a la siguiente
  // pasada (DECISIONS §160).
  let released = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data, error } = await supabase.rpc('web_order_release_expired', {
      p_limit: BATCH,
    });
    if (error) {
      console.error(
        '[pedidos] caducidad de reservas',
        error.code,
        error.message,
      );
      return Response.json({ ok: false, released }, { status: 500 });
    }
    released += data ?? 0;
    if ((data ?? 0) < BATCH) break;
  }
  return Response.json({ ok: true, released });
}

const BATCH = 200;
const MAX_BATCHES = 25;
