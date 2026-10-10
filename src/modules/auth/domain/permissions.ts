/**
 * Matriz rol → permiso del personal (docs/ADMIN_PLAN.md §3). Es la fuente del
 * seed de role_permissions y de la tabla de verdad de las pruebas pgTAP.
 * Los clientes no son personal: su acceso se limita a sus propios datos por RLS.
 */
export const STAFF_ROLES = ['system_admin', 'store_admin', 'viewer'] as const;
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
  // Control del negocio y del proyecto (/admin/control): solo el titular.
  'business.control',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type AuthenticatorLevel = 'aal1' | 'aal2';

/** Permisos que exigen sesión con MFA verificada (aal2) además del rol. */
export const AAL2_PERMISSIONS: ReadonlySet<Permission> = new Set(
  PERMISSIONS.filter(
    (permission) =>
      ![
        'inventory.view',
        'orders.view',
        'messages.view',
        'agent.use',
        'reports.view',
        'customers.view',
      ].includes(permission),
  ),
);

/**
 * Administrador de la tienda: toda la operación diaria, sin personal,
 * configuración ni el control del negocio y del proyecto.
 */
const STORE_ADMIN: readonly Permission[] = PERMISSIONS.filter(
  (permission) =>
    permission !== 'staff.manage' &&
    permission !== 'settings.manage' &&
    permission !== 'business.control',
);

/** Encargado: solo lectura, sin datos de clientes ni costes. */
const VIEWER: readonly Permission[] = [
  'inventory.view',
  'orders.view',
  'messages.view',
  'agent.use',
];

export const ROLE_PERMISSIONS: Readonly<
  Record<StaffRole, ReadonlySet<Permission>>
> = {
  system_admin: new Set(PERMISSIONS),
  store_admin: new Set(STORE_ADMIN),
  viewer: new Set(VIEWER),
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
