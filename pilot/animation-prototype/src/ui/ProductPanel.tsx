import type { CSSProperties } from 'react';
import type { ProductConfig } from '../products';

interface Props {
  product: ProductConfig;
  visible: boolean;
  /** Duración de la entrada (s); 0 con reduced motion. */
  enterSeconds: number;
}

/**
 * Panel HTML normal superpuesto (no texto 3D). Aparece con el evento `rotated`.
 * Precio y descripción son PLACEHOLDER: el PVP lo aprueba un administrador.
 */
export function ProductPanel({ product, visible, enterSeconds }: Props) {
  return (
    <aside
      className="panel"
      data-visible={visible}
      aria-hidden={!visible}
      style={{ '--enter': `${enterSeconds}s` } as CSSProperties}
    >
      <p className="panel__brand">{product.brand}</p>
      <h1 className="panel__name">{product.name}</h1>
      <p className="panel__price">
        {product.panel.priceLabel}
        <span className="panel__note">PVP pendiente de aprobación</span>
      </p>
      <p className="panel__desc">
        <span className="tag">Placeholder</span> {product.panel.description}
      </p>
      <button
        type="button"
        className="panel__cta"
        tabIndex={visible ? 0 : -1}
        onClick={() => window.alert('Prototipo: la compra no está conectada.')}
      >
        Añadir a la cesta
      </button>
      <p className="panel__foot">Prototipo interno · textos y precio provisionales</p>
    </aside>
  );
}
