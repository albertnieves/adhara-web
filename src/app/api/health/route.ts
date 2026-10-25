import { createSupabasePublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get('check') === 'readiness') {
    let ready = false;
    try {
      const client = createSupabasePublicClient();
      if (client) {
        // Consulta anónima mínima bajo RLS. No lee costes, contactos ni claves.
        const { error } = await client
          .from('products')
          .select('id')
          .limit(1)
          .abortSignal(AbortSignal.timeout(3_000));
        ready = !error;
      }
    } catch {
      /* La sonda no revela los errores internos. */
    }
    return Response.json(
      { status: ready ? 'ready' : 'unavailable', service: 'adhara-web' },
      { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return Response.json(
    { status: 'ok', service: 'adhara-web' },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
