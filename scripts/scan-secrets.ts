/**
 * Escaneo básico de secretos (criterio 13 de la Fase 1): busca patrones de
 * claves en los archivos versionados. Uso: pnpm scan:secrets (también en CI).
 * Las claves publicables (sb_publishable_…) son públicas y no cuentan.
 * Una línea con «secret-scan: allow» se ignora (solo para ejemplos explicados).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Supabase secret key', pattern: /\bsb_secret_[A-Za-z0-9_-]{16,}/ },
  {
    name: 'JWT (p. ej. service_role)',
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  {
    name: 'Clave privada',
    pattern:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/,
  },
  { name: 'Stripe', pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { name: 'Stripe webhook', pattern: /\bwhsec_[A-Za-z0-9]{16,}/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: 'GitHub token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/,
  },
  { name: 'Anthropic', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI', pattern: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/ },
  { name: 'Resend', pattern: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/ },
  {
    name: 'URL de Postgres con contraseña',
    pattern: /\bpostgres(?:ql)?:\/\/[^:\s/]+:[^@\s]{6,}@/,
  },
];

export type SecretFinding = { name: string; line: number };

export function findSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  text.split('\n').forEach((content, index) => {
    if (content.includes('secret-scan: allow')) return;
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(content)) findings.push({ name, line: index + 1 });
    }
  });
  return findings;
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  let total = 0;
  for (const file of files) {
    let buffer: Buffer;
    try {
      if (statSync(file).size > 2 * 1024 * 1024) continue;
      buffer = readFileSync(file);
    } catch {
      continue;
    }
    if (buffer.includes(0)) continue; // binario
    for (const finding of findSecrets(buffer.toString('utf8'))) {
      total += 1;
      // Nunca se imprime el valor encontrado, solo dónde.
      console.error(`${file}:${finding.line} — posible ${finding.name}`);
    }
  }
  if (total > 0) {
    console.error(`\n${total} posibles secretos. Retíralos del repositorio.`);
    process.exit(1);
  }
  console.log(`Sin secretos en ${files.length} archivos versionados.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
