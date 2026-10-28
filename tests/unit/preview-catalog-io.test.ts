import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { exportCatalog, importCatalog } from '../../scripts/preview-catalog';
import { previewCatalogFixture } from '../fixtures/preview-catalog';
import { PRODUCTION_SUPABASE_REF } from '../../scripts/check-deployment-environment';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));
let directory: string;
const ref = 'abcdefghijklmnopqrst';
const bytes = Buffer.from('image fixture');
const sha256 = createHash('sha256').update(bytes).digest('hex');

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'atelier-preview-'));
  vi.stubEnv('SOURCE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example');
  vi.stubEnv('ATELIER_PREVIEW_SUPABASE_REF', ref);
  vi.stubEnv(
    'PREVIEW_DATABASE_URL',
    'postgresql://postgres:' +
      'test-only' +
      '@db.' +
      ref +
      '.supabase.co:5432/postgres',
  );
  vi.stubEnv('PREVIEW_SUPABASE_SECRET_KEY', 'destination-only');
  vi.mocked(spawnSync).mockReset();
  vi.mocked(spawnSync).mockReturnValue({ status: 0 } as ReturnType<
    typeof spawnSync
  >);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

async function savedCapture() {
  const fixture = previewCatalogFixture();
  const mediaId = '00000000-0000-4000-8000-00000000cf04';
  fixture.tables.product_media.push({
    id: mediaId,
    product_id: fixture.tables.products[0]!.id,
    url:
      'https://' +
      PRODUCTION_SUPABASE_REF +
      '.supabase.co/storage/v1/object/public/product-media/photo.jpg',
    alt: null,
    role: 'hero',
    origin: 'own_photo',
    source: null,
    provisional: false,
    position: 0,
  });
  fixture.assets.push({ mediaId, sha256, contentType: 'image/jpeg' });
  await mkdir(join(directory, 'media'));
  await writeFile(join(directory, 'media', sha256), bytes);
  await writeFile(join(directory, 'catalog.json'), JSON.stringify(fixture));
}

it('exporta por GET, pagina y no pide tablas operativas ni columnas privadas', async () => {
  const fixture = previewCatalogFixture();
  for (let i = 0; i < 499; i++)
    fixture.tables.brands.push({
      id: '00000000-0000-4000-8000-' + i.toString(16).padStart(12, '0'),
      slug: 'fixture-' + i,
      name: 'Marca ficticia',
    });
  const fetchMock = vi.fn(async (raw: string) => {
    const url = new URL(raw);
    const table = url.pathname.split('/').at(-1) as keyof typeof fixture.tables;
    const rows =
      url.searchParams.get('offset') === '0' ? fixture.tables[table] : [];
    return Response.json(rows);
  });
  vi.stubGlobal('fetch', fetchMock);
  const output = join(directory, 'capture');
  await exportCatalog(output);
  const saved = JSON.parse(
    await readFile(join(output, 'catalog.json'), 'utf8'),
  );
  expect(saved.tables.brands).toHaveLength(500);
  expect(fetchMock).toHaveBeenCalledTimes(7);
  for (const call of fetchMock.mock.calls) {
    expect(call[0]).not.toMatch(
      /auth|orders|customers|internal|private|source_ref|select=\*/,
    );
    expect(call[0]).toContain(
      PRODUCTION_SUPABASE_REF + '.supabase.co/rest/v1/',
    );
  }
  expect(spawnSync).not.toHaveBeenCalled();
});

it('el simulacro ejecuta SQL con rollback y no toca Storage', async () => {
  vi.stubEnv('PGHOSTADDR', '192.0.2.1');
  vi.stubEnv('PGSERVICE', 'production');
  vi.stubEnv('PGOPTIONS', '-c session_replication_role=replica');
  await savedCapture();
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  await importCatalog(directory, false);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(spawnSync).toHaveBeenCalledTimes(1);
  const options = vi.mocked(spawnSync).mock.calls[0]![2]!;
  expect(options.input).toMatch(/rollback;$/);
  expect(options.env).toMatchObject({
    PGSSLMODE: 'verify-full',
    PGHOST: 'db.' + ref + '.supabase.co',
  });
  expect(options.env).not.toHaveProperty('PGHOSTADDR');
  expect(options.env).not.toHaveProperty('PGSERVICE');
  expect(options.env).not.toHaveProperty('PGOPTIONS');
});

it('al aplicar sube al destino aislado después del ensayo y confirma al final', async () => {
  await savedCapture();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (raw: string, init: RequestInit) => {
      expect(spawnSync).toHaveBeenCalledTimes(1);
      expect(raw).toBe(
        'https://' +
          ref +
          '.supabase.co/storage/v1/object/product-media/preview-catalog/' +
          sha256,
      );
      expect(init.method).toBe('POST');
      expect(init.redirect).toBe('error');
      return Response.json({ Key: 'copied' });
    }),
  );
  await importCatalog(directory, true);
  expect(spawnSync).toHaveBeenCalledTimes(2);
  expect(vi.mocked(spawnSync).mock.calls[1]![2]!.input).toMatch(/commit;$/);
});

it('una imagen alterada bloquea la carga antes de conectar con PostgreSQL', async () => {
  await savedCapture();
  await writeFile(join(directory, 'media', sha256), 'changed');
  await expect(importCatalog(directory, true)).rejects.toThrow(
    'Imagen alterada',
  );
  expect(spawnSync).not.toHaveBeenCalled();
});

it('un fallo de Storage no confirma el catálogo ni imprime respuestas del proveedor', async () => {
  await savedCapture();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('sensitive provider body', { status: 403 })),
  );
  await expect(importCatalog(directory, true)).rejects.toThrow('HTTP 403');
  expect(spawnSync).toHaveBeenCalledTimes(1);
  expect(vi.mocked(spawnSync).mock.calls[0]![2]!.input).toMatch(/rollback;$/);
});

it('un destino ocupado o SQL fallido no sube imágenes', async () => {
  await savedCapture();
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(spawnSync).mockReturnValue({
    status: 1,
    stderr: 'sensitive row',
  } as ReturnType<typeof spawnSync>);
  await expect(importCatalog(directory, true)).rejects.toThrow(
    'No se confirmó la transacción',
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
