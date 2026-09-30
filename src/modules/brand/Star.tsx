/**
 * Estrella de cuatro puntas del emblema de L’Atelier du Désert (el mismo trazo
 * del logotipo, centrado en 24 × 24). Motivo decorativo de la web.
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
      <path d="M11.9 23.64c0-.19-.13-1.33-.23-2.53c-.35-3.78-.84-6.22-1.36-7.16c-.16-.26-.33-.39-.81-.62c-.85-.42-2.93-.94-5.3-1.26c-.23-.04-.43-.14-.43-.17c-.03-.1 0-.13 1.14-.26c2.63-.36 4.88-1.04 5.33-1.62c.2-.26.56-1.17.69-1.89c.06-.33.16-.62.16-.65c.13-.2.58-3.61.75-5.46c.16-2.02.29-2.02.42-.04c.29 3.65.94 7.09 1.5 8c.35.56 1.46.95 4.68 1.56c.45.1.94.17 1.14.17c.39 0 .68.09.65.19c-.03.03-.56.17-1.17.26c-2.7.43-4.65 1.04-5.14 1.63c-.68.81-1.24 3.54-1.59 7.97c-.2 2.01-.2 2.24-.3 2.24c-.03 0-.1-.16-.13-.36z" />
    </svg>
  );
}
