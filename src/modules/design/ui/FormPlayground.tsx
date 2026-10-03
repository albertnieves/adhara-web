'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Checkbox, Field, Input } from '@/components/ui';

type Errors = { email?: string; terms?: string };

/**
 * Formulario de prueba con teclado (criterio 5): al validar, los errores
 * salen bajo cada campo, el control queda inválido y el foco va al primero.
 */
export function FormPlayground() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState('');
  const email = useRef<HTMLInputElement>(null);
  const terms = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Errors = {};
    if (!/^\S+@\S+\.\S+$/.test(String(data.get('email') ?? '')))
      next.email = 'Escribe un correo con @ y dominio.';
    if (!data.get('terms')) next.terms = 'Marca la casilla para seguir.';
    setErrors(next);
    setStatus(next.email || next.terms ? '' : 'Formulario válido.');
    if (next.email) email.current?.focus();
    else if (next.terms) terms.current?.focus();
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label="Formulario de prueba"
      className="border-border flex max-w-md flex-col gap-4 border p-5"
    >
      <Field
        label="Correo electrónico"
        hint="Solo para esta prueba; no se envía."
        error={errors.email}
      >
        <Input ref={email} type="email" name="email" autoComplete="off" />
      </Field>
      <Checkbox
        ref={terms}
        name="terms"
        label="He leído las condiciones de prueba"
        error={errors.terms}
      />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit">Validar</Button>
        <p className="text-success text-sm" aria-live="polite">
          {status}
        </p>
      </div>
    </form>
  );
}
