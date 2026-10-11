import Link from 'next/link';
import type { ReactNode } from 'react';
import { cardClass } from '@/components/ui';

/**
 * Cifra destacada de la consola: etiqueta en versalitas, valor en la
 * monoespaciada con cifras tabulares y una nota breve. Compacta para que
 * quepan varias por fila; en alerta, valor y borde izquierdo en peligro.
 */
export function KeyFigure({
  label,
  value,
  note,
  href,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  href?: string;
  tone?: 'default' | 'alert';
}) {
  const alert = tone === 'alert';
  const body = (
    <div
      className={cardClass({
        padding: 'none',
        interactive: Boolean(href),
        className: alert
          ? 'border-l-danger h-full border-l-2 px-4 py-3'
          : 'h-full px-4 py-3',
      })}
    >
      <p className="text-fg-muted text-2xs tracking-caps-sm font-semibold uppercase">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl wrap-break-word tabular-nums ${alert ? 'text-danger' : 'text-fg'}`}
      >
        {value}
      </p>
      {note && <p className="text-fg-muted mt-1 text-xs">{note}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
