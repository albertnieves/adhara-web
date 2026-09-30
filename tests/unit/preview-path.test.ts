import { describe, expect, it } from 'vitest';
import { storefrontPath } from '@/modules/storefront/domain/preview-path';

describe('destino de la vista previa de la tienda', () => {
  it('acepta rutas de la tienda en un idioma soportado', () => {
    expect(storefrontPath('/es')).toBe('/es');
    expect(storefrontPath('/ca/cataleg')).toBe('/ca/cataleg');
    expect(storefrontPath('/en/fragrance/asad')).toBe('/en/fragrance/asad');
    expect(storefrontPath('/es?x=1')).toBe('/es?x=1');
  });

  it.each([
    null,
    '',
    'https://ejemplo.com/es',
    '//ejemplo.com/es',
    '/\\ejemplo.com',
    '/es\\..\\admin',
    '/admin',
    '/xx/catalogo',
    'es/catalogo',
    '/esx',
  ])('rechaza %s y vuelve a /es', (value) => {
    expect(storefrontPath(value)).toBe('/es');
  });
});
