'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { withinRateLimit } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function requestPasswordRecovery(formData: FormData) {
  const email = z
    .email()
    .max(254)
    .safeParse(String(formData.get('email') ?? '').trim());
  if (!email.success) redirect('/admin/recuperar?error=email');
  // Cada petición manda un correo (DECISIONS §187).
  if (!(await withinRateLimit('staff_recovery')))
    redirect('/admin/recuperar?error=espera');
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect('/admin/recuperar?error=servicio');
  // Supabase aplica límites de frecuencia. Nunca revelar si existe la cuenta.
  await supabase.auth.resetPasswordForEmail(email.data);
  redirect('/admin/recuperar?enviado=1');
}
