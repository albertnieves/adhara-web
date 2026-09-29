/**
 * Matriz rol → permiso del personal (Fase 0 §11, ampliada en docs/ADMIN_PLAN.md).
 * Es la fuente de la que saldrán el seed de role_permissions y la tabla de
 * verdad de las pruebas pgTAP. La autorización real se repite en servidor y RLS.
 */
export const STAFF_ROLES = [
  'owner',
  'manager',
  'store_staff',
  'content_editor',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  'catalog.edit',
  'catalog.publish',
  'research.edit',
  'media.edit',
  'content.edit',
  'pricing.edit_retail',
  'pricing.view_cost',
  'pricing.edit_cost',
  'inventory.view',
  'inventory.receive',
  'inventory.stocktake',
  'inventory.sell_in_store',
  'inventory.adjust',
  'purchasing.manage',
  'orders.view',
  'orders.fulfill',
  'orders.refund',
  'messages.view',
  'messages.reply',
  'customers.view',
  'customers.manage',
  'promotions.manage',
  'agent.use',
  'reports.view',
  'settings.manage',
  'staff.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type AuthenticatorLevel = 'aal1' | 'aal2';

/** Permisos que exigen sesión con MFA verificada (aal2) además del rol. */
export const AAL2_PERMISSIONS: ReadonlySet<Permission> = new Set([
  'pricing.edit_retail',
  'pricing.view_cost',
  'pricing.edit_cost',
  'purchasing.manage',
  'orders.refund',
  'customers.manage',
  'settings.manage',
  'staff.manage',
]);

const STORE_FLOOR: readonly Permission[] = [
  'inventory.view',
  'inventory.receive',
  'inventory.stocktake',
  'inventory.sell_in_store',
  'orders.view',
  'orders.fulfill',
  'messages.view',
  'messages.reply',
  'customers.view',
  'agent.use',
];

const CONTENT: readonly Permission[] = [
  'catalog.edit',
  'research.edit',
  'media.edit',
  'content.edit',
];

export const ROLE_PERMISSIONS: Readonly<
  Record<StaffRole, ReadonlySet<Permission>>
> = {
  owner: new Set(PERMISSIONS),
  manager: new Set([
    ...STORE_FLOOR,
    ...CONTENT,
    'catalog.publish',
    'pricing.edit_retail',
    'pricing.view_cost',
    'inventory.adjust',
    'purchasing.manage',
    'orders.refund',
    'customers.manage',
    'promotions.manage',
    'reports.view',
  ]),
  store_staff: new Set(STORE_FLOOR),
  content_editor: new Set(CONTENT),
};

export function roleHasPermission(
  role: StaffRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function requiresAal2(permission: Permission): boolean {
  return AAL2_PERMISSIONS.has(permission);
}

export type StaffSession = { role: StaffRole; aal: AuthenticatorLevel };

export function isAllowed(
  session: StaffSession,
  permission: Permission,
): boolean {
  if (!roleHasPermission(session.role, permission)) return false;
  return !requiresAal2(permission) || session.aal === 'aal2';
}
