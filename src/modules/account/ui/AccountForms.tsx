'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Checkbox, Eyebrow, Field, Input, SubmitButton } from '@/components/ui';
import type { AccountFormState } from '../domain/input';
import type { AccountLocale } from '../domain/paths';
import { deleteAccountAction, saveAccountAction } from '../server/actions';
import { FormAlert, Notice, useAccountError } from './shared';

const IDLE: AccountFormState = { status: 'idle' };

export type AccountDetailsDefaults = {
  fullName: string;
  phone: string;
  address: {
    addressLine1: string;
    addressLine2: string;
    postalCode: string;
    city: string;
    province: string;
  } | null;
};

/** Datos de contacto y dirección de envío guardados (customer_save_account). */
export function AccountDetailsForm({
  locale,
  defaults,
}: {
  locale: AccountLocale;
  defaults: AccountDetailsDefaults;
}) {
  const t = useTranslations('account');
  const message = useAccountError();
  const [state, dispatch] = useActionState(saveAccountAction, IDLE);
  const error = (field: string) =>
    state.status === 'error'
      ? message(state.fields?.[field as keyof NonNullable<typeof state.fields>])
      : undefined;
  const address = defaults.address;
  return (
    <form action={dispatch} noValidate className="space-y-10">
      <input type="hidden" name="locale" value={locale} />
      <section className="space-y-4">
        <Eyebrow as="h2">{t('details.contact')}</Eyebrow>
        <Field label={t('fullName')} error={error('fullName')}>
          <Input
            name="fullName"
            autoComplete="name"
            maxLength={120}
            defaultValue={defaults.fullName}
          />
        </Field>
        <Field
          label={t('details.phone')}
          hint={t('details.phoneHint')}
          error={error('phone')}
        >
          <Input
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            maxLength={30}
            defaultValue={defaults.phone}
          />
        </Field>
      </section>
      <section className="space-y-4">
        <Eyebrow as="h2">{t('details.address')}</Eyebrow>
        <p className="text-fg-muted text-sm leading-relaxed">
          {t('details.addressHint')}
        </p>
        <Field label={t('details.addressLine1')} error={error('addressLine1')}>
          <Input
            name="addressLine1"
            autoComplete="address-line1"
            maxLength={200}
            defaultValue={address?.addressLine1}
          />
        </Field>
        <Field label={t('details.addressLine2')}>
          <Input
            name="addressLine2"
            autoComplete="address-line2"
            maxLength={200}
            defaultValue={address?.addressLine2}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <Field label={t('details.postalCode')} error={error('postalCode')}>
            <Input
              name="postalCode"
              autoComplete="postal-code"
              inputMode="numeric"
              maxLength={5}
              defaultValue={address?.postalCode}
            />
          </Field>
          <Field label={t('details.city')} error={error('city')}>
            <Input
              name="city"
              autoComplete="address-level2"
              maxLength={120}
              defaultValue={address?.city}
            />
          </Field>
        </div>
        <Field label={t('details.province')}>
          <Input
            name="province"
            autoComplete="address-level1"
            maxLength={120}
            defaultValue={address?.province}
          />
        </Field>
      </section>
      <div className="space-y-4">
        <FormAlert state={state} />
        {state.status === 'saved' && <Notice>{t('details.saved')}</Notice>}
        <SubmitButton size="lg" pendingLabel={t('details.saving')}>
          {t('details.save')}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Borrar la cuenta, con una casilla que lo confirma. */
export function DeleteAccountForm({ locale }: { locale: AccountLocale }) {
  const t = useTranslations('account');
  const message = useAccountError();
  const [state, dispatch] = useActionState(deleteAccountAction, IDLE);
  return (
    <form action={dispatch} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-fg-muted text-sm leading-relaxed">
        {t('delete.text')}
      </p>
      <Checkbox
        name="confirm"
        label={t('delete.confirm')}
        error={
          state.status === 'error' ? message(state.fields?.confirm) : undefined
        }
      />
      {state.status === 'error' && !state.fields?.confirm && (
        <FormAlert state={state} />
      )}
      <SubmitButton variant="danger" pendingLabel={t('delete.submitting')}>
        {t('delete.submit')}
      </SubmitButton>
    </form>
  );
}
