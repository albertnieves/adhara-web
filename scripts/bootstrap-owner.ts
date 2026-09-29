/**
 * Alta del primer administrador del sistema (fase A1). Uso puntual, local:
 *   BOOTSTRAP_OWNER_EMAIL=… SUPABASE_SECRET_KEY=… NEXT_PUBLIC_SUPABASE_URL=… pnpm bootstrap:owner
 * Envía la invitación de Supabase Auth y crea la ficha de personal. Idempotente.
 * La clave secreta solo se lee del entorno; nunca se escribe ni se muestra.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
if (!url || !secret || !email) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY o BOOTSTRAP_OWNER_EMAIL',
  );
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserId(address: string): Promise<string | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email === address);
    if (user) return user.id;
    if (data.users.length < 200) return null;
  }
}

let userId = await findUserId(email);
if (!userId) {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) throw error;
  userId = data.user.id;
  console.log('Invitación enviada.');
} else {
  console.log('El usuario ya existía; no se reenvía la invitación.');
}

const { error } = await admin
  .from('staff_members')
  .upsert({ user_id: userId, role: 'system_admin', active: true });
if (error) throw error;
console.log('Ficha de personal: system_admin activo.');
