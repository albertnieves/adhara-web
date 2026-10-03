import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

/**
 * Enlace en el texto con el subrayado que se dibuja al pasar el ratón o al
 * enfocar (.link-underline). `external` lo abre en otra pestaña y lo dice a
 * los lectores de pantalla con `newTabLabel` (en el idioma de la página).
 */
export function TextLink({
  href,
  tone = 'inherit',
  external = false,
  newTabLabel = 'se abre en otra pestaña',
  className,
  children,
}: {
  href: string;
  tone?: 'inherit' | 'muted';
  external?: boolean;
  newTabLabel?: string;
  /** Solo colocación. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'link-underline inline-flex items-center gap-1',
        tone === 'muted' && 'text-fg-muted hover:text-fg',
        className,
      )}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
      {external && (
        <>
          <Icon name="external" size="sm" />
          <span className="sr-only"> ({newTabLabel})</span>
        </>
      )}
    </Link>
  );
}
