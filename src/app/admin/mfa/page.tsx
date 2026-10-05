import { AuthError, AuthScreen } from '@/modules/admin';
import { enrollTotp, requireMfaStep, verifyTotp } from '@/modules/auth/server';
import { TotpEnrollment } from '@/modules/auth/ui/totp-enrollment';
import { buttonClass, Field, Input } from '@/components/ui';

export default async function AdminMfa({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { step } = await requireMfaStep();
  const { error, next } = await searchParams;
  return (
    <AuthScreen title="Verificación en dos pasos">
      {error === 'codigo' && (
        <AuthError>El código no es válido o ha caducado.</AuthError>
      )}
      {step === 'enroll_mfa' ? (
        <>
          <p className="text-fg-muted mb-6 text-sm leading-relaxed">
            El panel exige una app de autenticación para todo el personal.
          </p>
          <TotpEnrollment enroll={enrollTotp} verify={verifyTotp} />
        </>
      ) : (
        <form action={verifyTotp} className="flex flex-col gap-5">
          <input
            type="hidden"
            name="next"
            value={next === 'contrasena' ? next : ''}
          />
          <Field label="Código de tu app de autenticación">
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              className="tracking-caps-lg text-center text-2xl! tabular-nums"
            />
          </Field>
          <button type="submit" className={buttonClass('primary', 'lg')}>
            Verificar
          </button>
        </form>
      )}
    </AuthScreen>
  );
}
