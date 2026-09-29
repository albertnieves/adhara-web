import { AuthError, AuthScreen, Field } from '@/modules/admin';
import {
  requireStaffSessionAnyLevel,
  setPassword,
} from '@/modules/auth/server';

export default async function AdminPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { email } = await requireStaffSessionAnyLevel();
  const { error } = await searchParams;
  return (
    <AuthScreen title="Elige tu contraseña">
      {email && <p className="text-smoke mb-6 text-sm">Cuenta: {email}</p>}
      {error && (
        <AuthError>
          {error === 'requisitos'
            ? 'Mínimo 12 caracteres y ambas contraseñas iguales.'
            : 'No se pudo guardar la contraseña. Inténtalo de nuevo.'}
        </AuthError>
      )}
      <form action={setPassword} className="flex flex-col gap-5">
        <Field label="Nueva contraseña" hint="Mínimo 12 caracteres.">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className="input"
          />
        </Field>
        <Field label="Repite la contraseña">
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className="input"
          />
        </Field>
        <button type="submit" className="btn btn-primary mt-4">
          Guardar
        </button>
      </form>
    </AuthScreen>
  );
}
