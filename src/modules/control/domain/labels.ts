/**
 * Valores y etiquetas del control del negocio y del proyecto. Los códigos son
 * los mismos que los checks de internal.control_* (migración 20261010120000).
 */

export const CONTROL_AREAS = ['project', 'business'] as const;
export type ControlArea = (typeof CONTROL_AREAS)[number];
export const AREA_LABELS: Readonly<Record<ControlArea, string>> = {
  project: 'Proyecto',
  business: 'Negocio',
};

export const TASK_STATUSES = [
  'pending',
  'in_progress',
  'blocked',
  'done',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  blocked: 'Bloqueada',
  done: 'Hecha',
};

export const TASK_PRIORITIES = ['high', 'normal', 'low'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABELS: Readonly<Record<TaskPriority, string>> = {
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja',
};

export const TASK_OWNERS = ['me', 'client', 'other'] as const;
export type TaskOwner = (typeof TASK_OWNERS)[number];
export const TASK_OWNER_LABELS: Readonly<Record<TaskOwner, string>> = {
  me: 'Yo',
  client: 'Cliente',
  other: 'Otra persona',
};

export const COST_CATEGORIES = [
  'hosting',
  'software',
  'marketing',
  'rent',
  'supplies',
  'staff',
  'advisory',
  'logistics',
  'fees',
  'other',
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];
export const COST_CATEGORY_LABELS: Readonly<Record<CostCategory, string>> = {
  hosting: 'Alojamiento y dominio',
  software: 'Software y servicios',
  marketing: 'Marketing',
  rent: 'Alquiler',
  supplies: 'Suministros',
  staff: 'Personal',
  advisory: 'Asesoría y gestoría',
  logistics: 'Envíos y transporte',
  fees: 'Comisiones y bancos',
  other: 'Otros',
};

export const COST_FREQUENCIES = ['monthly', 'yearly', 'once'] as const;
export type CostFrequency = (typeof COST_FREQUENCIES)[number];
export const COST_FREQUENCY_LABELS: Readonly<Record<CostFrequency, string>> = {
  monthly: 'Mensual',
  yearly: 'Anual',
  once: 'Puntual',
};

export const DELIVERY_STATUSES = [
  'planned',
  'in_progress',
  'delivered',
  'accepted',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export const DELIVERY_STATUS_LABELS: Readonly<Record<DeliveryStatus, string>> =
  {
    planned: 'Planificada',
    in_progress: 'En curso',
    delivered: 'Entregada',
    accepted: 'Aceptada',
  };

export const BILLING_STATUSES = [
  'none',
  'pending',
  'invoiced',
  'paid',
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];
export const BILLING_STATUS_LABELS: Readonly<Record<BillingStatus, string>> = {
  none: 'No se factura',
  pending: 'Por facturar',
  invoiced: 'Facturada',
  paid: 'Cobrada',
};

/** Errores de las funciones admin_control_* (además de los generales). */
export const CONTROL_ERRORS: Readonly<Record<string, string>> = {
  unknown_record: 'Ya no existe: alguien lo ha borrado. Recarga la página.',
  invalid_period: 'El periodo no es válido.',
  price_above_retail:
    'El precio cobrado no puede superar el PVP vigente. Si el PVP ha cambiado, recarga el mostrador.',
};

export function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' && (values as readonly string[]).includes(value)
  );
}
