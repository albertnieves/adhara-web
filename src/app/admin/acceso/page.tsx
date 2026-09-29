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
    <main className="mx-auto max-w-sm">
      <h1>Acceso al panel</h1>
      {message && (
        <p role="alert" className="mb-4 text-red-700">
          {message}
        </p>
      )}
      <form action={signIn} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          Email
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            className="border p-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="border p-2"
          />
        </label>
        <button type="submit" className="border p-2">
          Entrar
        </button>
      </form>
    </main>
  );
}
