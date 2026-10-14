'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { AccountError, AccountFormState } from '../domain/input';
import { MIN_PASSWORD_LENGTH } from '../domain/input';

/** Campo trampa invisible: lo rellenan los bots, no las personas. */
export function Honeypot() {
  return (
    <div
      aria-hidden
      className="absolute -left-[9999px] h-px w-px overflow-hidden"
    >
      <label>
        Company
        <input type="text" name="company" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

/** Mensaje de un error de la cuenta (account.errors) con sus valores. */
export function useAccountError() {
  const t = useTranslations('account.errors');
  return (key: AccountError | undefined) =>
    key ? t(key, { min: MIN_PASSWORD_LENGTH }) : undefined;
}

/** Error general del formulario; con errores por campo, «revisa los campos». */
export function FormAlert({ state }: { state: AccountFormState }) {
  const t = useTranslations('account.errors');
  const message = useAccountError();
  if (state.status !== 'error') return null;
  // Con errores por campo, cada uno va bajo su campo (como el checkout).
  const fields = Object.keys(state.fields ?? {}).length;
  return (
    <p role="alert" className="text-danger text-sm leading-relaxed">
      {fields > 0 ? t('review') : message(state.error)}
    </p>
  );
}

/** Aviso que confirma algo (correo enviado, datos guardados). */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="border-border bg-surface-raised border px-4 py-3 text-sm leading-relaxed"
    >
      {children}
    </p>
  );
}
