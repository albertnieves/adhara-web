'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
import { startTransition, useActionState } from 'react';
import { Button, Checkbox, Field, Input } from '@/components/ui';
import type { SubscribeState } from '../domain';
import { subscribeNewsletter } from '../server/actions';

const IDLE: SubscribeState = { status: 'idle' };

/**
 * Alta en la lista de promociones: email y consentimiento expreso (casilla
 * sin marcar por defecto). El campo «company» es una trampa para bots.
 */
export function NewsletterSignup() {
  const t = useTranslations('newsletter');
  const locale = useLocale();
  const [state, dispatch, pending] = useActionState(subscribeNewsletter, IDLE);
  // Sin el reinicio automático de React 19: un error no borra lo escrito.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  if (state.status === 'success') {
    return (
      <p role="status" className="font-display text-2xl font-light">
        {t('success')}
      </p>
    );
  }

  return (
    <form
      action={dispatch}
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="locale" value={locale} />
      <div
        aria-hidden
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          label={t('email')}
          error={
            state.status === 'invalidEmail' ? t('invalidEmail') : undefined
          }
          className="flex-1"
        >
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder={t('placeholder')}
          />
        </Field>
        <Button
          type="submit"
          size="md"
          loading={pending}
          loadingLabel={t('pending')}
          className="sm:mb-0"
        >
          {t('submit')}
        </Button>
      </div>
      <Checkbox
        name="consent"
        required
        label={t('consent')}
        error={
          state.status === 'consentRequired' ? t('consentRequired') : undefined
        }
      />
      <p role="status" aria-live="polite" className="text-danger text-sm">
        {state.status === 'busy' && t('busy')}
        {state.status === 'error' && t('error')}
      </p>
    </form>
  );
}
