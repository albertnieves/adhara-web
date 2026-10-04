import Link from 'next/link';
import { AuthError, AuthScreen } from '@/modules/admin';
import { signIn } from '@/modules/auth/server';
import { buttonClass, Field, Input } from '@/components/ui';

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
          <Input name="email" type="email" autoComplete="username" required />
        </Field>
        <Field label="Contraseña">
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <button type="submit" className={buttonClass('primary', 'lg', 'mt-4')}>
          Entrar
        </button>
      </form>
      <Link href="/admin/recuperar" className="link-underline text-sm">
        He olvidado mi contraseña
      </Link>
    </AuthScreen>
  );
}
