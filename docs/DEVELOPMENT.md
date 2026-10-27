# Desarrollo con Codex y Claude

El estado vigente está en [STATUS.md](STATUS.md). La operación y los entornos se describen en [OPERATIONS.md](OPERATIONS.md); el banco y los datos de negocio en [PLAN_APERTURA.md](PLAN_APERTURA.md). Las fases históricas y decisiones siguen en sus informes, no son instrucciones para repetir infraestructura ya creada.

## Objetivo activo

Entornos y operación sobre la PR #47. Una tarea por rama `codex/<tema>`, con criterios de aceptación, pruebas y PR. La rama actual parte de `claude/cierre-apertura`: fusionar #47 antes de pasar esta entrega a `main`. No fusionar ni desplegar por defecto.

## Entorno reproducible

- Node de `.nvmrc` y pnpm de `package.json`; versiones exactas y lockfile.
- `pnpm install --frozen-lockfile`; `pnpm dev` para arrancar desconectado.
- Con Docker, `pnpm exec supabase start`; `pnpm build:local` y `pnpm test:e2e:local` usan las variables locales mediante `scripts/local-env.ts`.
- `atelier-dev` es la base real. No cargar fixtures, hacer reset, probar escrituras ni copiar sus claves a Preview. `.env.example` deja Supabase vacío.
- `pnpm ops:environment` comprueba el destino alojado y se ejecuta antes de cada `pnpm build`. `pnpm ops:health <origen>` comprueba proceso y lectura pública de la base.

## Verificación

`pnpm check`, `pnpm format:check` y `pnpm scan:secrets` tras cambios funcionales. Con rutas o navegación, build y `pnpm test:e2e`. Con SQL, también Supabase local, pgTAP, `node scripts/check-db-types.ts`, `node scripts/check-db-lint.ts` y concurrencia. La CI repite calidad, base y E2E; Availability vigila la web de producción tras fusionar su workflow.

No registrar como ejecutado lo que solo hará la CI. No ejecutar scripts de dependencias con credenciales reales. Mantener secretos fuera del chat, logs y artefactos.

## Fuentes y coordinación

Leer `AGENTS.md` y solo las habilidades pertinentes de `SKILLS.md`. Codex y Claude comparten el mismo estado y las mismas reglas. Actualizar primero la sección vigente de STATUS; decisiones nuevas en DECISIONS; informes fechados sin reescribir su historia. El roadmap solo indica orden y criterios, sin duplicar credenciales ni pasos operativos.
