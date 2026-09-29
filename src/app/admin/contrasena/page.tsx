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
    <main className="mx-auto max-w-sm">
      <h1>Elige tu contraseña</h1>
      {email && <p className="mb-4">Cuenta: {email}</p>}
      {error && (
        <p role="alert" className="mb-4 text-red-700">
          {error === 'requisitos'
            ? 'Mínimo 12 caracteres y ambas contraseñas iguales.'
            : 'No se pudo guardar la contraseña. Inténtalo de nuevo.'}
        </p>
      )}
      <form action={setPassword} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          Nueva contraseña
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className="border p-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Repite la contraseña
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className="border p-2"
          />
        </label>
        <button type="submit" className="border p-2">
          Guardar
        </button>
      </form>
    </main>
  );
}
