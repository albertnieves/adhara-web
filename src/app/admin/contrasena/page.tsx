import { redirect } from 'next/navigation';
import { AuthError, AuthScreen } from '@/modules/admin';
import {
  requireStaffSessionAnyLevel,
  setPassword,
} from '@/modules/auth/server';
import { buttonClass, Field, Input } from '@/components/ui';

export default async function AdminPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { email, supabase } = await requireStaffSessionAnyLevel();
  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')
    redirect('/admin/mfa?next=contrasena');
  const { error } = await searchParams;
  return (
    <AuthScreen title="Elige tu contraseña">
      {email && <p className="text-fg-muted mb-6 text-sm">Cuenta: {email}</p>}
      {error && (
        <AuthError>
          {error === 'requisitos'
            ? 'Mínimo 12 caracteres y ambas contraseñas iguales.'
            : 'No se pudo guardar la contraseña. Inténtalo de nuevo.'}
        </AuthError>
      )}
      <form action={setPassword} className="flex flex-col gap-5">
        <Field label="Nueva contraseña" hint="Mínimo 12 caracteres.">
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </Field>
        <Field label="Repite la contraseña">
          <Input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </Field>
        <button type="submit" className={buttonClass('primary', 'lg', 'mt-4')}>
          Guardar
        </button>
      </form>
    </AuthScreen>
  );
}
