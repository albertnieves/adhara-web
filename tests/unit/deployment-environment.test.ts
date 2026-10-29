import { describe, expect, it } from 'vitest';
import {
  deploymentEnvironmentIssues,
  PRODUCTION_SUPABASE_REF,
  TRACKING_ID_FORMATS,
} from '../../scripts/check-deployment-environment';
import { TRACKING_ENV, TRACKING_ID_PATTERNS } from '../../src/modules/tracking';

const production = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`;
const previewRef = 'abcdefghijklmnopqrst';
const isolated = {
  VERCEL_ENV: 'preview',
  NEXT_PUBLIC_SUPABASE_URL: `https://${previewRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
  ATELIER_PREVIEW_SUPABASE_REF: previewRef,
};

describe('aislamiento de despliegues', () => {
  it('no exige infraestructura remota al desarrollo ni a la CI local', () => {
    expect(deploymentEnvironmentIssues({})).toEqual([]);
    expect(deploymentEnvironmentIssues({ VERCEL_ENV: 'development' })).toEqual(
      [],
    );
  });
  it('admite una preview desconectada o una base aislada declarada', () => {
    expect(deploymentEnvironmentIssues({ VERCEL_ENV: 'preview' })).toEqual([]);
    expect(deploymentEnvironmentIssues(isolated)).toEqual([]);
  });
  it('rechaza el proyecto real aunque se declare como preview', () => {
    const issues = deploymentEnvironmentIssues({
      ...isolated,
      NEXT_PUBLIC_SUPABASE_URL: production,
      ATELIER_PREVIEW_SUPABASE_REF: PRODUCTION_SUPABASE_REF,
    });
    expect(issues.join(' ')).toContain('base real');
  });
  it('exige declarar la base de pruebas que se conecta', () => {
    expect(
      deploymentEnvironmentIssues({
        ...isolated,
        ATELIER_PREVIEW_SUPABASE_REF: '',
      }),
    ).not.toEqual([]);
    expect(
      deploymentEnvironmentIssues({
        ...isolated,
        ATELIER_PREVIEW_SUPABASE_REF: 'otra',
      }),
    ).not.toEqual([]);
  });
  it.each([
    'http://abcdefghijklmnopqrst.supabase.co',
    'https://user:password@abcdefghijklmnopqrst.supabase.co',
    'https://abcdefghijklmnopqrst.supabase.co:8443',
    'https://abcdefghijklmnopqrst.supabase.co/rest/v1',
    'https://abcdefghijklmnopqrst.supabase.co?key=private',
    'https://abcdefghijklmnopqrst.supabase.co#fragment',
    'https://abcdefghijklmnopqrst.supabase.co.ejemplo.com',
    'not-a-url',
  ])('rechaza URLs ambiguas o ajenas: %s', (url) => {
    expect(
      deploymentEnvironmentIssues({
        ...isolated,
        NEXT_PUBLIC_SUPABASE_URL: url,
      }),
    ).not.toEqual([]);
  });
  it('no deja una clave privilegiada en una preview sin base', () => {
    expect(
      deploymentEnvironmentIssues({
        VERCEL_ENV: 'preview',
        SUPABASE_SECRET_KEY: 'private-value',
      }).join(' '),
    ).toContain('sin una base aislada');
  });
  it('no admite pares incompletos de configuración pública', () => {
    expect(
      deploymentEnvironmentIssues({
        ...isolated,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      }),
    ).not.toEqual([]);
  });
  it('permite el TPV de pruebas, rechaza live y evita salida de correo real', () => {
    expect(
      deploymentEnvironmentIssues({
        ...isolated,
        REDSYS_ENVIRONMENT: 'test',
        REDSYS_SECRET_KEY: 'private-value',
      }),
    ).toEqual([]);
    const issues = deploymentEnvironmentIssues({
      ...isolated,
      REDSYS_ENVIRONMENT: 'live',
      REDSYS_SECRET_KEY: 'private-value',
      RESEND_API_KEY: 'private-value',
      CRON_SECRET: 'private-value',
    });
    expect(issues.join(' ')).toContain('REDSYS_ENVIRONMENT=test');
    expect(issues.join(' ')).toContain('RESEND_API_KEY');
    expect(issues.join(' ')).not.toContain('private-value');
  });
  it('Production mantiene la base real y el TPV live', () => {
    const live = {
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: production,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
      REDSYS_ENVIRONMENT: 'live',
    };
    expect(deploymentEnvironmentIssues(live)).toEqual([]);
    expect(
      deploymentEnvironmentIssues({
        ...live,
        NEXT_PUBLIC_SUPABASE_URL: isolated.NEXT_PUBLIC_SUPABASE_URL,
      }),
    ).not.toEqual([]);
    expect(
      deploymentEnvironmentIssues({ ...live, REDSYS_ENVIRONMENT: 'test' }),
    ).not.toEqual([]);
    expect(
      deploymentEnvironmentIssues({ VERCEL_ENV: 'production' }),
    ).not.toEqual([]);
  });
});

describe('IDs de analítica y publicidad (DECISIONS §179)', () => {
  const productionBase = {
    VERCEL_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: production,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
  };

  it('Production para el build con un ID mal escrito, sin mostrarlo', () => {
    expect(
      deploymentEnvironmentIssues({
        ...productionBase,
        NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-ABC123XYZ9',
        NEXT_PUBLIC_META_PIXEL_ID: '1234567890123456',
      }),
    ).toEqual([]);
    const issues = deploymentEnvironmentIssues({
      ...productionBase,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: 'UA-1234-1',
      NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL: 'AbC-dEf_123',
    });
    expect(issues).toEqual([
      'NEXT_PUBLIC_GA_MEASUREMENT_ID no tiene el formato esperado.',
      'NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL necesita NEXT_PUBLIC_GOOGLE_ADS_ID.',
    ]);
  });

  it('una Preview con los IDs compila (no mide, pero no falla)', () => {
    expect(
      deploymentEnvironmentIssues({
        VERCEL_ENV: 'preview',
        NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-ABC123XYZ9',
      }),
    ).toEqual([]);
  });

  it('usa los mismos formatos que la tienda', () => {
    const samples = [
      'G-ABC123XYZ9',
      'UA-1234-1',
      'AW-123456789',
      'AW-12',
      'AbC-dEf_123',
      'a b',
      '1234567890123456',
      '12ab',
      'CABCDEFGHIJ1234567890',
      'cabcdefghij1234567890',
      '',
    ];
    for (const [key, name] of Object.entries(TRACKING_ENV)) {
      const app = TRACKING_ID_PATTERNS[key as keyof typeof TRACKING_ENV];
      const script = TRACKING_ID_FORMATS[name]!;
      for (const sample of samples)
        expect(script.test(sample), `${name} ${sample}`).toBe(app.test(sample));
    }
    expect(Object.keys(TRACKING_ID_FORMATS).sort()).toEqual(
      Object.values(TRACKING_ENV).sort(),
    );
  });
});
