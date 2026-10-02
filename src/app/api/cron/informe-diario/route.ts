import { timingSafeEqual } from 'node:crypto';
import { generateAndStoreDailyReport } from '@/modules/assistant/server';
import { previousDay } from '@/modules/assistant';
import { madridDay } from '@/modules/reports';

/**
 * Tarea programada (Vercel Cron, vercel.json): cada mañana guarda el informe
 * del día anterior con el resumen del asistente. Solo responde a quien envía
 * CRON_SECRET; sin él configurado, no hace nada.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request, secret: string) {
  const header = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return header.length === expected.length && timingSafeEqual(header, expected);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return Response.json(
      { ok: false, message: 'CRON_SECRET no configurado' },
      { status: 503 },
    );
  if (!authorized(request, secret))
    return Response.json({ ok: false }, { status: 401 });

  const day = previousDay(madridDay(new Date()));
  try {
    const result = await generateAndStoreDailyReport({
      day,
      generatedBy: null,
    });
    if (!result.ok)
      return Response.json(
        { ok: false, day, message: result.message },
        { status: 503 },
      );
    return Response.json({
      ok: true,
      day,
      summary: result.summary !== null,
      note: result.note,
    });
  } catch (error) {
    console.error('[asistente] informe programado', error);
    return Response.json({ ok: false, day }, { status: 500 });
  }
}
