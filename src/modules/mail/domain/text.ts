/** Sustituye {clave} por su valor; falla si el texto no existe en el idioma. */
export function fill(
  template: string | undefined,
  values: Record<string, string>,
): string {
  if (template === undefined) throw new Error('Falta un texto del correo');
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? values[key]! : whole,
  );
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
