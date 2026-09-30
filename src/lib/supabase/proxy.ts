import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabaseConfig } from './config';

/** Refresca la sesión de Supabase en el proxy y reescribe sus cookies. */
export async function refreshSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (!config) return { response, hasSession: false };

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  return { response, hasSession: Boolean(data?.claims?.sub) };
}

/**
 * Tienda en vista previa del personal: se lee con la sesión, así que el proxy
 * la refresca y escribe sus cookies en la respuesta de next-intl.
 */
export async function refreshSupabaseSessionInto(
  request: NextRequest,
  response: NextResponse,
) {
  const config = getSupabaseConfig();
  if (!config) return response;
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
