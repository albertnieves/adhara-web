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
  const { data, error } = await supabase.rpc('web_order_release_expired', {
    p_limit: 200,
  });
  if (error) {
    console.error('[pedidos] caducidad de reservas', error.code, error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true, released: data });
}
