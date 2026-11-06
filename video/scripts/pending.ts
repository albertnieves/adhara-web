// Marcador de las etapas que aún no existen: falla con un mensaje claro en lugar
// de simular un resultado.
const stage = process.argv[2] ?? '(sin nombre)';
console.error(
  `✗ La etapa «${stage}» todavía no está implementada. ` +
    'Qué falta y qué pasos son manuales: video/docs/setup-status.md.',
);
process.exit(1);
