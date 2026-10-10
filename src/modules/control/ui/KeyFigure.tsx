import Link from 'next/link';
import type { ReactNode } from 'react';
import { cardClass, Eyebrow } from '@/components/ui';

/** Cifra destacada del control: etiqueta, valor y una nota breve. */
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
  const body = (
    <div
      className={cardClass({
        padding: 'sm',
        interactive: Boolean(href),
        className: 'h-full sm:p-6',
      })}
    >
      <Eyebrow>{label}</Eyebrow>
      <p
        className={`font-display mt-2 text-3xl font-light lining-nums tabular-nums sm:text-4xl ${tone === 'alert' ? 'text-danger' : ''}`}
      >
        {value}
      </p>
      {note && <p className="text-fg-muted mt-2 text-xs">{note}</p>}
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
