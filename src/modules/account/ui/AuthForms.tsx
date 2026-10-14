'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Field, Heading, Input, SubmitButton } from '@/components/ui';
import { Link } from '@/modules/i18n';
import type { AccountFormState } from '../domain/input';
import { MIN_PASSWORD_LENGTH } from '../domain/input';
import type { AccountLocale } from '../domain/paths';
import {
  googleSignInAction,
  newPasswordAction,
  recoveryAction,
  signInAction,
  signUpAction,
} from '../server/actions';
import { FormAlert, Honeypot, Notice, useAccountError } from './shared';

const IDLE: AccountFormState = { status: 'idle' };

type Common = { locale: AccountLocale; next?: string | null };

function Hidden({ locale, next }: Common) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
    </>
  );
}

function fieldError(state: AccountFormState, field: string) {
  return state.status === 'error'
    ? state.fields?.[field as keyof NonNullable<typeof state.fields>]
    : undefined;
}

/** «Continuar con Google»: la acción lleva a Google y vuelve por /auth/callback. */
export function GoogleSignIn({ locale, next }: Common) {
  const t = useTranslations('account');
  return (
    <form action={googleSignInAction} className="space-y-2">
      <Hidden locale={locale} next={next} />
      <SubmitButton
        variant="outline"
        size="lg"
        className="w-full"
        pendingLabel={t('google')}
      >
        {/* Sin la «G»: el logotipo oficial llega con la verificación de Google (PLAN_CUENTA_CLIENTE). */}
        {t('google')}
      </SubmitButton>
      <p className="text-fg-muted text-xs leading-relaxed">{t('googleNote')}</p>
    </form>
  );
}

/** Separador entre Google y el email. */
export function OrDivider() {
  const t = useTranslations('account');
  return (
    <p className="text-fg-muted text-2xs tracking-caps flex items-center gap-4 uppercase">
      <span aria-hidden className="bg-border h-px flex-1" />
      {t('orDivider')}
      <span aria-hidden className="bg-border h-px flex-1" />
    </p>
  );
}

export function SignInForm({ locale, next }: Common) {
  const t = useTranslations('account');
  const [state, dispatch] = useActionState(signInAction, IDLE);
  return (
    <form action={dispatch} className="space-y-5">
      <Hidden locale={locale} next={next} />
      <Field label={t('email')}>
        <Input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
        />
      </Field>
      <Field label={t('password')}>
        <Input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          maxLength={200}
        />
      </Field>
      <FormAlert state={state} />
      <SubmitButton
        size="lg"
        className="w-full"
        pendingLabel={t('signIn.submitting')}
      >
        {t('signIn.submit')}
      </SubmitButton>
      <Link href="/cuenta/recuperar" className="link-underline text-sm">
        {t('signIn.forgot')}
      </Link>
    </form>
  );
}

export function SignUpForm({ locale, next }: Common) {
  const t = useTranslations('account');
  const message = useAccountError();
  const [state, dispatch] = useActionState(signUpAction, IDLE);
  if (state.status === 'sent')
    return (
      <section className="space-y-4">
        <Heading level={2} size="h3">
          {t('register.sentTitle')}
        </Heading>
        <Notice>{t('register.sentText')}</Notice>
      </section>
    );
  return (
    <form action={dispatch} noValidate className="space-y-5">
      <Hidden locale={locale} next={next} />
      <Honeypot />
      <Field
        label={t('fullName')}
        error={message(fieldError(state, 'fullName'))}
      >
        <Input name="fullName" required autoComplete="name" maxLength={120} />
      </Field>
      <Field label={t('email')} error={message(fieldError(state, 'email'))}>
        <Input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
        />
      </Field>
      <Field
        label={t('password')}
        hint={t('passwordHint', { min: MIN_PASSWORD_LENGTH })}
        error={message(fieldError(state, 'password'))}
      >
        <Input
          type="password"
          name="password"
          required
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={200}
        />
      </Field>
      <p className="text-fg-muted text-xs leading-relaxed">
        {t.rich('register.privacy', {
          link: (chunks) => (
            <Link href="/privacidad" className="link-underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
      <FormAlert state={state} />
      <SubmitButton
        size="lg"
        className="w-full"
        pendingLabel={t('register.submitting')}
      >
        {t('register.submit')}
      </SubmitButton>
    </form>
  );
}

export function RecoveryForm({ locale }: { locale: AccountLocale }) {
  const t = useTranslations('account');
  const message = useAccountError();
  const [state, dispatch] = useActionState(recoveryAction, IDLE);
  if (state.status === 'sent')
    return (
      <section className="space-y-4">
        <Heading level={2} size="h3">
          {t('recover.sentTitle')}
        </Heading>
        <Notice>{t('recover.sentText')}</Notice>
        <Link href="/cuenta/acceso" className="link-underline text-sm">
          {t('recover.back')}
        </Link>
      </section>
    );
  return (
    <form action={dispatch} noValidate className="space-y-5">
      <Hidden locale={locale} />
      <Honeypot />
      <Field label={t('email')} error={message(fieldError(state, 'email'))}>
        <Input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
        />
      </Field>
      <FormAlert state={state} />
      <SubmitButton
        size="lg"
        className="w-full"
        pendingLabel={t('recover.submitting')}
      >
        {t('recover.submit')}
      </SubmitButton>
      <Link href="/cuenta/acceso" className="link-underline text-sm">
        {t('recover.back')}
      </Link>
    </form>
  );
}

export function NewPasswordForm({ locale }: { locale: AccountLocale }) {
  const t = useTranslations('account');
  const message = useAccountError();
  const [state, dispatch] = useActionState(newPasswordAction, IDLE);
  return (
    <form action={dispatch} noValidate className="space-y-5">
      <Hidden locale={locale} />
      <Field
        label={t('newPassword.password')}
        hint={t('passwordHint', { min: MIN_PASSWORD_LENGTH })}
        error={message(fieldError(state, 'password'))}
      >
        <Input
          type="password"
          name="password"
          required
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={200}
        />
      </Field>
      <Field
        label={t('newPassword.confirmation')}
        error={message(fieldError(state, 'confirmation'))}
      >
        <Input
          type="password"
          name="confirmation"
          required
          autoComplete="new-password"
          maxLength={200}
        />
      </Field>
      <FormAlert state={state} />
      {state.status === 'error' && state.error === 'link' && (
        <Link href="/cuenta/recuperar" className="link-underline text-sm">
          {t('newPassword.requestNew')}
        </Link>
      )}
      <SubmitButton
        size="lg"
        className="w-full"
        pendingLabel={t('newPassword.submitting')}
      >
        {t('newPassword.submit')}
      </SubmitButton>
    </form>
  );
}
