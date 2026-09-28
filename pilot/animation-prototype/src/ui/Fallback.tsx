import type { ProductConfig } from '../products';

/** Sin WebGL (o si la escena falla): imagen del producto. El panel se muestra aparte. */
export function Fallback({ product }: { product: ProductConfig }) {
  return (
    <div className="fallback">
      <img
        src={product.draftImage.src}
        alt={`${product.name} (imagen GENERATED/DRAFT)`}
      />
    </div>
  );
}
