/**
 * Estrella de cuatro puntas: Adhara es una estrella (ε Canis Majoris).
 * Motivo del logotipo PROVISIONAL hasta que exista la identidad definitiva.
 */
export function Star({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path d="M12 0c.7 6.9 4.2 10.6 12 12-7.8 1.4-11.3 5.1-12 12-.7-6.9-4.2-10.6-12-12C7.8 10.6 11.3 6.9 12 0Z" />
    </svg>
  );
}
