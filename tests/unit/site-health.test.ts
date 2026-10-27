import { describe, expect, it, vi } from 'vitest';
import { checkSiteHealth } from '../../scripts/check-site-health';

describe('monitor externo', () => {
  it('no confunde la antigua liveness con disponibilidad de Supabase', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ status: 'ok', service: 'adhara-web' }),
      );
    const results = await checkSiteHealth('https://example.com', fetcher);
    expect(results).toEqual([
      { check: 'liveness', ok: true },
      { check: 'readiness', ok: false },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: 'error', cache: 'no-store' }),
    );
  });
  it('acepta las dos sondas solo con el cuerpo y estado HTTP correctos', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: URL) =>
      Response.json({
        status: url.search ? 'ready' : 'ok',
        service: 'adhara-web',
      }),
    );
    expect(
      (await checkSiteHealth('http://127.0.0.1:3000', fetcher)).every(
        (r) => r.ok,
      ),
    ).toBe(true);
  });
  it('marca fallo de HTTP, JSON o red sin imprimir la respuesta', async () => {
    for (const fetcher of [
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { status: 'ready', service: 'adhara-web' },
            { status: 503 },
          ),
        ),
      vi.fn().mockResolvedValue(new Response('<html>error</html>')),
      vi.fn().mockRejectedValue(new Error('network')),
    ])
      expect(
        (await checkSiteHealth('https://example.com', fetcher)).every(
          (r) => !r.ok,
        ),
      ).toBe(true);
  });
  it.each([
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com/path',
    'https://example.com?token=secret',
  ])('rechaza un origen no válido: %s', async (origin) => {
    const fetcher = vi.fn();
    await expect(checkSiteHealth(origin, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
