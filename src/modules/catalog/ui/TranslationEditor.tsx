'use client';

import { useState } from 'react';
import {
  Field,
  FormMessage,
  SubmitButton,
  useAdminAction,
} from '@/modules/admin';
import { saveTranslation } from '../server/actions';

const LOCALES = [
  { code: 'es', label: 'Español' },
  { code: 'ca', label: 'Català' },
  { code: 'en', label: 'English' },
] as const;

export type TranslationValues = {
  locale: string;
  tagline: string | null;
  description: string | null;
};

function TranslationForm({
  productId,
  locale,
  value,
}: {
  productId: string;
  locale: string;
  value?: TranslationValues;
}) {
  const { state, pending, onSubmit } = useAdminAction(saveTranslation);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="locale" value={locale} />
      <Field label="Frase corta" hint="Se muestra bajo el nombre en la ficha.">
        <input
          name="tagline"
          maxLength={200}
          defaultValue={value?.tagline ?? ''}
          className="input"
        />
      </Field>
      <Field
        label="Descripción"
        hint="Solo información verificada (catálogo o fuente oficial)."
      >
        <textarea
          name="description"
          rows={6}
          maxLength={4000}
          defaultValue={value?.description ?? ''}
          className="input leading-relaxed"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} variant="ghost">
          Guardar texto
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function TranslationEditor({
  productId,
  translations,
}: {
  productId: string;
  translations: TranslationValues[];
}) {
  const [active, setActive] = useState<string>('es');
  return (
    <div>
      <div role="tablist" className="border-line mb-6 flex gap-1 border-b">
        {LOCALES.map((locale) => (
          <button
            key={locale.code}
            type="button"
            role="tab"
            aria-selected={active === locale.code}
            onClick={() => setActive(locale.code)}
            className={`tracking-caps -mb-px border-b-2 px-4 py-3 text-xs uppercase ${
              active === locale.code
                ? 'border-ink text-ink'
                : 'text-smoke border-transparent'
            }`}
          >
            {locale.label}
          </button>
        ))}
      </div>
      {LOCALES.map((locale) => (
        <div key={locale.code} hidden={active !== locale.code}>
          <TranslationForm
            productId={productId}
            locale={locale.code}
            value={translations.find((t) => t.locale === locale.code)}
          />
        </div>
      ))}
    </div>
  );
}
