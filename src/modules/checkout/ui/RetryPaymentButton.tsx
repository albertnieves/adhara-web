'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui';
import type { RetryPaymentState } from '../server/actions';
import { retryPayment } from '../server/actions';
import { PaymentRedirectForm } from './PaymentRedirectForm';

const IDLE: RetryPaymentState = { status: 'idle' };

/** Pide una referencia nueva al servidor y vuelve al banco a pagar. */
export function RetryPaymentButton({
  locale,
  label,
}: {
  locale: 'es' | 'ca' | 'en';
  label: string;
}) {
  const t = useTranslations('order');
  const [state, dispatch, pending] = useActionState(retryPayment, IDLE);

  if (state.status === 'redirect')
    return <PaymentRedirectForm form={state.form} />;

  return (
    <form action={dispatch} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <SubmitButton size="lg" pending={pending} pendingLabel={t('connecting')}>
        {label}
      </SubmitButton>
      {state.status === 'error' && (
        <p role="alert" className="text-danger text-sm">
          {t(`retryErrors.${state.error}`)}
        </p>
      )}
    </form>
  );
}
