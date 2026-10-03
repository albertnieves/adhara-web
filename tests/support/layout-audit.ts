import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Red de seguridad del sistema de diseño (Fase 2, DS-01): auditoría del
 * diseño en el navegador y línea base de accesibilidad con axe.
 *
 * Bloquean: desplazamiento horizontal de la página, cajas de contenido que
 * se pisan, texto que se sale de su caja, texto de menos de 11 px (criterio
 * 3, desde DS-04) y controles de menos de 24 × 24 px (WCAG 2.5.8). Solo se
 * anotan: recortes con overflow oculto y controles de menos de 44 px, que se
 * corrigen en las tareas siguientes de la fase.
 */

export const AUDIT_WIDTHS = [390, 768, 1280, 1440] as const;

/** Etiquetas de axe que exige la fase: WCAG 2.0, 2.1 y 2.2 en niveles A y AA. */
export const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
];

export type LayoutFindings = { blocking: string[]; notes: string[] };

export function auditOutputDir() {
  return process.env.AUDIT_OUTPUT_DIR ?? 'audit-output';
}

/** Se ejecuta en la página: no puede usar nada de fuera de la función. */
export function collectLayoutIssues(): LayoutFindings {
  const MAX = 20;
  const describe = (el: Element) => {
    const text = (
      (el as HTMLElement).innerText ||
      (el as HTMLInputElement).value ||
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      ''
    )
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    const cls =
      typeof el.className === 'string'
        ? el.className.split(' ').filter(Boolean).slice(0, 3).join('.')
        : '';
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} «${text}»`;
  };
  const visible = (el: Element) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity) > 0.05
    );
  };
  // Capas superpuestas a propósito (insignias sobre fotos, avisos fijos,
  // textos solo para lectores de pantalla) y adornos ocultos.
  const layered = (el: Element) => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const position = getComputedStyle(node).position;
      if (position === 'absolute' || position === 'fixed') return true;
      if (node.getAttribute('aria-hidden') === 'true') return true;
    }
    return false;
  };
  const hasText = (el: Element) =>
    [...el.childNodes].some(
      (node) => node.nodeType === 3 && node.textContent?.trim(),
    );
  const all = [...document.querySelectorAll('body *')]
    .filter(visible)
    .filter((el) => !el.closest('details:not([open]) > :not(summary)'));

  const blocking: string[] = [];
  const notes: string[] = [];

  if (document.documentElement.scrollWidth > window.innerWidth + 1)
    blocking.push(
      `desplazamiento horizontal: ${document.documentElement.scrollWidth} > ${window.innerWidth}`,
    );

  const controls = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG'];
  const leaves = all.filter(
    (el) => (controls.includes(el.tagName) || hasText(el)) && !layered(el),
  );
  // Un elemento en línea que salta de renglón ocupa varias cajas: se
  // comparan sus cajas reales, no el rectángulo que las envuelve.
  const boxes = leaves.map((el) => {
    const inline = getComputedStyle(el).display === 'inline';
    return {
      el,
      rects: inline ? [...el.getClientRects()] : [el.getBoundingClientRect()],
    };
  });
  let overlaps = 0;
  for (let i = 0; i < boxes.length && overlaps < MAX; i++) {
    for (let j = i + 1; j < boxes.length && overlaps < MAX; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const hit = a.rects.some((ra) =>
        b.rects.some((rb) => {
          const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          return w > 3 && h > 3;
        }),
      );
      if (hit) {
        overlaps++;
        blocking.push(`solape: ${describe(a.el)} ⟂ ${describe(b.el)}`);
      }
    }
  }

  for (const el of all) {
    if (!hasText(el) || layered(el)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'inline' || el.clientWidth === 0) continue;
    if (el.scrollWidth <= el.clientWidth + 2) continue;
    if (style.overflowX === 'visible')
      blocking.push(
        `texto fuera de su caja: ${describe(el)} ${el.scrollWidth} > ${el.clientWidth}`,
      );
    else if (style.overflowX === 'hidden' && style.textOverflow !== 'ellipsis')
      notes.push(
        `recorte: ${describe(el)} ${el.scrollWidth} > ${el.clientWidth}`,
      );
  }

  // Criterio 3: ningún texto por debajo de 11 px. Las etiquetas que se
  // imprimen a tamaño físico (data-print-size) van en pt y quedan fuera.
  let small = 0;
  for (const el of all) {
    if (small >= MAX || !hasText(el) || el.closest('[data-print-size]'))
      continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 10.95) {
      small++;
      blocking.push(`texto de menos de 11 px: ${describe(el)} ${size} px`);
    }
  }

  const targets = all.filter(
    (el) =>
      el.matches(
        'button, select, textarea, [role="button"], input:not([type="hidden"])',
      ) && !layered(el),
  );
  for (const el of targets) {
    let rect = el.getBoundingClientRect();
    // Una casilla con su etiqueta se pulsa por toda la etiqueta.
    const label = (el as HTMLInputElement).labels?.[0];
    if (label && visible(label)) {
      const labelRect = label.getBoundingClientRect();
      if (labelRect.width * labelRect.height > rect.width * rect.height)
        rect = labelRect;
    }
    const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
    if (rect.width < 24 || rect.height < 24)
      blocking.push(`control de menos de 24 px: ${describe(el)} ${size}`);
    else if (rect.height < 44)
      notes.push(`control de menos de 44 px: ${describe(el)} ${size}`);
  }

  return {
    blocking: blocking.slice(0, MAX * 2),
    notes: notes.slice(0, MAX * 2),
  };
}

/** Recorre una ruta a varias anchuras y devuelve lo encontrado en cada una. */
export async function auditRoute(
  page: Page,
  path: string,
  name: string,
  widths: readonly number[] = AUDIT_WIDTHS,
  expectedStatus = 200,
) {
  // El diseño final, sin animaciones de entrada a medias.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const results: { width: number; findings: LayoutFindings }[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    // `networkidle` no sirve: a partir de cierto ancho la página mantiene
    // peticiones abiertas unos 30 s. Basta con fuentes e imágenes listas.
    const response = await page.goto(path, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page
      .waitForFunction(
        () => [...document.images].every((img) => img.complete),
        undefined,
        { timeout: 5_000 },
      )
      .catch(() => undefined);
    // Contenido en streaming ya servido: sin el esqueleto de «Cargando».
    await page
      .waitForFunction(
        () => !document.querySelector('[aria-busy="true"]:not(button)'),
        {
          timeout: 15_000,
        },
      )
      .catch(() => undefined);
    // Recorre la página para que aparezca lo que se revela al hacer scroll
    // (whileInView); si no, queda con opacidad 0 y fuera de la auditoría.
    await page.evaluate(async () => {
      const step = Math.max(200, Math.floor(window.innerHeight / 2));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      window.scrollTo(0, 0);
    });
    // Animaciones con fin (entradas, fundidos) terminadas: axe y la auditoría
    // miden el estado final, no un color a medio fundir.
    await page
      .waitForFunction(
        () =>
          document
            .getAnimations()
            .every(
              (a) =>
                a.playState !== 'running' ||
                a.effect?.getComputedTiming().iterations === Infinity,
            ),
        undefined,
        { timeout: 5_000 },
      )
      .catch(() => undefined);
    if (response?.status() !== expectedStatus)
      throw new Error(
        `${path} respondió ${response?.status()} y se esperaba ${expectedStatus}`,
      );
    // Una redirección (p. ej. al acceso sin sesión) auditaría otra pantalla.
    const landed = new URL(page.url()).pathname;
    if (landed !== new URL(path, page.url()).pathname)
      throw new Error(`${path} redirigió a ${landed}`);
    const findings = await page.evaluate(collectLayoutIssues);
    results.push({ width, findings });
    if (process.env.AUDIT_SCREENSHOTS === '1') {
      const dir = join(auditOutputDir(), 'capturas');
      mkdirSync(dir, { recursive: true });
      await page.screenshot({
        path: join(dir, `${name}-${width}.jpg`),
        type: 'jpeg',
        quality: 60,
        fullPage: true,
      });
    }
  }
  return results;
}

export type AxeSummary = {
  name: string;
  path: string;
  violations: { id: string; impact: string; nodes: number; help: string }[];
};

/**
 * Línea base de accesibilidad: guarda las infracciones de la página actual y
 * las devuelve. En DS-01 no hace fallar la prueba; los criterios de la fase
 * exigen llegar a cero antes del cierre.
 */
export async function axeBaseline(
  page: Page,
  path: string,
  name: string,
): Promise<AxeSummary> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const summary: AxeSummary = {
    name,
    path,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? 'unknown',
      nodes: v.nodes.length,
      help: v.help,
    })),
  };
  const dir = join(auditOutputDir(), 'axe');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${name}.json`),
    JSON.stringify({ ...summary, details: results.violations }, null, 2),
  );
  if (results.passes.length === 0)
    throw new Error(`axe no comprobó nada en ${path}`);
  return summary;
}

/** Texto legible para el informe de la prueba. */
export function formatFindings(
  name: string,
  results: { width: number; findings: LayoutFindings }[],
) {
  return results
    .flatMap(({ width, findings }) => [
      ...findings.blocking.map((issue) => `${name} @${width}: ${issue}`),
    ])
    .join('\n');
}
