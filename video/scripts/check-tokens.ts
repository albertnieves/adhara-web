// Etapa 2 · valida design-system/tokens.json. Con --slug guarda el informe y el
// bloque de estilo en build/<slug>/tokens/. `--style` imprime el bloque.
import { join } from 'node:path';
import {
  VIDEO_ROOT,
  readJson,
  readSlug,
  stageDir,
  writeIfChanged,
} from './lib/cli.ts';
import { buildStyleBlock, checkTokens, flattenTokens } from './lib/tokens.ts';

const tree = readJson(join(VIDEO_ROOT, 'design-system', 'tokens.json'));
const report = checkTokens(tree);
const slug = readSlug(process.argv, false);

console.log('Contraste (WCAG 2.x):');
for (const pair of report.contrast) {
  const mark = pair.ok ? '✓' : '✗';
  console.log(
    `  ${mark} ${pair.ratio.toFixed(2)}:1 (mín. ${pair.min}) · ${pair.fg} sobre ${pair.bg}`,
  );
}
for (const warning of report.warnings) console.log(`! ${warning}`);
for (const error of report.errors) console.error(`✗ ${error}`);

const styleBlock =
  report.errors.length === 0 ? buildStyleBlock(flattenTokens(tree)) : null;
if (styleBlock && process.argv.includes('--style'))
  console.log(`\nBloque de estilo:\n${styleBlock}`);

if (slug) {
  const dir = stageDir(slug, 'tokens');
  writeIfChanged(
    join(dir, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (styleBlock)
    writeIfChanged(join(dir, 'style-block.txt'), `${styleBlock}\n`);
}

if (report.errors.length > 0) process.exit(1);
console.log(`✓ Tokens válidos (${report.status}).`);
