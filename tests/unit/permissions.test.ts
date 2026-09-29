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
  it('owner tiene todos los permisos', () => {
    for (const permission of PERMISSIONS) {
      expect(roleHasPermission('owner', permission)).toBe(true);
    }
  });

  it('solo owner gestiona personal, configuración y costes', () => {
    for (const permission of [
      'staff.manage',
      'settings.manage',
      'pricing.edit_cost',
    ] as const) {
      const holders = STAFF_ROLES.filter((role) =>
        roleHasPermission(role, permission),
      );
      expect(holders).toEqual(['owner']);
    }
  });

  it('content_editor no accede a pedidos, clientes, mensajes ni precios', () => {
    const granted = [...ROLE_PERMISSIONS.content_editor];
    expect(
      granted.filter((permission) =>
        /^(orders|customers|messages|pricing|purchasing)\./.test(permission),
      ),
    ).toEqual([]);
  });

  it('store_staff no ve costes ni ajusta stock sin recuento', () => {
    expect(roleHasPermission('store_staff', 'pricing.view_cost')).toBe(false);
    expect(roleHasPermission('store_staff', 'inventory.adjust')).toBe(false);
    expect(roleHasPermission('store_staff', 'inventory.stocktake')).toBe(true);
    expect(roleHasPermission('store_staff', 'orders.fulfill')).toBe(true);
  });

  it('los permisos sensibles exigen MFA verificada (aal2)', () => {
    expect(
      isAllowed({ role: 'manager', aal: 'aal1' }, 'pricing.view_cost'),
    ).toBe(false);
    expect(
      isAllowed({ role: 'manager', aal: 'aal2' }, 'pricing.view_cost'),
    ).toBe(true);
    expect(isAllowed({ role: 'store_staff', aal: 'aal1' }, 'orders.view')).toBe(
      true,
    );
    expect(
      isAllowed({ role: 'content_editor', aal: 'aal2' }, 'pricing.view_cost'),
    ).toBe(false);
  });

  it('todo permiso con aal2 pertenece al catálogo', () => {
    for (const permission of AAL2_PERMISSIONS) {
      expect(PERMISSIONS).toContain(permission);
    }
  });
});
