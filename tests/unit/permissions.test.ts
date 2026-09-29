import { describe, expect, it } from 'vitest';
import {
  AAL2_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  isAllowed,
  roleHasPermission,
} from '@/modules/auth';

describe('matriz de permisos del personal', () => {
  it('el administrador del sistema tiene todos los permisos', () => {
    for (const permission of PERMISSIONS) {
      expect(roleHasPermission('system_admin', permission)).toBe(true);
    }
  });

  it('solo el administrador del sistema gestiona personal y configuración', () => {
    for (const permission of ['staff.manage', 'settings.manage'] as const) {
      const holders = STAFF_ROLES.filter((role) =>
        roleHasPermission(role, permission),
      );
      expect(holders).toEqual(['system_admin']);
    }
  });

  it('el administrador de la tienda lleva la operación completa', () => {
    for (const permission of [
      'pricing.edit_retail',
      'pricing.edit_cost',
      'inventory.adjust',
      'orders.refund',
      'messages.reply',
      'customers.manage',
    ] as const) {
      expect(roleHasPermission('store_admin', permission)).toBe(true);
    }
  });

  it('el encargado solo lee, sin clientes ni costes', () => {
    const granted = [...ROLE_PERMISSIONS.viewer];
    expect(
      granted.every((permission) => /\.(view|use)$/.test(permission)),
    ).toBe(true);
    expect(roleHasPermission('viewer', 'customers.view')).toBe(false);
    expect(roleHasPermission('viewer', 'pricing.view_cost')).toBe(false);
  });

  it('los permisos sensibles exigen MFA verificada (aal2)', () => {
    expect(
      isAllowed({ role: 'store_admin', aal: 'aal1' }, 'pricing.view_cost'),
    ).toBe(false);
    expect(
      isAllowed({ role: 'store_admin', aal: 'aal2' }, 'pricing.view_cost'),
    ).toBe(true);
    expect(isAllowed({ role: 'viewer', aal: 'aal1' }, 'orders.view')).toBe(
      true,
    );
  });

  it('todo permiso con aal2 pertenece al catálogo', () => {
    for (const permission of AAL2_PERMISSIONS) {
      expect(PERMISSIONS).toContain(permission);
    }
  });
});
