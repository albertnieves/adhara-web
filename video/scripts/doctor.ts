// Inventario del entorno: herramientas y versiones, claves de API (solo si
// existen, nunca su valor), servidor de ComfyUI y navegador para Playwright.
// Informativo: siempre termina con código 0. `--json` imprime JSON.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { delimiter, join } from 'node:path';
import { VIDEO_ROOT } from './lib/cli.ts';

type Row = { item: string; stage: string; ok: boolean; detail: string };

const TOOLS: ReadonlyArray<{ cmd: string; args: string[]; stage: string }> = [
  { cmd: 'node', args: ['--version'], stage: 'todas' },
  { cmd: 'npm', args: ['--version'], stage: 'todas' },
  { cmd: 'make', args: ['--version'], stage: 'make clip' },
  { cmd: 'python3', args: ['--version'], stage: '6 ComfyUI' },
  { cmd: 'nvidia-smi', args: ['-L'], stage: '6–7 ComfyUI y LTX (GPU)' },
  {
    cmd: 'docker',
    args: ['info', '--format', '{{.ServerVersion}}'],
    stage: '6 ComfyUI (opcional)',
  },
  { cmd: 'svgo', args: ['--version'], stage: '8 SVG' },
  { cmd: 'audacity', args: ['--version'], stage: '12 audio' },
  { cmd: 'sox', args: ['--version'], stage: '12 audio' },
  { cmd: 'ffmpeg', args: ['-version'], stage: '12 audio · 13 revisión' },
  { cmd: 'ffprobe', args: ['-version'], stage: '13 revisión' },
];

const KEYS: ReadonlyArray<{ name: string; stage: string }> = [
  { name: 'BFL_API_KEY', stage: '5 imágenes (Flux)' },
  { name: 'HIGGSFIELD_API_KEY', stage: '5 imágenes (Higgsfield)' },
  { name: 'HIGGSFIELD_API_SECRET', stage: '5 imágenes (Higgsfield)' },
  { name: 'OPENAI_API_KEY', stage: '5 imágenes (ChatGPT)' },
  { name: 'PENPOT_ACCESS_TOKEN', stage: '2 sistema de diseño (Penpot)' },
];

// Los binarios instalados por npm en video/ cuentan como disponibles.
const PATH = [
  join(VIDEO_ROOT, 'node_modules', '.bin'),
  process.env.PATH ?? '',
].join(delimiter);

function tool(cmd: string, args: string[]): { ok: boolean; detail: string } {
  const run = spawnSync(cmd, args, {
    encoding: 'utf8',
    env: { ...process.env, PATH },
    timeout: 10_000,
  });
  if (run.error) return { ok: false, detail: 'no instalado' };
  const firstLine = `${run.stdout}${run.stderr}`.trim().split('\n')[0] ?? '';
  return run.status === 0
    ? { ok: true, detail: firstLine.slice(0, 80) }
    : { ok: false, detail: `instalado pero falla: ${firstLine.slice(0, 80)}` };
}

async function comfy(): Promise<Row> {
  const base = process.env.COMFYUI_URL ?? 'http://127.0.0.1:8188';
  try {
    const response = await fetch(new URL('/system_stats', base), {
      signal: AbortSignal.timeout(3000),
    });
    return {
      item: `ComfyUI (${base})`,
      stage: '6–7',
      ok: response.ok,
      detail: `HTTP ${response.status}`,
    };
  } catch {
    return {
      item: `ComfyUI (${base})`,
      stage: '6–7',
      ok: false,
      detail: 'sin respuesta',
    };
  }
}

function playwright(): Row {
  try {
    const require = createRequire(join(VIDEO_ROOT, 'package.json'));
    const pkg = require('playwright/package.json') as { version: string };
    return {
      item: 'playwright + chromium',
      stage: '10 3D',
      ok: true,
      detail: `playwright ${pkg.version}`,
    };
  } catch {
    return {
      item: 'playwright + chromium',
      stage: '10 3D',
      ok: false,
      detail: 'no resoluble desde video/',
    };
  }
}

const rows: Row[] = [
  ...TOOLS.map(({ cmd, args, stage }) => ({
    item: cmd,
    stage,
    ...tool(cmd, args),
  })),
  ...KEYS.map(({ name, stage }) => ({
    item: name,
    stage,
    ok: Boolean(process.env[name]),
    detail: process.env[name] ? 'definida (valor no mostrado)' : 'no definida',
  })),
  await comfy(),
  playwright(),
];

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log(
    '| Elemento | Etapa | Estado | Detalle |\n| --- | --- | --- | --- |',
  );
  for (const row of rows) {
    console.log(
      `| ${row.item} | ${row.stage} | ${row.ok ? 'OK' : 'FALTA'} | ${row.detail.replaceAll('|', '/')} |`,
    );
  }
}
