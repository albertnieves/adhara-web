'use client';

import { SubmitButton } from '@/components/ui';
import { FormMessage, useAdminAction } from '@/modules/admin';
import { setProductStatus } from '../server/actions';

/** Publicar, retirar o archivar. La base de datos exige PVP para publicar. */
export function StatusActions({
  id,
  status,
  canPublish,
}: {
  id: string;
  status: string;
  canPublish: boolean;
}) {
  const { state, pending, onSubmit } = useAdminAction(setProductStatus);
  if (!canPublish) return null;
  const next =
    status === 'published'
      ? [
          {
            status: 'draft',
            label: 'Retirar de la tienda',
            variant: 'outline' as const,
          },
          {
            status: 'archived',
            label: 'Archivar',
            variant: 'outline' as const,
          },
        ]
      : status === 'archived'
        ? [
            {
              status: 'draft',
              label: 'Recuperar como borrador',
              variant: 'outline' as const,
            },
          ]
        : [
            {
              status: 'published',
              label: 'Publicar en la tienda',
              variant: 'primary' as const,
            },
            {
              status: 'archived',
              label: 'Archivar',
              variant: 'outline' as const,
            },
          ];
  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-wrap justify-end gap-3">
        {next.map((option) => (
          <form key={option.status} onSubmit={onSubmit}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={option.status} />
            <SubmitButton
              variant={option.variant}
              pending={pending}
              pendingLabel="…"
            >
              {option.label}
            </SubmitButton>
          </form>
        ))}
      </div>
      <div className="max-w-md">
        <FormMessage state={state} />
      </div>
    </div>
  );
}
