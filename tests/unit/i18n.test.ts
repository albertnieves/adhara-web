import { describe, expect, it } from 'vitest';
import { routing } from '../../src/modules/i18n/routing';
import es from '../../messages/es.json';
import ca from '../../messages/ca.json';
import en from '../../messages/en.json';

/** Todas las claves anidadas («home.heroTitle»…), para comparar idiomas. */
function keysOf(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keysOf(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('idiomas', () => {
  it.each([
    ['ca', ca],
    ['en', en],
  ])('%s tiene exactamente las mismas claves que es', (_, messages) => {
    expect(keysOf(messages).sort()).toEqual(keysOf(es).sort());
  });

  it('ningún texto está vacío', () => {
    for (const messages of [es, ca, en]) {
      const values = keysOf(messages).map((key) =>
        key
          .split('.')
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)[part],
            messages,
          ),
      );
      expect(values.every((v) => typeof v === 'string' && v.trim())).toBe(true);
    }
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
