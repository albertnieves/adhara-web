import { z } from 'zod';
import { createSupabasePublicClient } from '@/lib/supabase/public';
import type { TrackedKind } from '@/modules/storefront';

/**
 * Medición anónima de visitas e interés de los perfumes (consola del titular,
 * /admin/control/atencion). Solo suma un contador por perfume publicado, día
 * de Madrid y tipo con track_product_event: no guarda IP, agente de usuario,
 * cookies ni ningún identificador de quien visita.
 *
 * Responde siempre 204 sin datos, cuente o no (quien llama no sabe si el
 * perfume existe ni si se ha contado); 400 solo si el cuerpo no es JSON. Se
 * descartan sin contar los bots, las peticiones de otro origen y los cuerpos
 * de más de 512 bytes. add_to_cart lo envía la cesta (P03), que solo existe
 * con el checkout encendido.
 */
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 512;
const BOT =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor|curl|wget|python/i;
const KINDS = [
  'view',
  'scent_view',
  'unboxing',
  'add_to_cart',
] as const satisfies readonly TrackedKind[];

const eventInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,160}$/),
  kind: z.enum(KINDS),
});

function reply(status: 204 | 400) {
  return new Response(null, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** El cuerpo como texto, o null si pasa de MAX_BODY_BYTES (sin leer más). */
async function readBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES)
    return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Solo la propia tienda: sin agente de usuario, con aspecto de bot o de otro origen, no cuenta. */
function countable(request: Request) {
  const agent = request.headers.get('user-agent');
  if (!agent || BOT.test(agent)) return false;
  const site = request.headers.get('sec-fetch-site');
  if (site !== null && site !== 'same-origin') return false;
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const text = await readBody(request).catch(() => null);
  if (text === null) return reply(204);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400);
  }
  const input = eventInput.safeParse(body);
  if (!input.success || !countable(request)) return reply(204);

  const supabase = createSupabasePublicClient();
  if (!supabase) return reply(204);
  try {
    const { error } = await supabase.rpc('track_product_event', {
      p_slug: input.data.slug,
      p_kind: input.data.kind,
    });
    if (error) console.error('[atención] no se pudo contar', error.code);
  } catch (error) {
    console.error('[atención] no se pudo contar', error);
  }
  return reply(204);
}
