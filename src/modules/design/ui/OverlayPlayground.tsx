'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  Field,
  Input,
  Sheet,
  Text,
  toast,
  useConfirm,
} from '@/components/ui';

/**
 * Superposiciones y avisos con teclado (criterio 5): cada una se abre con
 * Intro, atrapa el foco, se cierra con Esc y devuelve el foco al botón.
 */
export function OverlayPlayground() {
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState<'right' | 'left' | null>(null);
  const [result, setResult] = useState('');
  const [confirm, confirmDialog] = useConfirm();

  async function remove() {
    const confirmed = await confirm({
      title: '¿Eliminar el borrador de prueba?',
      description: 'Es una demostración: no se elimina nada.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    setResult(confirmed ? 'Eliminado (simulado).' : 'Cancelado.');
    if (confirmed) toast('Borrador de prueba eliminado.');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setDialog(true)}>
          Abrir diálogo
        </Button>
        <Button variant="danger" onClick={remove}>
          Eliminar borrador
        </Button>
        <Button variant="outline" onClick={() => setSheet('right')}>
          Panel lateral
        </Button>
        <Button variant="outline" onClick={() => setSheet('left')}>
          Panel oscuro
        </Button>
        <Button variant="secondary" onClick={() => toast('Cambios guardados.')}>
          Aviso de éxito
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast('No se pudo guardar: inténtalo de nuevo.', 'error')
          }
        >
          Aviso de error
        </Button>
      </div>
      <p className="text-sm" aria-live="polite">
        {result}
      </p>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Renombrar la colección"
        description="El foco queda dentro hasta cerrar con Esc, el botón o fuera."
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setDialog(false)}>Guardar</Button>
          </>
        }
      >
        <Field label="Nombre">
          <Input name="demo-coleccion" defaultValue="Colección de prueba" />
        </Field>
      </Dialog>

      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === 'left' ? 'Menú de prueba' : 'Detalle de prueba'}
        description="Entra desde el borde y no recorta el contenido."
        side={sheet ?? 'right'}
        tone={sheet === 'left' ? 'dark' : 'light'}
      >
        <Text size="small">
          Con «reducir movimiento» aparece sin desplazarse.
        </Text>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => setSheet(null)}
        >
          Hecho
        </Button>
      </Sheet>

      {confirmDialog}
    </div>
  );
}
