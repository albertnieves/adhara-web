'use client';
import { useActionState } from 'react';
import type { EnrollState } from '../server/actions';

export function TotpEnrollment({
  enroll,
  verify,
}: {
  enroll: () => Promise<EnrollState>;
  verify: (formData: FormData) => Promise<void>;
}) {
  const [state, start, pending] = useActionState(enroll, { status: 'idle' });
  if (state.status !== 'enrolled') {
    return (
      <form action={start} className="flex flex-col gap-4">
        {state.status === 'error' && (
          <p role="alert" className="text-red-700">
            No se pudo iniciar el alta. Inténtalo de nuevo.
          </p>
        )}
        <button type="submit" disabled={pending} className="border p-2">
          Configurar la app de autenticación
        </button>
      </form>
    );
  }
  return (
    <form action={verify} className="flex flex-col gap-4">
      <p>
        Escanea el código con tu app de autenticación (Google Authenticator,
        1Password, Authy…) y escribe el código de 6 cifras.
      </p>
      {/* El QR llega como SVG en data URL desde Supabase Auth. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={state.qrCode}
        alt="Código QR para la app de autenticación"
        width={200}
        height={200}
      />
      <p className="text-sm break-all">
        Clave manual: <code>{state.secret}</code>
      </p>
      <input type="hidden" name="factorId" value={state.factorId} />
      <label className="flex flex-col gap-1">
        Código
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
        Verificar y activar
      </button>
    </form>
  );
}
