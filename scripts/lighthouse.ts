/**
 * Lighthouse de la tienda pública con presupuestos de peso y carga
 * (DECISIONS §190). Mide cada página en móvil (4G lento y CPU 4 veces más
 * lenta, los de Lighthouse) y en escritorio, como un visitante que ya
 * contestó el aviso de cookies; guarda los informes HTML en
 * audit-output/lighthouse y escribe un resumen en Markdown. Sale con error si
 * alguna página pasa de su presupuesto.
 *
 * La red y la CPU se frenan de verdad («devtools»), no se simulan: contra un
 * servidor local la simulación da el LCP como si cada página esperase a todo
 * su JavaScript, y no ve si un texto aparece antes o después de React.
 *
 * Necesita la web en marcha con datos: en la CI, pnpm start contra el
 * Supabase local con tests/fixtures/test-db.sql y lighthouse.sql.
 * Uso: node scripts/lighthouse.ts [URL base]
 */
import { chromium } from '@playwright/test';
import lighthouse, { desktopConfig } from 'lighthouse';
import type { Config, Flags, Result } from 'lighthouse';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const out = join(process.env.AUDIT_OUTPUT_DIR ?? 'audit-output', 'lighthouse');
const port = 9333;

type Page = {
  name: string;
  path: string;
  /** Solo se comprueban los pesos y el CLS (los tiempos se anotan). */
  weightOnly?: Partial<Pick<Budget, 'scriptKB' | 'totalKB'>>;
  /** Solo en estos dispositivos (por defecto, los dos). */
  factors?: Factor[];
};

/** Una página de cada plantilla de la tienda. */
const PAGES: Page[] = [
  // Con un perfume con escena (lighthouse.sql) la portada es el carrusel 3D.
  // El navegador de la CI no tiene tarjeta gráfica: se ven las fotos y
  // three.js no se descarga (§191).
  { name: 'Portada', path: '/es' },
  // La misma portada como la ve un visitante con tarjeta gráfica (`?3d`):
  // three.js y las texturas llegan después de cargar. Los tiempos no valen
  // aquí (la escena se pinta sin GPU, a saltos), así que solo cuentan los
  // pesos y el CLS: que el lienzo no mueva nada al aparecer.
  {
    name: 'Portada con 3D',
    path: '/es?3d',
    weightOnly: { scriptKB: 650, totalKB: 1800 },
    factors: ['móvil'],
  },
  { name: 'Colección', path: '/es/catalogo' },
  // Perfume con escena 3D (tests/fixtures/lighthouse.sql): three.js no se
  // descarga hasta pulsar «Abrir la caja en 3D».
  { name: 'Ficha con 3D', path: '/es/perfume/perfume-escena-3d' },
  // Sin consulta: con ?q= los resultados se pintan en el navegador (§181).
  { name: 'Búsqueda', path: '/es/buscar' },
  { name: 'Recorrido olfativo', path: '/es/recorrido-olfativo' },
];

type Factor = 'móvil' | 'escritorio';
type Budget = {
  scriptKB: number;
  totalKB: number;
  cls: number;
  lcpMs: number;
  tbtMs: number;
  accessibility: number;
};

/**
 * Presupuestos. Los pesos (transferidos, comprimidos) y el CLS no dependen
 * del ordenador que mide; los tiempos sí, así que llevan margen sobre lo
 * medido el 03/11 (móvil: LCP 2,1–2,7 s y TBT 0,4–0,8 s; escritorio: LCP
 * hasta 1,6 s). JavaScript: unos 290 KB por página; three.js suma 280 KB, así
 * que si llegara a la carga inicial no cabría.
 */
const BUDGETS: Record<Factor, Budget> = {
  móvil: {
    scriptKB: 330,
    totalKB: 900,
    cls: 0.1,
    lcpMs: 4000,
    tbtMs: 1200,
    accessibility: 0.95,
  },
  escritorio: {
    scriptKB: 330,
    totalKB: 900,
    cls: 0.1,
    lcpMs: 2500,
    tbtMs: 300,
    accessibility: 0.95,
  },
};

const FACTORS: { name: Factor; config?: Config }[] = [
  { name: 'móvil' },
  { name: 'escritorio', config: desktopConfig },
];

type Measure = {
  lhr: Result;
  report: string;
  lcp: number;
  tbt: number;
  cls: number;
  script: number;
  total: number;
};

function numeric(lhr: Result, id: string) {
  return lhr.audits[id]?.numericValue ?? Number.NaN;
}

/** KB transferidos de un tipo de recurso (auditoría resource-summary). */
function transferKB(lhr: Result, type: string) {
  const details = lhr.audits['resource-summary']?.details;
  if (details?.type !== 'table') return Number.NaN;
  const row = details.items.find((item) => item.resourceType === type);
  return typeof row?.transferSize === 'number' ? row.transferSize / 1024 : 0;
}

