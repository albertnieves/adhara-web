import type { StaffRole } from './permissions';

export const ROLE_LABELS: Readonly<Record<StaffRole, string>> = {
  system_admin: 'Administrador del sistema',
  store_admin: 'Administrador de la tienda',
  viewer: 'Encargado',
};
