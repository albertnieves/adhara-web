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
          <p role="alert" className="text-danger text-sm">
            No se pudo iniciar el alta. Inténtalo de nuevo.
          </p>
        )}
        <button type="submit" disabled={pending} className="btn btn-primary">
          Configurar la app de autenticación
        </button>
      </form>
    );
  }
  return (
    <form action={verify} className="flex flex-col gap-4">
      <p className="text-smoke text-sm leading-relaxed">
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
        className="border-line self-center border bg-white p-3"
      />
      <p className="text-smoke text-xs break-all">
        Clave manual: <code>{state.secret}</code>
      </p>
      <input type="hidden" name="factorId" value={state.factorId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-smoke text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
          Código
        </span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          required
          className="input text-center text-2xl tracking-[0.4em] tabular-nums"
        />
      </label>
      <button type="submit" className="btn btn-primary">
        Verificar y activar
      </button>
    </form>
  );
}