/** Lo que pasa del presupuesto: [pesos, CLS y accesibilidad] y [tiempos]. */
function overBudget(m: Measure, budget: Budget) {
  const accessibility = m.lhr.categories.accessibility?.score ?? 0;
  const fixed = [
    m.script > budget.scriptKB &&
      `JavaScript ${Math.round(m.script)} KB > ${budget.scriptKB} KB`,
    m.total > budget.totalKB &&
      `total ${Math.round(m.total)} KB > ${budget.totalKB} KB`,
    !(m.cls <= budget.cls) && `CLS ${m.cls.toFixed(3)} > ${budget.cls}`,
    accessibility < budget.accessibility &&
      `accesibilidad ${Math.round(accessibility * 100)} < ${budget.accessibility * 100}`,
  ];
  const timing = [
    !(m.lcp <= budget.lcpMs) &&
      `LCP ${(m.lcp / 1000).toFixed(2)} s > ${budget.lcpMs / 1000} s`,
    !(m.tbt <= budget.tbtMs) &&
      `TBT ${Math.round(m.tbt)} ms > ${budget.tbtMs} ms`,
  ];
  const keep = (items: (string | false)[]) =>
    items.filter((item): item is string => Boolean(item));
  return { fixed: keep(fixed), timing: keep(timing) };
}

function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\W+/g, '-')
    .toLowerCase();
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chromium',
  args: [`--remote-debugging-port=${port}`],
});

const rows: string[] = [];
const failures: string[] = [];
try {
  // El aviso de cookies, contestado como lo haría un visitante («Rechazar» si
  // hay etiquetas de terceros configuradas; si no, «Aceptar y continuar»): se
  // mide la página, no el aviso, y no se carga nada de terceros.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/es`);
  await page
    .getByRole('button', { name: /^(Rechazar|Aceptar y continuar)$/ })
    .first()
    .click();
  await page.waitForFunction(() => document.cookie.includes('='));
  const cookie = (await context.cookies())
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  await context.close();

  const flags: Flags = {
    port,
    output: 'html',
    logLevel: 'error',
    throttlingMethod: 'devtools',
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
    extraHeaders: { Cookie: cookie },
  };

  const measure = async (path: string, config?: Config): Promise<Measure> => {
    const result = await lighthouse(base + path, flags, config);
    if (!result) throw new Error(`Lighthouse no devolvió nada: ${path}`);
    const { lhr } = result;
    if (lhr.runtimeError)
      throw new Error(`${path}: ${lhr.runtimeError.message}`);
    return {
      lhr,
      report: String(result.report),
      lcp: numeric(lhr, 'largest-contentful-paint'),
      tbt: numeric(lhr, 'total-blocking-time'),
      cls: numeric(lhr, 'cumulative-layout-shift'),
      script: transferKB(lhr, 'script'),
      total: transferKB(lhr, 'total'),
    };
  };

  for (const { name, path, weightOnly, factors } of PAGES)
    for (const factor of FACTORS) {
      if (factors && !factors.includes(factor.name)) continue;
      const budget = { ...BUDGETS[factor.name], ...weightOnly };
      let m = await measure(path, factor.config);
      let over = overBudget(m, budget);
      if (weightOnly) over.timing = [];
      // Los tiempos varían de una vez a otra: si solo fallan ellos, se repite
      // una vez y vale la mejor.
      if (over.fixed.length === 0 && over.timing.length > 0) {
        const again = await measure(path, factor.config);
        const second = overBudget(again, budget);
        if (second.timing.length < over.timing.length || again.lcp < m.lcp) {
          m = again;
          over = second;
        }
      }
      const problems = [...over.fixed, ...over.timing];
      for (const item of problems)
        failures.push(`${name} (${factor.name}): ${item}`);
      writeFileSync(
        join(out, `${slugify(`${name}-${factor.name}`)}.html`),
        m.report,
      );

      const pct = (id: string) =>
        Math.round((m.lhr.categories[id]?.score ?? 0) * 100);
      rows.push(
        `| ${name} | ${factor.name} | ${pct('performance')} | ${pct('accessibility')} | ${pct('best-practices')} | ${(m.lcp / 1000).toFixed(2)} s | ${Math.round(m.tbt)} ms | ${m.cls.toFixed(3)} | ${Math.round(m.script)} KB | ${Math.round(m.total)} KB | ${problems.length ? 'fuera' : 'dentro'} |`,
      );
      console.error(`${path} (${factor.name}) medido`);
    }
} finally {
  await browser.close();
}

console.log('## Lighthouse de la tienda (DECISIONS §190)\n');
console.log(
  'Supabase local con los datos de prueba. Móvil con 4G lento y CPU 4 veces más lenta, aplicados de verdad; pesos transferidos (comprimidos) al cargar la página, sin pulsar nada. Informes completos en el artefacto `auditoria-visual`, carpeta `lighthouse`. SEO no se mide: la web local no se indexa.\n',
);
console.log(
  '| Página | Dispositivo | Rendimiento | Accesibilidad | Buenas prácticas | LCP | TBT | CLS | JavaScript | Total | Presupuesto |',
);
console.log(
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
);
for (const row of rows) console.log(row);
if (failures.length > 0) {
  console.log('\n**Fuera de presupuesto:**\n');
  for (const item of failures) console.log(`- ${item}`);
  process.exitCode = 1;
}
