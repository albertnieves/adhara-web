/**
 * Logotipo de L’Atelier du Désert (definitivo, 30/09/2026).
 *
 * Los trazos están vectorizados del original del usuario
 * (docs/brand/logo-original.png) en el sprite public/brand/logo.svg. Se usan
 * con <use> para que el SVG se descargue una vez, quede en caché y no infle el
 * HTML ni el payload de React; el color sale de `currentColor`.
 */
export const BRAND_NAME = 'L’Atelier du Désert';
export const BRAND_TAGLINE = 'Haute Parfumerie Orientale';

const SPRITE = '/brand/logo.svg';

function Mark({ id, className }: { id: string; className: string }) {
  return (
    <svg aria-hidden className={className} fill="currentColor">
      <use href={`${SPRITE}#${id}`} width="100%" height="100%" />
    </svg>
  );
}

/**
 * - `inline`: emblema ovalado (luna, estrella y dunas) y nombre en una línea.
 *   Escala con el tamaño de letra que se pase en `className` (por defecto
 *   `text-lg`): el nombre mide 1em de alto.
 * - `stacked`: composición completa del original (emblema, nombre en dos
 *   líneas y «Haute Parfumerie Orientale»). El ancho lo marca `className`
 *   (por defecto `w-56`).
 */
export function Logo({
  variant = 'inline',
  className,
}: {
  variant?: 'inline' | 'stacked';
  className?: string;
}) {
  if (variant === 'stacked') {
    return (
      <span
        role="img"
        aria-label={`${BRAND_NAME}. ${BRAND_TAGLINE}`}
        className={`inline-flex ${className ?? 'w-56'}`}
      >
        <Mark id="lockup" className="aspect-[834/839] h-auto w-full" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={BRAND_NAME}
      className={`inline-flex items-center gap-[0.6em] ${className ?? 'text-lg'}`}
    >
      <Mark id="emblem" className="aspect-[374/456] h-[2.1em] w-auto" />
      <Mark id="wordmark" className="aspect-[1476/151] h-[1em] w-auto" />
    </span>
  );
}
