import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from './cx';
import { describedBy, FieldMessages } from './Field';
import { Icon } from './Icon';

type ChoiceProps = Omit<ComponentProps<'input'>, 'type' | 'children'> & {
  label: ReactNode;
  hint?: ReactNode;
  /** Error de esta opción (p. ej., una casilla obligatoria). */
  error?: ReactNode;
  /** Solo colocación. */
  className?: string;
};

/*
 * La caja es de 24 px y la etiqueta entera es el objetivo táctil (44 px de
 * alto). Dibujadas con los semánticos, no con el control nativo, para que se
 * vean igual en el tono claro y en los oscuros.
 */
const BOX =
  'peer col-start-1 row-start-1 size-6 cursor-[inherit] appearance-none border border-border-strong bg-surface-raised transition-colors duration-(--duration-fast) ease-luxe checked:border-fg aria-invalid:border-danger disabled:border-border disabled:bg-surface-sunken';

const MARK =
  'pointer-events-none col-start-1 row-start-1 opacity-0 transition-opacity duration-(--duration-fast) ease-luxe peer-checked:opacity-100';

function Choice({
  type,
  label,
  hint,
  error,
  className,
  box,
  mark,
  ...props
}: ChoiceProps & {
  type: 'checkbox' | 'radio';
  box: string;
  mark: ReactNode;
}) {
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <div className={cx('flex flex-col', className)}>
      <label
        htmlFor={id}
        className="text-fg flex min-h-11 cursor-pointer items-center gap-3 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-45"
      >
        <span className="grid shrink-0 place-items-center">
          <input
            {...props}
            id={id}
            type={type}
            aria-describedby={describedBy(
              id,
              { hint, error },
              props['aria-describedby'],
            )}
            aria-invalid={error ? true : props['aria-invalid']}
            className={cx(BOX, box)}
          />
          {mark}
        </span>
        <span>{label}</span>
      </label>
      <FieldMessages
        id={id}
        hint={hint}
        error={error}
        className="-mt-1.5 pb-2 pl-9"
      />
    </div>
  );
}

/** Casilla de verificación con su etiqueta. Espacio la marca. */
export function Checkbox(props: ChoiceProps) {
  return (
    <Choice
      {...props}
      type="checkbox"
      box="checked:bg-fg"
      mark={
        <Icon name="check" size="sm" className={cx(MARK, 'text-fg-inverse')} />
      }
    />
  );
}

/**
 * Opción de un grupo: varias con el mismo `name` dentro de un `Fieldset`.
 * Las flechas cambian la elección y Tab sale del grupo.
 */
export function Radio(props: ChoiceProps) {
  return (
    <Choice
      {...props}
      type="radio"
      box="rounded-full"
      mark={
        <span
          aria-hidden="true"
          className={cx(MARK, 'bg-fg size-2.5 rounded-full')}
        />
      }
    />
  );
}
