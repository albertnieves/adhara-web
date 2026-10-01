import { chatRequest, runChat } from '@/modules/assistant/server';
import { requirePermission } from '@/modules/auth/server';

/** Preguntas al asistente: respuesta en streaming, una línea JSON por evento. */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const staff = await requirePermission('agent.use');
  // Solo desde el propio panel: cada consulta tiene coste.
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host)
    return Response.json({ error: 'Origen no permitido' }, { status: 403 });
  const parsed = chatRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Consulta no válida' }, { status: 400 });

  const encoder = new TextEncoder();
  const events = runChat(staff, parsed.data);
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await events.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
    },
    async cancel() {
      await events.return(undefined);
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
