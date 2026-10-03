import { cloneElement, useId } from 'react';
import type { AriaAttributes, ReactElement, ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

/** Lo que `Field` pone en su control: id, descripciones e invalidez. */
export type FieldControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
};

/** Etiqueta de los campos: versalitas de 11 px, como el antetítulo. */
export const FIELD_LABEL =
  'text-2xs tracking-caps font-sans font-semibold text-fg-muted uppercase';

/**
 * Ayuda y error bajo un control. El error va primero en
 * `aria-describedby`, así que el lector de pantalla lo dice antes.
 */
export function FieldMessages({
  id,
  hint,
  error,
  className,
}: {
  id: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
}) {
  if (!hint && !error) return null;
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {error && (
        <p
          id={`${id}-error`}
          className="text-danger flex items-start gap-1.5 text-xs"
        >
          <Icon name="alert" size="sm" className="shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-fg-muted text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Ids de error y ayuda para `aria-describedby`, en ese orden. */
export function describedBy(
  id: string,
  { hint, error }: { hint?: ReactNode; error?: ReactNode },
  own?: string,
) {
  return (
    cx(own, error ? `${id}-error` : '', hint ? `${id}-hint` : '') || undefined
  );
}

/**
 * Campo del sistema (Fase 2, DS-07): etiqueta, control, ayuda y error.
 * Une la etiqueta con el control y le pone `aria-describedby` y, si hay
 * error, `aria-invalid`. El control es un único elemento (`Input`,
 * `Textarea`, `Select`…); si trae su propio id, se respeta.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** Mensaje de error; marca el control como inválido. */
  error?: ReactNode;
  /** Solo colocación. */
  className?: string;
  children: ReactElement<FieldControlProps>;
}) {
  const auto = useId();
  const own = children.props;
  const id = own.id ?? auto;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': describedBy(
          id,
          { hint, error },
          own['aria-describedby'],
        ),
        'aria-invalid': error ? true : own['aria-invalid'],
      })}
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

/**
 * Grupo de opciones (radios o casillas) con su leyenda, ayuda y error.
 * La leyenda nombra el grupo; cada opción lleva su etiqueta.
 */
export function Fieldset({
  legend,
  hint,
  error,
  className,
  children,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <fieldset
      aria-describedby={describedBy(id, { hint, error })}
      className={cx('flex min-w-0 flex-col gap-1.5', className)}
    >
      <legend className={cx(FIELD_LABEL, 'mb-1.5')}>{legend}</legend>
      <div className="flex flex-col">{children}</div>
      <FieldMessages id={id} hint={hint} error={error} />
    </fieldset>
  );
}
