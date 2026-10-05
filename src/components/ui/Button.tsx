import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Star } from '@/modules/brand';
import { cx } from './cx';

export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'subtle' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Colores con los semánticos, así que valen en el tono claro y en los
 * oscuros. D4: el principal es tinta (fg) y al pasar el ratón se aclara un
 * poco; el dorado nunca es fondo de texto.
 */
export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-fg text-fg-inverse hover:bg-fg/85',
  secondary: 'bg-surface-sunken text-fg hover:bg-border',
  outline:
    'border border-border-strong text-fg hover:border-fg hover:bg-surface-raised',
  subtle: 'text-fg hover:bg-surface-sunken',
  danger:
    'border border-danger text-danger hover:bg-danger hover:text-fg-inverse',
};

/** sm (36 px) para controles secundarios de la tienda, nunca en el panel; md y lg, 44 y 48 px. */
export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-2xs tracking-caps-sm',
  md: 'min-h-11 px-5 text-xs tracking-caps',
  lg: 'min-h-12 px-9 text-2xs tracking-caps-lg',
};

const BASE =
  'inline-flex items-center justify-center gap-2 text-center font-sans font-semibold uppercase transition-colors duration-(--duration-fast) ease-luxe disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45';

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mientras dura una acción: la estrella titila y el botón no responde. */
  loading?: boolean;
  /** Texto mientras carga; por defecto, el mismo. */
  loadingLabel?: ReactNode;
  /** Solo colocación (márgenes, ancho). */
  className?: string;
  children: ReactNode;
};

type AsButton = Common &
  Omit<ComponentProps<'button'>, 'className' | 'children'> & {
    href?: undefined;
  };

type AsLink = Common & {
  href: string;
  /** Un enlace no se deshabilita: se muestra apagado y fuera del tabulador. */
  disabled?: boolean;
  target?: string;
  rel?: string;
};

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cx(BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

function Content({
  loading,
  loadingLabel,
  children,
}: Pick<Common, 'loading' | 'loadingLabel' | 'children'>) {
  return loading ? (
    <>
      <Star className="animate-twinkle size-3.5 shrink-0" />
      {loadingLabel ?? children}
    </>
  ) : (
    children
  );
}

/**
 * Botón del sistema (Fase 2, DS-06): cinco variantes, tres tamaños, carga y
 * deshabilitado. Con `href` es un enlace con aspecto de botón.
 */
export function Button({
  variant,
  size,
  loading = false,
  loadingLabel,
  className,
  children,
  ...rest
}: AsButton | AsLink) {
  const classes = buttonClass(variant, size, className);
  const content = (
    <Content loading={loading} loadingLabel={loadingLabel}>
      {children}
    </Content>
  );

  if (rest.href !== undefined) {
    const { href, disabled, target, rel } = rest as Omit<AsLink, keyof Common>;
    if (disabled || loading)
      return (
        <span
          role="link"
          aria-disabled="true"
          aria-busy={loading || undefined}
          className={classes}
        >
          {content}
        </span>
      );
    return (
      <Link href={href} target={target} rel={rel} className={classes}>
        {content}
      </Link>
    );
  }

  // `href` es undefined en esta rama: React lo ignora.
  const {
    type = 'button',
    disabled,
    ...native
  } = rest as Omit<AsButton, keyof Common>;
  return (
    <button
      {...native}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
    >
      {content}
    </button>
  );
}
