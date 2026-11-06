import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { VIDEO_ROOT, readJson } from './lib/cli.ts';
import { buildExcalidraw, wrap } from './lib/excalidraw.ts';
import type { Storyboard } from './lib/storyboard.ts';
import { countWords, validateStoryboard } from './lib/storyboard.ts';
import { groupExtensions } from './lib/tokens.ts';

const tokens = readJson(join(VIDEO_ROOT, 'design-system', 'tokens.json'));
const example = () =>
  readJson(join(VIDEO_ROOT, 'storyboard', 'ejemplo.json')) as Storyboard;
const lucide = join(VIDEO_ROOT, 'node_modules', 'lucide-static', 'icons');
const iconExists = (name: string) => existsSync(join(lucide, `${name}.svg`));

function check(edit: (s: Storyboard) => void = () => {}, slug = 'ejemplo') {
  const storyboard = example();
  edit(storyboard);
  return validateStoryboard(storyboard, tokens, { slug, iconExists }).report;
}
const errorsOf = (edit: (s: Storyboard) => void) =>
  check(edit).errors.join('\n');
const first = (s: Storyboard) => {
  const scene = s.scenes[0];
  assert.ok(scene);
  return scene;
};

test('el storyboard de ejemplo es válido: 3 escenas y 19 s', () => {
  const report = check();
  assert.deepEqual(report.errors, []);
  assert.equal(report.scenes, 3);
  assert.equal(report.totalSeconds, 19);
  assert.equal(
    report.warnings.filter((w) => w.includes('no tiene fuente')).length,
    3,
  );
});

test('cuenta las palabras que se leen, no los signos', () => {
  assert.equal(countWords('≈15 min'), 2);
  assert.equal(countWords('2–4 h'), 2);
  assert.equal(countWords('Salida · – +'), 1);
});

test('más de 12 palabras o sin tiempo para leerlas es un error', () => {
  assert.match(
    errorsOf((s) => {
      first(s).onScreen.statement =
        'Una frase demasiado larga para una sola idea en una escena corta.';
    }),
    /palabras en pantalla \(máximo 12\)/,
  );
  assert.match(
    errorsOf((s) => {
      first(s).durationSeconds = 4;
    }),
    /pide 5\.8 s y la escena dura 4 s/,
  );
});

test('un clip de LTX de más de 8 s es un error', () => {
  assert.match(
    errorsOf((s) => {
      first(s).durationSeconds = 9;
    }),
    /un clip de LTX dura de 4 a 8 s/,
  );
});

test('iconos: prohibidos y que no existen en Lucide', () => {
  assert.match(
    errorsOf((s) => {
      first(s).icon = 'sparkles';
    }),
    /«sparkles» está prohibido/,
  );
  assert.match(
    errorsOf((s) => {
      first(s).icon = 'reloj-de-arena';
    }),
    /no es un icono de Lucide/,
  );
});

test('la lista de iconos prohibidos son iconos reales de Lucide', () => {
  const forbidden = groupExtensions(tokens, 'icon')?.forbidden;
  assert.ok(Array.isArray(forbidden));
  for (const name of forbidden)
    assert.ok(iconExists(String(name)), String(name));
});

test('movimiento: valores sueltos y demasiados movimientos son errores', () => {
  assert.match(
    errorsOf((s) => {
      const motion = first(s).motion[0];
      assert.ok(motion);
      motion.duration = '450ms';
    }),
    /«450ms» no es una duración de los tokens/,
  );
  assert.match(
    errorsOf((s) => {
      const scene = first(s);
      const motion = scene.motion[0];
      assert.ok(motion);
      scene.motion = [motion, motion, motion, motion];
    }),
    /4 movimientos \(máximo 3\)/,
  );
});

test('composición: fuera de la rejilla o dentro de la zona segura es un error', () => {
  assert.match(
    errorsOf((s) => {
      first(s).layout.vertical.text = [1, 13];
    }),
    /fuera de la rejilla de 12/,
  );
  assert.match(
    errorsOf((s) => {
      first(s).layout.vertical.text = [5, 12];
    }),
    /llega a 1008px y la zona segura empieza en 936px/,
  );
});

test('como máximo una escena centrada', () => {
  assert.match(
    errorsOf((s) => {
      for (const scene of s.scenes) scene.onScreen.align = 'center';
    }),
    /3 escenas centradas/,
  );
});

test('la última escena no funde con otra', () => {
  assert.match(
    errorsOf((s) => {
      const last = s.scenes.at(-1);
      assert.ok(last?.transitionOut);
      last.transitionOut.type = 'dissolve';
    }),
    /la última escena no puede fundir/,
  );
});

test('una cifra sin afirmación es un error', () => {
  assert.match(
    errorsOf((s) => {
      first(s).claims = [];
    }),
    /no tiene afirmación asociada/,
  );
});

test('ids repetidos, slug y formatos que no casan son errores', () => {
  assert.match(
    errorsOf((s) => {
      const [a, b] = s.scenes;
      assert.ok(a && b);
      b.id = a.id;
    }),
    /el id está repetido/,
  );
  assert.match(
    check(() => {}, 'otro').errors.join('\n'),
    /el archivo es otro\.json/,
  );
  assert.match(
    errorsOf((s) => {
      const format = s.formats[0];
      assert.ok(format);
      format.height = 1350;
    }),
    /1080×1350 no coincide/,
  );
});

test('una forma rota se rechaza antes de aplicar las reglas', () => {
  const { storyboard, report } = validateStoryboard(
    { slug: 'ejemplo' },
    tokens,
    {
      slug: 'ejemplo',
    },
  );
  assert.equal(storyboard, null);
  assert.ok(report.errors.length > 0);
});

test('wrap no pasa del ancho ni corta palabras', () => {
  const lines = wrap('Lo primero que hueles, lo primero que se va.', 16);
  assert.ok(lines.every((line) => line.length <= 16));
  assert.equal(lines.join(' '), 'Lo primero que hueles, lo primero que se va.');
});

test('el .excalidraw es determinista y tiene un frame por escena', () => {
  const storyboard = example();
  const a = buildExcalidraw(storyboard, tokens);
  const b = buildExcalidraw(example(), tokens);
  assert.deepEqual(a, b);
  const frames = a.elements.filter((e) => e.type === 'frame');
  assert.deepEqual(
    frames.map((f) => f.name),
    ['1 · Salida', '2 · Corazón', '3 · Fondo'],
  );
  const ids = a.elements.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  const frameIds = new Set(frames.map((f) => f.id));
  for (const e of a.elements) {
    if (e.frameId !== null)
      assert.ok(frameIds.has(String(e.frameId)), String(e.id));
    if (e.type === 'text') assert.equal(e.text, e.originalText);
  }
});

test('el .excalidraw versionado está al día con el JSON', () => {
  const built = `${JSON.stringify(buildExcalidraw(example(), tokens), null, 2)}\n`;
  const saved = JSON.stringify(
    readJson(join(VIDEO_ROOT, 'storyboard', 'ejemplo.excalidraw')),
    null,
    2,
  );
  assert.equal(
    built,
    `${saved}\n`,
    'Ejecuta npm run storyboard -- --slug ejemplo',
  );
});
