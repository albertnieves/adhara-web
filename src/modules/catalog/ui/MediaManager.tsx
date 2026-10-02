'use client';

import Image from 'next/image';
import {
  Field,
  FormMessage,
  SubmitButton,
  useAdminAction,
} from '@/modules/admin';
import { updateMedia, uploadMedia } from '../server/actions';

export type MediaValues = {
  id: string;
  url: string;
  alt: string | null;
  role: string;
  origin: string;
  source: string | null;
  provisional: boolean;
};

const ORIGIN_LABELS: Record<string, string> = {
  own_photo: 'Foto propia',
  catalog_pdf: 'Catálogo PDF',
  brand_official: 'Imagen oficial de la marca',
  generated_draft: 'Borrador generado',
};

function MediaCard({
  productId,
  media,
}: {
  productId: string;
  media: MediaValues;
}) {
  const { state, pending, onSubmit } = useAdminAction(updateMedia);
  return (
    <li className="panel-card flex flex-col gap-3 p-3">
      <div className="bg-stage relative aspect-square">
        <Image
          src={media.url}
          alt={media.alt ?? ''}
          fill
          sizes="200px"
          className="object-contain p-3 mix-blend-multiply brightness-[1.04]"
        />
        {media.role === 'hero' && (
          <span className="bg-ink text-ivory text-2xs tracking-caps absolute top-2 left-2 px-2 py-0.5 uppercase">
            Principal
          </span>
        )}
      </div>
      <p className="text-xs">
        {ORIGIN_LABELS[media.origin] ?? media.origin}
        {media.provisional && (
          <span className="text-accent-fg"> · provisional</span>
        )}
      </p>
      {media.source && (
        <p
          className="text-fg-muted truncate text-[0.6875rem]"
          title={media.source}
        >
          {media.source}
        </p>
      )}
      <form
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent)
            .submitter as HTMLButtonElement | null;
          if (
            submitter?.value === 'delete' &&
            !window.confirm('¿Eliminar esta imagen?')
          ) {
            event.preventDefault();
            return;
          }
          onSubmit(event);
        }}
        className="mt-auto flex flex-wrap gap-2"
      >
        <input type="hidden" name="id" value={media.id} />
        <input type="hidden" name="productId" value={productId} />
        {media.role !== 'hero' && (
          <SubmitButton
            variant="ghost"
            name="intent"
            value="hero"
            pending={pending}
            pendingLabel="…"
            className="min-h-9 px-3"
          >
            Principal
          </SubmitButton>
        )}
        <SubmitButton
          variant="danger"
          name="intent"
          value="delete"
          pending={pending}
          pendingLabel="…"
          className="min-h-9 px-3"
        >
          Quitar
        </SubmitButton>
      </form>
      <FormMessage state={state} />
    </li>
  );
}

export function MediaManager({
  productId,
  media,
  canEdit,
}: {
  productId: string;
  media: MediaValues[];
  canEdit: boolean;
}) {
  const { state, pending, onSubmit } = useAdminAction(uploadMedia);
  return (
    <div className="space-y-6">
      {media.length === 0 ? (
        <p className="text-smoke text-sm">
          Sin imágenes: la tienda mostrará la marca con la estrella.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {media.map((item) =>
            canEdit ? (
              <MediaCard key={item.id} productId={productId} media={item} />
            ) : (
              <li key={item.id} className="bg-stage relative aspect-square">
                <Image
                  src={item.url}
                  alt={item.alt ?? ''}
                  fill
                  sizes="200px"
                  className="object-contain p-3 mix-blend-multiply brightness-[1.04]"
                />
              </li>
            ),
          )}
        </ul>
      )}
      {canEdit && (
        <form
          onSubmit={(event) => {
            onSubmit(event);
            event.currentTarget.reset();
          }}
          className="border-line grid gap-4 border border-dashed p-6 md:grid-cols-2"
        >
          <input type="hidden" name="productId" value={productId} />
          <p className="eyebrow md:col-span-2">Añadir imagen</p>
          <Field label="Archivo" hint="JPG, PNG, WebP o AVIF, hasta 4 MB.">
            <input
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="input py-2 text-sm"
            />
          </Field>
          <Field label="Procedencia">
            <select name="origin" defaultValue="own_photo" className="input">
              {Object.entries(ORIGIN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Fuente"
            hint="URL o página del catálogo. Obligatoria si no es foto propia."
          >
            <input name="source" maxLength={500} className="input" />
          </Field>
          <Field label="Texto alternativo">
            <input name="alt" maxLength={200} className="input" />
          </Field>
          <Field label="Uso">
            <select name="role" defaultValue="gallery" className="input">
              <option value="hero">Principal</option>
              <option value="gallery">Galería</option>
              <option value="box">Caja</option>
            </select>
          </Field>
          <div className="flex flex-wrap items-center gap-3 self-end md:col-span-2">
            <SubmitButton pending={pending} pendingLabel="Subiendo…">
              Subir imagen
            </SubmitButton>
            <FormMessage state={state} />
          </div>
        </form>
      )}
    </div>
  );
}
