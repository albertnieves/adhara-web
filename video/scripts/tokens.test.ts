import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { VIDEO_ROOT, readJson } from './lib/cli.ts';
import {
  buildStyleBlock,
  checkTokens,
  composite,
  contrastRatio,
  flattenTokens,
  isRecord,
  parseColor,
} from './lib/tokens.ts';

const load = () => readJson(join(VIDEO_ROOT, 'design-system', 'tokens.json'));

/** Copia de los tokens con un cambio en `path` (a.b.c). */
function mutate(path: string, value: unknown): unknown {
  const tree = structuredClone(load());
  const keys = path.split('.');
  let node: unknown = tree;
  for (const key of keys.slice(0, -1)) {
    assert.ok(isRecord(node));
    node = node[key];
  }
  assert.ok(isRecord(node));
  node[keys.at(-1) ?? ''] = value;
  return tree;
}

const errorsFor = (tree: unknown) => checkTokens(tree).errors.join('\n');

test('contraste WCAG: valores de referencia', () => {
  assert.equal(
    contrastRatio(parseColor('#000000'), parseColor('#ffffff')).toFixed(2),
    '21.00',
  );
  assert.equal(
    contrastRatio(parseColor('#777777'), parseColor('#ffffff')).toFixed(2),
    '4.48',
  );
});

test('el alfa se mezcla sobre el fondo antes de medir', () => {
  const half = composite(parseColor('#ffffff80'), parseColor('#000000'));
  assert.ok(Math.abs(half.r - 128) < 1);
  const muted = contrastRatio(parseColor('#ffffff80'), parseColor('#000000'));
  assert.ok(
    muted < contrastRatio(parseColor('#ffffff'), parseColor('#000000')),
  );
});

test('los tokens propuestos pasan todas las reglas', () => {
  const report = checkTokens(load());
  assert.deepEqual(report.errors, []);
  assert.ok(report.contrast.length >= 9);
  assert.ok(report.contrast.every((pair) => pair.ok));
});

test('una duración fuera de 300–700 ms es un error', () => {
  assert.match(
    errorsFor(mutate('motion.duration.quick.$value', '200ms')),
    /entre 300 y 700/,
  );
  assert.match(
    errorsFor(mutate('motion.duration.scene.$value', '900ms')),
    /entre 300 y 700/,
  );
});

test('una curva con rebote es un error', () => {
  const tree = mutate('motion.easing.luxe.$value', [0.34, 1.56, 0.64, 1]);
  assert.match(errorsFor(tree), /sin rebote/);
});

test('un quinto color de marca es un error', () => {
  const tree = mutate('color.brand.violet', { $value: '#7c3aed' });
  assert.match(errorsFor(tree), /5 colores de marca/);
});

test('un rol con un color que no es de marca es un error', () => {
  const tree = mutate('color.role.accent.$value', '#00ffff');
  assert.match(errorsFor(tree), /no es un color de marca/);
});

test('una tercera familia tipográfica es un error', () => {
  const tree = mutate('font.family.mono', {
    $value: 'Space Mono',
    $extensions: {
      'com.latelierdudesert.video': { npm: '@fontsource/space-mono' },
    },
  });
  assert.match(errorsFor(tree), /3 familias/);
});

test('un tamaño fuera de la escala modular es un error', () => {
  assert.match(
    errorsFor(mutate('font.size.title.$value', '100px')),
    /el paso 3 da 95px/,
  );
});

test('un contraste insuficiente es un error', () => {
  const tree = mutate('color.role.text-muted.$value', '#f5f1ea40');
  assert.match(errorsFor(tree), /text-muted.*< 4.5:1/);
});

test('una rejilla con columnas no enteras es un error', () => {
  assert.match(
    errorsFor(mutate('grid.vertical.gutter.$value', '16px')),
    /deben ser enteras/,
  );
});

test('el bloque de estilo resuelve los colores de los tokens', () => {
  const block = buildStyleBlock(flattenTokens(load()));
  for (const hex of ['#0d0c0b', '#f5f1ea', '#a8844f', '#2a1d15'])
    assert.ok(block.includes(hex));
  assert.doesNotMatch(block, /\{color\./);
  assert.equal(block.split('\n').length, 6);
});
