import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/**
 * Tareas programadas (Vercel Cron): solo responden a quien envía
 * `Authorization: Bearer <CRON_SECRET>`. Sin secreto configurado, 503; con uno
 * que no coincide, 401. La comparación es de tiempo constante.
 */
export function cronGuard(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return Response.json(
      { ok: false, message: 'CRON_SECRET no configurado' },
      { status: 503 },
    );
  const header = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (header.length !== expected.length || !timingSafeEqual(header, expected))
    return Response.json({ ok: false }, { status: 401 });
  return null;
}
