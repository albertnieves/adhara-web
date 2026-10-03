'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

/**
 * Zona de prueba con teclado (criterio 5): Intro y Espacio activan, el
 * deshabilitado no recibe el foco y el de carga deja de responder.
 */
export function ButtonPlayground() {
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setCount((n) => n + 1)}>Pulsar</Button>
        <Button variant="outline" disabled>
          Deshabilitado
        </Button>
        <Button
          variant="secondary"
          loading={saving}
          loadingLabel="Guardando…"
          onClick={() => {
            setSaving(true);
            window.setTimeout(() => setSaving(false), 1500);
          }}
        >
          Simular guardado
        </Button>
        <Button href="#acciones" variant="subtle">
          Ir a acciones
        </Button>
      </div>
      <p className="text-sm" aria-live="polite">
        Pulsado {count} {count === 1 ? 'vez' : 'veces'}
      </p>
    </div>
  );
}
