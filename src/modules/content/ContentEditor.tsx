'use client';
import { useEffect, useState } from 'react';
import { FormMessage, useAdminAction } from '@/modules/admin';
import { editContent } from './actions';
import { FIELD_LABELS } from './domain';
import type { ContentKind } from './domain';
import type { ContentDocument } from './server';
import {
  Card,
  cardClass,
  Checkbox,
  CONTROL_CLASSES,
  Field,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui';

export function ContentEditor({
  kind,
  locale,
  document,
}: {
  kind: ContentKind;
  locale: string;
  document: ContentDocument;
}) {
  const action = useAdminAction(editContent);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const submit = (event: SubmitEvent) => {
      if (
        event.target instanceof HTMLFormElement &&
        !event.target.closest('[data-content-editor]') &&
        !window.confirm('Hay cambios sin guardar. ¿Quieres salir?')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const click = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest('a') : null;
      if (
        target &&
        !window.confirm('Hay cambios sin guardar. ¿Quieres salir?')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    documentGlobal().addEventListener('click', click, true);
    documentGlobal().addEventListener('submit', submit, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      documentGlobal().removeEventListener('click', click, true);
      documentGlobal().removeEventListener('submit', submit, true);
    };
  }, [dirty]);
  const hidden = (
    <>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="expected" value={document.revision} />
    </>
  );
  return (
    <div data-content-editor className="space-y-8">
      <p className="text-fg-muted text-sm">
        Revisión {document.revision} ·{' '}
        {document.published_revision === document.revision
          ? 'Publicada'
          : 'Cambios pendientes de publicar'}{' '}
        · Último cambio: {new Date(document.updated_at).toLocaleString('es-ES')}
      </p>
      <form
        onSubmit={action.onSubmit}
        onChange={() => setDirty(true)}
        className={cardClass({ className: 'grid gap-5 md:grid-cols-2' })}
      >
        {hidden}
        {Object.entries(document.payload)
          .filter(([key]) => key !== 'imagePath')
          .map(([key, value]) => (
            <Field
              key={key}
              label={FIELD_LABELS[key] ?? key}
              className={
                ['heroLead', 'storeBody', 'hours'].includes(key)
                  ? 'md:col-span-2'
                  : ''
              }
            >
              {['heroLead', 'storeBody', 'hours'].includes(key) ? (
                <Textarea
                  name={key}
                  defaultValue={value}
                  maxLength={4000}
                  rows={4}
                />
              ) : (
                <Input
                  name={key}
                  defaultValue={value}
                  maxLength={4000}
                  required={[
                    'heroTitle',
                    'heroCta',
                    'address',
                    'city',
                  ].includes(key)}
                />
              )}
            </Field>
          ))}
        {kind === 'home' && (
          <>
            <input
              type="hidden"
              name="imagePath"
              value={document.payload.imagePath ?? ''}
            />
            <Field
              label="Imagen editorial opcional"
              hint="Hasta 3 MB. Queda privada hasta publicar."
            >
              <input
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className={CONTROL_CLASSES}
              />
            </Field>
            {document.payload.imagePath && (
              <Checkbox
                name="removeImage"
                label="Retirar imagen en la siguiente publicación"
              />
            )}
          </>
        )}
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <SubmitButton name="intent" value="save" pending={action.pending}>
            Guardar borrador
          </SubmitButton>
          <SubmitButton
            name="intent"
            value="publish"
            variant="outline"
            pending={action.pending}
            disabled={
              dirty || document.revision === document.published_revision
            }
          >
            Publicar revisión guardada
          </SubmitButton>
          {dirty && <p className="text-sm">Cambios sin guardar</p>}
          <FormMessage state={action.state} />
        </div>
      </form>
      <Card as="section" className="space-y-4">
        <h2 className="text-2xl">Historial</h2>
        <p className="text-fg-muted text-sm">
          Restaurar crea un borrador nuevo; no cambia la tienda hasta
          publicarlo.
        </p>
        <form onSubmit={action.onSubmit} className="flex flex-wrap gap-4">
          {hidden}
          <Field label="Revisión anterior">
            <Select name="revisionId">
              {document.history.map((row) => (
                <option key={row.id} value={row.id}>
                  Rev. {row.revision} · {row.action} ·{' '}
                  {new Date(row.at).toLocaleString('es-ES')}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton
            name="intent"
            value="restore"
            pending={action.pending}
            disabled={dirty}
            variant="outline"
          >
            Restaurar como borrador
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
function documentGlobal() {
  return window.document;
}
