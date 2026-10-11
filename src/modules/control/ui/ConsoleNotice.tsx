import type { ReactNode } from 'react';

const TONES = {
  info: 'border-l-accent',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
} as const;

/**
 * Aviso de la consola: borde izquierdo con el semántico y texto normal, para
 * alertas (copia atrasada, migraciones pendientes…) y explicaciones.
 */
export function ConsoleNotice({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof TONES;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={`border-border bg-surface-raised border border-l-2 px-4 py-3 text-sm ${TONES[tone]}`}
    >
      <p className="font-semibold">{title}</p>
      {children && (
        <div className="text-fg-muted mt-1 space-y-1 text-xs leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

/** Sección de una pantalla de la consola: título compacto y acción opcional. */
export function ConsoleSection({
  id,
  title,
  action,
  children,
  className = 'mt-10',
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
