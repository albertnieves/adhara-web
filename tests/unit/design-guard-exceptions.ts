/*
 * Excepciones de tests/unit/design-guard.test.ts. Cada número es el total
 * exacto de usos que quedan en ese archivo: la prueba falla si sube y también
 * si baja sin actualizar la lista, así que solo puede ir a menos.
 *
 * Solo hay excepciones permanentes, cada una con su motivo. Las temporales
 * de DS-02 (tamaños y espaciados arbitrarios) llegaron a cero en DS-04.
 */

export const PERMANENT_COLOR_EXCEPTIONS: Readonly<
  Record<string, { count: number; reason: string }>
> = {
  'src/modules/storefront/ui/ProductStage.tsx': {
    count: 1,
    reason:
      'Fondo de la escena 3D: three.js no lee variables CSS (refleja --color-stage).',
  },
};

/**
 * Tamaños de letra fuera de la escala (text-[…]). Desde DS-04 la escala está
 * cerrada y no quedan excepciones temporales.
 */
export const PERMANENT_TEXT_SIZE_EXCEPTIONS: Readonly<
  Record<string, { count: number; reason: string }>
> = {
  'src/modules/catalog/ui/PriceLabelCard.tsx': {
    count: 7,
    reason:
      'Etiqueta de estante impresa a tamaño físico (63,5 × 38,1 mm): los tamaños van en pt para que coincidan con la hoja, no son texto de pantalla.',
  },
};
