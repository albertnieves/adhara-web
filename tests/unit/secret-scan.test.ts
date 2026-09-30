import { describe, expect, it } from 'vitest';
import { findSecrets } from '../../scripts/scan-secrets';

// Los ejemplos se construyen por partes para que el propio archivo no dispare
// el escaneo del repositorio.
const fake = (...parts: string[]) => parts.join('');

describe('escaneo de secretos', () => {
  it.each([
    ['Supabase secret key', fake('sb_', 'secret_', 'a'.repeat(24))],
    [
      'JWT (p. ej. service_role)',
      fake(
        'eyJ',
        'hbGciOiJIUzI1',
        '.eyJ',
        'yb2xlIjoic2Vy',
        '.',
        'x'.repeat(20),
      ),
    ],
    ['Clave privada', fake('-----BEGIN ', 'PRIVATE KEY-----')],
    ['Stripe', fake('sk_', 'live_', 'A'.repeat(24))],
    ['AWS access key', fake('AK', 'IA', 'ABCDEFGHIJKLMNOP')],
    ['GitHub token', fake('gh', 'p_', 'a'.repeat(36))],
    [
      'URL de Postgres con contraseña',
      fake('postgres', '://postgres:', 'supersecreta@db.ejemplo:5432'),
    ],
  ])('detecta %s', (name, value) => {
    expect(findSecrets(`const x = "${value}";`)).toEqual([{ name, line: 1 }]);
  });

  it('no marca la clave publicable ni textos normales', () => {
    const text = [
      fake(
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_',
        'publishable_',
        'a'.repeat(30),
      ),
      'SUPABASE_SECRET_KEY=',
      'postgres://localhost:5432/adhara',
      '"integrity": "sha512-abc"',
    ].join('\n');
    expect(findSecrets(text)).toEqual([]);
  });

  it('respeta la marca de excepción explícita', () => {
    const value = fake('sk_', 'test_', 'B'.repeat(24));
    expect(findSecrets(`${value} // secret-scan: allow`)).toEqual([]);
  });
});
