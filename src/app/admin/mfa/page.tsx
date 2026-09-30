import { AuthError, AuthScreen, Field } from '@/modules/admin';
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
    <AuthScreen title="Verificación en dos pasos">
      {error === 'codigo' && (
        <AuthError>El código no es válido o ha caducado.</AuthError>
      )}
      {step === 'enroll_mfa' ? (
        <>
          <p className="text-smoke mb-6 text-sm leading-relaxed">
            El panel exige una app de autenticación para todo el personal.
          </p>
          <TotpEnrollment enroll={enrollTotp} verify={verifyTotp} />
        </>
      ) : (
        <form action={verifyTotp} className="flex flex-col gap-5">
          <Field label="Código de tu app de autenticación">
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              className="input text-center text-2xl tracking-[0.4em] tabular-nums"
            />
          </Field>
          <button type="submit" className="btn btn-primary">
            Verificar
          </button>
        </form>
      )}
    </AuthScreen>
  );
}
