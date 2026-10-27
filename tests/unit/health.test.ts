import { beforeEach, describe, expect, it, vi } from 'vitest';

const { client, query, abortSignal } = vi.hoisted(() => {
  const abortSignal = vi.fn();
  const query = {
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    abortSignal,
  };
  return { client: vi.fn(), query, abortSignal };
});
vi.mock('@/lib/supabase/public', () => ({
  createSupabasePublicClient: client,
}));
import { GET } from '@/app/api/health/route';

describe('sonda de salud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    abortSignal.mockResolvedValue({
      error: null,
      data: [{ id: 'never-public' }],
    });
  });
  it('liveness sigue respondiendo sin consultar la base', async () => {
    const response = await GET(new Request('https://example.com/api/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      service: 'adhara-web',
    });
    expect(client).not.toHaveBeenCalled();
  });
  it('readiness comprueba una lectura mínima con plazo y no devuelve datos', async () => {
    const response = await GET(
      new Request('https://example.com/api/health?check=readiness'),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ready',
      service: 'adhara-web',
    });
    expect(query.select).toHaveBeenCalledWith('id');
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it.each(['missing', 'error', 'timeout'])(
    'readiness devuelve 503 sin detalles: %s',
    async (failure) => {
      if (failure === 'missing') client.mockReturnValue(null);
      if (failure === 'error')
        abortSignal.mockResolvedValue({ error: { message: 'private-value' } });
      if (failure === 'timeout')
        abortSignal.mockRejectedValue(new Error('private-value'));
      const response = await GET(
        new Request('https://example.com/api/health?check=readiness'),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        status: 'unavailable',
        service: 'adhara-web',
      });
    },
  );
});
