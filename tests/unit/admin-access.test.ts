import { describe, expect, it } from 'vitest';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { decideAdminAccess } from '@/modules/auth';

const staff = { role: 'store_admin', active: true } as const;
const base = {
  userId: 'usuario',
  staff,
  aal: 'aal2',
  hasVerifiedTotp: true,
} as const;

describe('acceso al panel', () => {
  it('sin sesión: pantalla de acceso', () => {
    expect(decideAdminAccess({ ...base, userId: null })).toEqual({
      kind: 'login',
    });
  });

  it('sesión sin ficha de personal o inactiva: 404', () => {
    expect(decideAdminAccess({ ...base, staff: null })).toEqual({
      kind: 'not_found',
    });
    expect(
      decideAdminAccess({ ...base, staff: { ...staff, active: false } }),
    ).toEqual({ kind: 'not_found' });
  });

  it('personal sin app de autenticación: alta obligatoria', () => {
    expect(
      decideAdminAccess({ ...base, hasVerifiedTotp: false, aal: 'aal1' }),
    ).toEqual({ kind: 'enroll_mfa' });
  });

  it('personal con MFA sin verificar en esta sesión: código', () => {
    expect(decideAdminAccess({ ...base, aal: 'aal1' })).toEqual({
      kind: 'verify_mfa',
    });
  });

  it('personal con aal2: panel con su rol', () => {
    expect(decideAdminAccess(base)).toEqual({
      kind: 'allow',
      role: 'store_admin',
    });
  });
});

describe('configuración pública de Supabase', () => {
  it('sin variables el panel queda cerrado', () => {
    expect(getSupabaseConfig({})).toBeNull();
    expect(
      getSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'no-es-url',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_0123456789',
      }),
    ).toBeNull();
  });

  it('acepta URL y clave publicable válidas', () => {
    expect(
      getSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://ejemplo.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_0123456789',
      }),
    ).toEqual({
      url: 'https://ejemplo.supabase.co',
      publishableKey: 'sb_publishable_0123456789',
    });
  });
});
