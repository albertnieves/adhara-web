import { describe, expect, it } from 'vitest';
import { routing } from '../../src/modules/i18n/routing';
import es from '../../messages/es.json';
import ca from '../../messages/ca.json';
import en from '../../messages/en.json';
describe('idiomas', () => {
  it.each([ca, en])('conserva todas las claves en cada idioma', (messages) => {
    expect(Object.keys(messages)).toEqual(Object.keys(es));
    expect(Object.keys(messages.setup).sort()).toEqual(
      Object.keys(es.setup).sort(),
    );
  });
  it('todas las rutas tienen traducciones únicas en los idiomas soportados', () => {
    for (const locale of routing.locales) {
      const paths = Object.values(routing.pathnames).map((path) =>
        typeof path === 'string' ? path : path[locale],
      );
      expect(paths.every((path) => path.startsWith('/'))).toBe(true);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });
});
