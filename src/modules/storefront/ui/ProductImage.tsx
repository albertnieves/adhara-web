import Image from 'next/image';
import type { ProductMedia } from '@/modules/catalog';
import { Star } from '@/modules/brand';

/**
 * Imagen de producto sobre el fondo cálido de la tienda. Las fotos de estudio
 * traen fondo gris muy claro (246/255): un +4 % de brillo lo lleva a blanco y
 * multiply lo funde con el fondo. Sin imagen: marca y estrella.
 */
export function ProductImage({
  media,
  alt,
  brand,
  sizes,
  priority = false,
  className = '',
}: {
  media: ProductMedia | null;
  alt: string;
  brand: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!media) {
    return (
      <div
        className={`text-fg-muted flex h-full w-full flex-col items-center justify-center gap-4 ${className}`}
      >
        <Star className="text-accent/60 size-5" />
        <span className="font-display tracking-caps-lg text-xl uppercase">
          {brand}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={media.url}
      alt={media.alt ?? alt}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-contain mix-blend-multiply brightness-[1.04] ${className}`}
    />
  );
}
