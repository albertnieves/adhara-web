'use client';

import { FormMessage, useAdminAction } from '@/modules/admin';
import {
  Checkbox,
  Field,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui';
import { saveMessageTemplate } from '../server/actions';

/** Alta o cambio de una plantilla de respuesta. */
export function TemplateForm({
  template,
}: {
  template?: {
    id: string;
    title: string;
    locale: 'es' | 'ca' | 'en';
    body: string;
    active: boolean;
    revision: number;
  };
}) {
  const { state, pending, onSubmit } = useAdminAction(saveMessageTemplate);
  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-5">
      <input type="hidden" name="id" value={template?.id ?? ''} />
      <input type="hidden" name="revision" value={template?.revision ?? ''} />
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="Título" hint="Solo lo ve el personal.">
          <Input
            name="title"
            required
            maxLength={80}
            defaultValue={template?.title}
            autoComplete="off"
          />
        </Field>
        <Field label="Idioma">
          <Select name="locale" defaultValue={template?.locale ?? 'es'}>
            <option value="es">Español</option>
            <option value="ca">Catalán</option>
            <option value="en">Inglés</option>
          </Select>
        </Field>
      </div>
      <Field
        label="Texto"
        hint="El de la respuesta, sin firma: la firma de la tienda se añade sola."
      >
        <Textarea
          name="body"
          rows={8}
          required
          maxLength={5000}
          defaultValue={template?.body}
        />
      </Field>
      <Checkbox
        name="active"
        label="Activa (aparece al responder)"
        defaultChecked={template?.active ?? true}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending}>
          {template ? 'Guardar cambios' : 'Crear plantilla'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
