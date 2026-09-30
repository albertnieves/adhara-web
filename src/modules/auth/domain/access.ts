import type { AuthenticatorLevel, StaffRole } from './permissions';

/**
 * Qué hacer con cada petición al panel. La decisión se repite en el layout
 * del admin, en cada Server Action y en RLS; el proxy solo refresca la sesión.
 */
export type AdminAccessInput = {
  userId: string | null;
  staff: { role: StaffRole; active: boolean } | null;
  aal: AuthenticatorLevel;
  hasVerifiedTotp: boolean;
};

export type AdminAccess =
  | { kind: 'login' }
  | { kind: 'not_found' }
  | { kind: 'enroll_mfa' }
  | { kind: 'verify_mfa' }
  | { kind: 'allow'; role: StaffRole };

export function decideAdminAccess(input: AdminAccessInput): AdminAccess {
  if (!input.userId) return { kind: 'login' };
  // Sin ficha de personal activa no se revela que el panel existe.
  if (!input.staff?.active) return { kind: 'not_found' };
  if (!input.hasVerifiedTotp) return { kind: 'enroll_mfa' };
  if (input.aal !== 'aal2') return { kind: 'verify_mfa' };
  return { kind: 'allow', role: input.staff.role };
}
