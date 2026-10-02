/**
 * Resume en Markdown la línea base de axe que guardan las auditorías
 * (tests/support/layout-audit.ts): reglas incumplidas, gravedad, pantallas y
 * elementos afectados. Uso: node scripts/axe-report.ts [carpeta]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type Summary = {
  name: string;
  path: string;
  violations: { id: string; impact: string; nodes: number; help: string }[];
};

const dir = join(
  process.argv[2] ?? process.env.AUDIT_OUTPUT_DIR ?? 'audit-output',
  'axe',
);
const files = existsSync(dir)
  ? readdirSync(dir).filter((file) => file.endsWith('.json'))
  : [];
const pages = files.map(
  (file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as Summary,
);

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor', 'unknown'];
const rules = new Map<
  string,
  { impact: string; help: string; pages: Set<string>; nodes: number }
>();
for (const page of pages)
  for (const v of page.violations) {
    const rule = rules.get(v.id) ?? {
      impact: v.impact,
      help: v.help,
      pages: new Set<string>(),
      nodes: 0,
    };
    rule.pages.add(page.path);
    rule.nodes += v.nodes;
    rules.set(v.id, rule);
  }

const rows = [...rules.entries()].sort(
  ([, a], [, b]) =>
    IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact) ||
    b.nodes - a.nodes,
);
const clean = pages.filter((page) => page.violations.length === 0).length;

console.log('## Accesibilidad: línea base de axe (WCAG 2.2 AA)\n');
console.log(
  `${pages.length} pantallas analizadas; ${clean} sin infracciones; ${rules.size} reglas incumplidas.\n`,
);
if (rows.length > 0) {
  console.log('| Regla | Gravedad | Pantallas | Elementos | Qué pide |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const [id, rule] of rows)
    console.log(
      `| \`${id}\` | ${rule.impact} | ${rule.pages.size} | ${rule.nodes} | ${rule.help.replace(/\|/g, '\\|')} |`,
    );
}
