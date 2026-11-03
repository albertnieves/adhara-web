import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, FORM_HOSTS, SCRIPT_HOSTS } from '@/lib/csp';
import { SUPABASE_COOKIE_OPTIONS } from '@/lib/supabase/config';
import { REDSYS_PAYMENT_URL } from '@/modules/payments/domain/redsys';

/*
 * Endurecimiento de la revisión del 03/11 (DECISIONS §187): CSP con scripts
 * solo de orígenes conocidos y sin eval, formularios solo a la tienda y al
 * banco, y cookies de la sesión fuera del alcance de los scripts.
 */

const directive = (policy: string, name: string) =>
  policy
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find(([key]) => key === name)
    ?.slice(1);

/** Comprueba un origen contra una fuente de CSP (con comodín a la izquierda). */
function allowed(url: string, sources: readonly string[]): boolean {
  const target = new URL(url);
  return sources.some((source) => {
    if (!source.startsWith('https://')) return false;
    const host = new URL(source.replace('*.', 'comodin.'));
    if (host.protocol !== target.protocol || host.port !== target.port)
      return false;
    return source.includes('*.')
      ? target.hostname.endsWith(host.hostname.replace(/^comodin/, ''))
      : target.hostname === host.hostname;
  });
}

describe('Content Security Policy', () => {
  const policy = contentSecurityPolicy({
    supabaseUrl: 'https://abcdefgh.supabase.co',
  });

  it('cierra marcos, plugins, <base> y eval', () => {
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(directive(policy, 'base-uri')).toEqual(["'self'"]);
    expect(directive(policy, 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(policy, 'script-src')).not.toContain('https:');
    expect(directive(policy, 'script-src')).not.toContain('*');
  });

  it('eval solo en desarrollo (recarga en caliente)', () => {
    expect(
      directive(contentSecurityPolicy({ dev: true }), 'script-src'),
    ).toContain("'unsafe-eval'");
  });

  it('los formularios solo van a la tienda, al banco y al acceso con Google', () => {
    const forms = directive(policy, 'form-action') ?? [];
    expect(forms[0]).toBe("'self'");
    for (const url of Object.values(REDSYS_PAYMENT_URL))
      expect(allowed(url, forms), url).toBe(true);
    expect(forms).toContain('https://abcdefgh.supabase.co');
    expect(allowed('https://evil.example/robar', forms)).toBe(false);
    // Sin URL de Supabase (o con una mal escrita) no se añade nada raro.
    expect(
      directive(
        contentSecurityPolicy({ supabaseUrl: 'no es una url' }),
        'form-action',
      ),
    ).toEqual(["'self'", ...FORM_HOSTS]);
  });

  it('las etiquetas de medición que carga la tienda están permitidas (§179)', () => {
    const runtime = readFileSync(
      new URL('../../src/modules/tracking/ui/runtime.ts', import.meta.url),
      'utf8',
    );
    const urls = [...runtime.matchAll(/https:\/\/[a-z0-9.-]+\.[a-z]+\//g)].map(
      ([url]) => url,
    );
    expect(urls.length).toBeGreaterThanOrEqual(3);
    const scripts = directive(policy, 'script-src') ?? [];
    for (const url of urls) expect(allowed(url, scripts), url).toBe(true);
    for (const host of SCRIPT_HOSTS) expect(host).toMatch(/^https:\/\//);
  });
});

describe('cookies de la sesión de Supabase', () => {
  it('no las puede leer un script de la página', () => {
    expect(SUPABASE_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(SUPABASE_COOKIE_OPTIONS.sameSite).toBe('lax');
    expect(SUPABASE_COOKIE_OPTIONS.path).toBe('/');
  });

  it('los tres clientes con sesión las usan', () => {
    for (const file of ['server.ts', 'proxy.ts']) {
      const source = readFileSync(
        new URL(`../../src/lib/supabase/${file}`, import.meta.url),
        'utf8',
      );
      const clients = source.match(/createServerClient[<(]/g) ?? [];
      const options =
        source.match(/cookieOptions: SUPABASE_COOKIE_OPTIONS/g) ?? [];
      expect(clients.length, file).toBeGreaterThan(0);
      expect(options.length, file).toBe(clients.length);
    }
  });
});
