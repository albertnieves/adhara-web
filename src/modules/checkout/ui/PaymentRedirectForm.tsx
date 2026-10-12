'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui';
import type { PaymentRedirect } from '../domain/input';

/**
 * Lleva al navegador a la página de pago del banco con el formulario firmado
 * en el servidor. Se envía solo al aparecer; el botón queda por si el
 * navegador lo bloquea o no hay JavaScript.
 */
export function PaymentRedirectForm({ form }: { form: PaymentRedirect }) {
  const t = useTranslations('order');
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    ref.current?.submit();
  }, [form]);

  return (
    <form ref={ref} method="post" action={form.url} className="space-y-4">
      {Object.entries(form.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p role="status" className="leading-relaxed">
        {t('redirecting')}
      </p>
      <Button type="submit" size="lg">
        {t('goToBank')}
      </Button>
    </form>
  );
}
