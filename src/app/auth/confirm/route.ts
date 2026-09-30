import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const params = z.object({
  token_hash: z.string().min(10).max(500),
  type: z.enum(['invite', 'recovery']),
});

/** Enlaces de invitación y recuperación (plantillas de email con token_hash). */
export async function GET(request: NextRequest) {
  const parsed = params.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const supabase = await createSupabaseServerClient();
  if (parsed.success && supabase) {
    const { error } = await supabase.auth.verifyOtp(parsed.data);
    if (!error) {
      return NextResponse.redirect(new URL('/admin/contrasena', request.url));
    }
  }
  return NextResponse.redirect(
    new URL('/admin/acceso?error=enlace', request.url),
  );
}
