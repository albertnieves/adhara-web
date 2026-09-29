import { enrollTotp, requireMfaStep, verifyTotp } from '@/modules/auth/server';
import { TotpEnrollment } from '@/modules/auth/ui/totp-enrollment';

export default async function AdminMfa({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { step } = await requireMfaStep();
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm">
      <h1>Verificación en dos pasos</h1>
      {error === 'codigo' && (
        <p role="alert" className="mb-4 text-red-700">
          El código no es válido o ha caducado.
        </p>
      )}
      {step === 'enroll_mfa' ? (
        <>
          <p className="mb-4">
            El panel exige una app de autenticación para todo el personal.
          </p>
          <TotpEnrollment enroll={enrollTotp} verify={verifyTotp} />
        </>
      ) : (
        <form action={verifyTotp} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            Código de tu app de autenticación
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              className="border p-2"
            />
          </label>
          <button type="submit" className="border p-2">
            Verificar
          </button>
        </form>
      )}
    </main>
  );
}
