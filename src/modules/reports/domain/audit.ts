/**
 * Visor de auditoría: áreas por prefijo de acción («catalog.product_created»
 * → catalog) y descripción breve de cada entrada. Las acciones las escriben
 * el panel y las funciones SQL; las desconocidas se muestran tal cual.
 */

export const AUDIT_AREAS = {
  auth: 'Accesos y MFA',
  catalog: 'Catálogo',
  pricing: 'Precios y costes',
  inventory: 'Inventario y mostrador',
  purchasing: 'Compras y proveedores',
  staff: 'Equipo',
  settings: 'Configuración',
} as const;
export type AuditArea = keyof typeof AUDIT_AREAS;

export function isAuditArea(value: string): value is AuditArea {
  return Object.hasOwn(AUDIT_AREAS, value);
}

export function auditArea(action: string): AuditArea | null {
  const prefix = action.split('.')[0] ?? '';
  return isAuditArea(prefix) ? prefix : null;
}

/** Cambios de un registro: claves cuyo valor difiere entre antes y después. */
export function auditChanges(
  before: unknown,
  after: unknown,
): { key: string; before: unknown; after: unknown }[] {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  const a = isObject(before) ? before : {};
  const b = isObject(after) ? after : {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys
    .filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
    .map((key) => ({ key, before: a[key], after: b[key] }));
}
