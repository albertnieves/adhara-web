import { pathToFileURL } from 'node:url';

export type HealthCheck = { check: 'liveness' | 'readiness'; ok: boolean };

/** Sonda de lectura: no usa credenciales, no acepta redirecciones ni publica cuerpos. */
export async function checkSiteHealth(
  origin: string,
  fetcher: typeof fetch = fetch,
): Promise<HealthCheck[]> {
  const base = new URL(origin);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/'
  )
    throw new Error('Usa un origen sin ruta, credenciales ni parámetros.');
  if (
    base.protocol !== 'https:' &&
    !(
      base.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(base.hostname)
    )
  )
    throw new Error('La sonda requiere HTTPS (HTTP solo en localhost).');

  return Promise.all(
    (['liveness', 'readiness'] as const).map(async (check) => {
      const url = new URL('/api/health', base);
      if (check === 'readiness') url.searchParams.set('check', 'readiness');
      try {
        const response = await fetcher(url, {
          signal: AbortSignal.timeout(10_000),
          redirect: 'error',
          cache: 'no-store',
        });
        const body: unknown = await response.json();
        const expected = check === 'liveness' ? 'ok' : 'ready';
        const ok =
          response.ok &&
          typeof body === 'object' &&
          body !== null &&
          'status' in body &&
          body.status === expected &&
          'service' in body &&
          body.service === 'adhara-web';
        return { check, ok };
      } catch {
        return { check, ok: false };
      }
    }),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const results = await checkSiteHealth(
      process.argv[2] ?? 'https://latelierdudesert.com',
    );
    for (const { check, ok } of results)
      console.log(`${check}: ${ok ? 'OK' : 'ERROR'}`);
    if (results.some((result) => !result.ok)) process.exitCode = 1;
  } catch {
    console.error('Origen de monitorización no válido.');
    process.exitCode = 1;
  }
}
