import type { ReactNode } from 'react';
import type { Season, TimeOfDay } from '@/modules/catalog';

/*
 * Símbolos del catálogo olfativo con el mismo trazo que el juego de iconos
 * (1,5 px, retícula de 24, currentColor). Siempre decorativos: el texto de
 * la estación o el momento va al lado o como texto para lectores.
 */
const PATHS: Record<Season | TimeOfDay, ReactNode> = {
  spring: (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14c-3.2 0-5.5-2.2-5.5-5.5 3.2 0 5.5 2.3 5.5 5.5Zm0 0c3.2 0 5.5-2.2 5.5-5.5-3.2 0-5.5 2.3-5.5 5.5Z" />
      <circle cx="12" cy="5" r="2" />
    </>
  ),
  summer: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5m0 14v2.5M2.5 12H5m14 0h2.5M5.3 5.3l1.8 1.8m9.8 9.8 1.8 1.8M5.3 18.7l1.8-1.8m9.8-9.8 1.8-1.8" />
    </>
  ),
  autumn: (
    <>
      <path d="M5 19C5 10.5 10.5 5 19 5c0 8.5-5.5 14-14 14Z" />
      <path d="m5 19 8.5-8.5" />
    </>
  ),
  winter: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9m-15.6 0 15.6-9" />
      <path d="m9.5 4.8 2.5 2 2.5-2m-5 14.4 2.5-2 2.5 2" />
    </>
  ),
  day: (
    <>
      <path d="M3 18h18" />
      <path d="M7 18a5 5 0 0 1 10 0" />
      <path d="M12 6.5v3M5.6 10.1l1.8 1.8m10.9-1.8-1.8 1.8" />
    </>
  ),
  night: <path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10Z" />,
};

export function ScentGlyph({
  name,
  className = 'size-5',
}: {
  name: Season | TimeOfDay;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}

/** El mismo símbolo dentro de otro SVG, colocado en sus coordenadas. */
export function ScentGlyphShape({
  name,
  x,
  y,
  size,
  className,
}: {
  name: Season | TimeOfDay;
  x: number;
  y: number;
  size: number;
  className?: string;
}) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
