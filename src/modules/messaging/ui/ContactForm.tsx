'use client';

import { useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
import { startTransition, useActionState, useState } from 'react';
import {
  Button,
  Field,
  Fieldset,
  Heading,
  Input,
  Radio,
  Textarea,
} from '@/components/ui';
import { Link } from '@/modules/i18n';
import type { ContactField, ContactState } from '../domain/contact';
import { CONTACT_MESSAGE_MAX } from '../domain/contact';
import type { Topic } from '../domain/conversations';
import { TOPICS } from '../domain/conversations';
import { submitContact } from '../server/contact';

const IDLE: ContactState = { status: 'idle' };

/**
 * Formulario de contacto (A6.1): llega al panel como una conversación y la
 * respuesta sale por email. El número de pedido solo se pide si la consulta
 * es sobre un pedido; la base solo lo enlaza si el email es el del pedido.
 */
export function ContactForm({ locale }: { locale: 'es' | 'ca' | 'en' }) {
  const t = useTranslations('contact');
  const [state, dispatch, pending] = useActionState(submitContact, IDLE);
  // Una clave por formulario: repetir el envío no duplica la consulta.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [topic, setTopic] = useState<Topic>('order');
  // «Enviar otro mensaje» deja atrás el resultado anterior.
  const [dismissed, setDismissed] = useState<ContactState | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  const shown = state === dismissed ? IDLE : state;
  if (shown.status === 'sent') {
    return (
      <section role="status" className="max-w-2xl space-y-6">
        <Heading level={2} size="h2">
          {t('sentTitle')}
        </Heading>
        <p className="leading-relaxed">
          {shown.number !== null
            ? t('sentLead', { number: shown.number })
            : t('sentGeneric')}
        </p>
        <p className="text-fg-muted text-sm leading-relaxed">{t('sentNext')}</p>
        <Button
          variant="outline"
          onClick={() => {
            setRequestId(crypto.randomUUID());
            setDismissed(state);
          }}
        >
          {t('another')}
        </Button>
      </section>
    );
  }

  const errors = shown.status === 'error' ? (shown.fields ?? {}) : {};
  const fieldError = (field: ContactField) =>
    errors[field] ? t(`errors.${errors[field]}`) : undefined;

  return (
    <form
      action={dispatch}
      onSubmit={onSubmit}
      noValidate
      className="max-w-2xl space-y-8"
    >
      <input type="hidden" name="requestId" value={requestId} />
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

      <Fieldset legend={t('topic')}>
        {TOPICS.map((value) => (
          <Radio
            key={value}
            name="topic"
            value={value}
            checked={topic === value}
            onChange={() => setTopic(value)}
            label={t(`topics.${value}`)}
          />
        ))}
      </Fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('fullName')} error={fieldError('fullName')}>
          <Input name="fullName" required autoComplete="name" maxLength={120} />
        </Field>
        <Field
          label={t('email')}
          hint={t('emailHint')}
          error={fieldError('email')}
        >
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            maxLength={254}
          />
        </Field>
      </div>

      {topic === 'order' && (
        <Field
          label={t('orderNumber')}
          hint={t('orderNumberHint')}
          error={fieldError('orderNumber')}
          className="max-w-xs"
        >
          <Input
            name="orderNumber"
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
          />
        </Field>
      )}

      <Field label={t('subject')} error={fieldError('subject')}>
        <Input name="subject" maxLength={200} autoComplete="off" />
      </Field>

      <Field label={t('message')} error={fieldError('message')}>
        <Textarea
          name="message"
          required
          rows={7}
          maxLength={CONTACT_MESSAGE_MAX}
        />
      </Field>

      <p className="text-fg-muted text-xs leading-relaxed">
        {t.rich('privacy', {
          link: (chunks) => (
            <Link
              href={{ pathname: '/privacidad', hash: 'consultas' }}
              className="link-underline"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>

      {shown.status === 'error' && (
        <p role="alert" className="text-danger text-sm">
          {Object.keys(errors).length > 0
            ? t('errors.fields')
            : t(`errors.${shown.error}`)}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        loading={pending}
        loadingLabel={t('sending')}
      >
        {t('submit')}
      </Button>
    </form>
  );
}
