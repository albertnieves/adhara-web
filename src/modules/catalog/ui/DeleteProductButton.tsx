'use client';

import { SubmitButton } from '@/modules/admin';
import { deleteProduct } from '../server/actions';

/** Solo borradores: un perfume publicado se archiva, no se borra. */
export function DeleteProductButton({ id }: { id: string }) {
  return (
    <form
      action={deleteProduct}
      onSubmit={(event) => {
        if (!window.confirm('¿Eliminar este borrador? No se puede deshacer.')) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="danger" pendingLabel="Eliminando…">
        Eliminar borrador
      </SubmitButton>
    </form>
  );
}
