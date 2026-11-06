// Etapa 1 · valida storyboard/<slug>.json contra los tokens y genera
// storyboard/<slug>.excalidraw. Informe en build/<slug>/storyboard/report.json.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  VIDEO_ROOT,
  fail,
  readJson,
  readSlug,
  stageDir,
  writeIfChanged,
} from './lib/cli.ts';
import { buildExcalidraw } from './lib/excalidraw.ts';
import { validateStoryboard } from './lib/storyboard.ts';

const slug = readSlug(process.argv, true) ?? fail('Falta el slug.');
const source = join(VIDEO_ROOT, 'storyboard', `${slug}.json`);
if (!existsSync(source)) fail(`No existe storyboard/${slug}.json.`);

const tokens = readJson(join(VIDEO_ROOT, 'design-system', 'tokens.json'));
const lucide = join(VIDEO_ROOT, 'node_modules', 'lucide-static', 'icons');
const { storyboard, report } = validateStoryboard(readJson(source), tokens, {
  slug,
  iconExists: existsSync(lucide)
    ? (name) => existsSync(join(lucide, `${name}.svg`))
    : undefined,
});
if (!existsSync(lucide))
  report.warnings.push(
    'lucide-static no está instalado: no se comprueba que los iconos existan.',
  );

for (const warning of report.warnings) console.log(`! ${warning}`);
for (const error of report.errors) console.error(`✗ ${error}`);

const outDir = stageDir(slug, 'storyboard');
const outputs: Record<string, string> = {};
if (storyboard && report.errors.length === 0) {
  const content = `${JSON.stringify(buildExcalidraw(storyboard, tokens), null, 2)}\n`;
  const target = join(VIDEO_ROOT, 'storyboard', `${slug}.excalidraw`);
  const changed = writeIfChanged(target, content);
  outputs[`storyboard/${slug}.excalidraw`] = createHash('sha256')
    .update(content)
    .digest('hex');
  console.log(
    `${changed ? '✓ Escrito' : '✓ Sin cambios'}: storyboard/${slug}.excalidraw`,
  );
}
writeIfChanged(
  join(outDir, 'report.json'),
  `${JSON.stringify({ ...report, outputs }, null, 2)}\n`,
);

if (report.errors.length > 0) process.exit(1);
console.log(
  `✓ Storyboard válido: ${report.scenes} escenas, ${report.totalSeconds} s (${report.status}).`,
);
