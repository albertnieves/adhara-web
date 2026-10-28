import { describe, expect, it } from 'vitest';
import {
  assertPublicSourceKey,
  assertSourceMedia,
  catalogSql,
  databaseEnvironment,
  isLocalMedia,
  parseSnapshot,
  previewRef,
} from '../../scripts/preview-catalog';
import { PRODUCTION_SUPABASE_REF } from '../../scripts/check-deployment-environment';
import { previewCatalogFixture } from '../fixtures/preview-catalog';

const ref = 'abcdefghijklmnopqrst';
const source = 'https://' + PRODUCTION_SUPABASE_REF + '.supabase.co';
const connection = (host: string) =>
  'postgresql://postgres:' + 'test-only' + '@' + host + ':5432/postgres';

describe('copia aislada del catálogo', () => {
  it('admite exclusivamente una referencia de pruebas distinta', () => {
    expect(previewRef(ref)).toBe(ref);
    for (const value of [
      undefined,
      '',
      PRODUCTION_SUPABASE_REF,
      'db.' + ref,
      ref + '/',
    ])
      expect(() => previewRef(value)).toThrow();
  });
  it('rechaza la conexión real aunque se declare una referencia de pruebas', () => {
    expect(() =>
      databaseEnvironment(
        connection('db.' + PRODUCTION_SUPABASE_REF + '.supabase.co'),
        ref,
      ),
    ).toThrow();
    expect(() =>
      databaseEnvironment(
        connection('db.' + ref + '.supabase.co'),
        PRODUCTION_SUPABASE_REF,
      ),
    ).toThrow();
  });
  it.each([
    'db.' + ref + '.supabase.co.attacker.invalid',
    'localhost',
    '127.0.0.1',
    'pooler.supabase.com',
  ])('rechaza destinos ambiguos: %s', (host) => {
    expect(() => databaseEnvironment(connection(host), ref)).toThrow();
  });
  it('exige TLS verificado y no permite parámetros que cambien el destino', () => {
    const url = connection('db.' + ref + '.supabase.co');
    expect(databaseEnvironment(url, ref)).toMatchObject({
      PGHOST: 'db.' + ref + '.supabase.co',
      PGSSLMODE: 'verify-full',
      PGDATABASE: 'postgres',
    });
    for (const suffix of ['?host=localhost', '?sslmode=disable', '#fragment'])
      expect(() => databaseEnvironment(url + suffix, ref)).toThrow();
  });
  it('rechaza claves privilegiadas o JWT de otro proyecto en el origen', () => {
    expect(() => assertPublicSourceKey('sb_publishable_example')).not.toThrow();
    const jwt = (role: string, project = PRODUCTION_SUPABASE_REF) =>
      'header.' +
      Buffer.from(JSON.stringify({ role, ref: project })).toString(
        'base64url',
      ) +
      '.signature';
    expect(() => assertPublicSourceKey(jwt('anon'))).not.toThrow();
    for (const key of [
      undefined,
      'private',
      jwt('service_role'),
      jwt('anon', ref),
    ])
      expect(() => assertPublicSourceKey(key)).toThrow();
  });
  it('no acepta cuentas, pedidos, costes ni campos nuevos dentro de la captura', () => {
    const fixture = previewCatalogFixture();
    expect(() => parseSnapshot({ ...fixture, users: [] })).toThrow();
    expect(() =>
      parseSnapshot({ ...fixture, tables: { ...fixture.tables, orders: [] } }),
    ).toThrow();
    fixture.tables.product_variants[0] = {
      ...fixture.tables.product_variants[0]!,
      cost: 1,
    } as never;
    expect(() => parseSnapshot(fixture)).toThrow();
  });
  it('rechaza catálogo vacío, borradores, duplicados y relaciones incompletas', () => {
    for (const mutate of [
      (f: ReturnType<typeof previewCatalogFixture>) => {
        f.tables.products = [];
      },
      (f: ReturnType<typeof previewCatalogFixture>) => {
        f.tables.brands = [];
      },
      (f: ReturnType<typeof previewCatalogFixture>) => {
        f.tables.product_variants = [];
      },
      (f: ReturnType<typeof previewCatalogFixture>) => {
        f.tables.products.push(f.tables.products[0]!);
      },
      (f: ReturnType<typeof previewCatalogFixture>) => {
        f.tables.products[0]!.status = 'draft' as never;
      },
    ]) {
      const fixture = previewCatalogFixture();
      mutate(fixture);
      expect(() => parseSnapshot(fixture)).toThrow();
    }
  });
  it('solo descarga imágenes del bucket público de origen', () => {
    expect(() =>
      assertSourceMedia(
        source + '/storage/v1/object/public/product-media/perfume.jpg',
      ),
    ).not.toThrow();
    for (const url of [
      'https://attacker.invalid/image.jpg',
      source + '/storage/v1/object/public/system-backups/private.json',
      source +
        '/storage/v1/object/public/product-media/photo.jpg?token=private',
      source + '/storage/v1/object/public/product-media/%2e%2e/private',
    ])
      expect(() => assertSourceMedia(url)).toThrow();
    expect(isLocalMedia('/media/perfume.jpg')).toBe(true);
    for (const url of [
      '//attacker.invalid/x',
      '/media/../.env',
      '/media/%2e%2e/x',
    ])
      expect(isLocalMedia(url)).toBe(false);
  });
  it('reemplaza las imágenes por el Storage de pruebas y exige copia completa', () => {
    const fixture = previewCatalogFixture();
    const id = '00000000-0000-4000-8000-00000000cf04';
    fixture.tables.product_media.push({
      id,
      product_id: fixture.tables.products[0]!.id,
      url: source + '/storage/v1/object/public/product-media/image.jpg',
      alt: null,
      role: 'hero',
      origin: 'own_photo',
      source: null,
      provisional: false,
      position: 0,
    });
    expect(() => parseSnapshot(fixture)).toThrow();
    fixture.assets.push({
      mediaId: id,
      sha256: 'a'.repeat(64),
      contentType: 'image/jpeg',
    });
    const sql = catalogSql(fixture, ref);
    expect(sql).toContain(
      'https://' +
        ref +
        '.supabase.co/storage/v1/object/public/product-media/preview-catalog/',
    );
    expect(sql).not.toContain(fixture.tables.product_media[0]!.url);
  });
  it('el simulacro no confirma; aplica todo el catálogo dentro de una transacción', () => {
    const sql = catalogSql(previewCatalogFixture(), ref);
    expect(sql).toContain('begin;');
    expect(sql).toContain('lock table public.brands');
    expect(sql).toContain('El destino debe estar vacío');
    expect(sql).toContain('"status":"draft"');
    expect(sql).toContain('"compare_at_price_cents":null');
    expect(sql).toContain('"retail_price_cents":4990');
    expect(sql).toContain("update public.products set status = 'published'");
    expect(sql).toMatch(/rollback;$/);
    expect(catalogSql(previewCatalogFixture(), ref, true)).toMatch(/commit;$/);
    expect(sql).not.toMatch(
      /disable trigger|session_replication_role|delete from|truncate/i,
    );
  });
  it('los textos del catálogo no pueden cerrar el literal SQL', () => {
    const fixture = previewCatalogFixture();
    fixture.tables.products[0]!.name =
      "$catalog$'; drop table public.products; --";
    const sql = catalogSql(fixture, ref);
    expect(sql).toContain('$catalog_x$');
    expect(sql).toContain('"name":"$catalog$');
  });
});
