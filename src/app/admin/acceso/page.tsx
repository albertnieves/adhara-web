import { AuthError, AuthScreen, Field } from '@/modules/admin';
import { signIn } from '@/modules/auth/server';

const ERRORS: Record<string, string> = {
  credenciales: 'Email o contraseña incorrectos.',
  servicio: 'El acceso no está disponible en este momento.',
  enlace: 'El enlace ha caducado o no es válido. Pide uno nuevo.',
};

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] : undefined;
  return (
    <AuthScreen title="Acceso al panel">
      {message && <AuthError>{message}</AuthError>}
      <form action={signIn} className="flex flex-col gap-5">
        <Field label="Email">
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            className="input"
          />
        </Field>
        <Field label="Contraseña">
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
          />
        </Field>
        <button type="submit" className="btn btn-primary mt-4">
          Entrar
        </button>
      </form>
    </AuthScreen>
  );
}
