/** Une clases y descarta las vacías. Sin resolver conflictos de Tailwind. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}
