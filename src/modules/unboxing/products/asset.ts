import type { StaticImageData } from 'next/image';

/** URL de una imagen importada (Next devuelve un objeto; la escena usa la URL). */
export function asset(image: StaticImageData | string): string {
  return typeof image === 'string' ? image : image.src;
}
