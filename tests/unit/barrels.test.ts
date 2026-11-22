import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OPTIMIZED_BARRELS } from '@/lib/barrels';

/*
 * Los index.ts que Next recorta (optimizePackageImports, DECISIONS §200):
 * tienen que ser solo reexportaciones, y un módulo nuevo con un índice así
 * tiene que estar en la lista, o sus páginas vuelven a cargar todo lo que
 * exporta.
 */

const root = join(import.meta.dirname, '../../src');

function indexFile(alias: string): string {
  return join(root, alias.replace(/^@\//, ''), 'index.ts');
}

/** Sentencias que no son `export … from '…'`. */
function ownCode(file: string): string[] {
  const source = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  return source
    .split(/;\s*/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter(
      (statement) =>
        !/^export\s+(type\s+)?(\{[\s\S]*\}|\*)\s+from\s+['"]/.test(statement),
    );
}

function projectBarrels(): string[] {
  const modules = join(root, 'modules');
  const found = ['@/components/ui'];
  for (const name of readdirSync(modules)) {
    for (const sub of ['', '/ui']) {
      if (existsSync(join(modules, name + sub, 'index.ts'))) {
        found.push(`@/modules/${name}${sub}`);
      }
    }
  }
  return found;
}

describe('optimizePackageImports', () => {
  it('cada índice de la lista solo reexporta', () => {
    for (const alias of OPTIMIZED_BARRELS) {
      expect(existsSync(indexFile(alias)), alias).toBe(true);
      expect(ownCode(indexFile(alias)), alias).toEqual([]);
    }
  });

  it('están todos los índices que solo reexportan', () => {
    const pure = projectBarrels().filter(
      (alias) => ownCode(indexFile(alias)).length === 0,
    );
    expect([...OPTIMIZED_BARRELS].sort()).toEqual(pure.sort());
  });
});
