# L’Atelier du Désert · adhara-web

Ecommerce de perfumería árabe **L’Atelier du Désert** («Haute Parfumerie Orientale»). El repositorio conserva el nombre de trabajo `adhara`; los proyectos se llaman `atelier-web` en Vercel y `atelier-dev` en Supabase (renombrados el 23/10/2026; antes `altier-web` y `adhara-dev`), con el dominio `latelierdudesert.com` (público desde el 10/10/2026, sin indexar todavía). **En desarrollo; Fase 1 cerrada el 02/10/2026 con excepciones escritas ([informe](docs/phases/FASE_1_REPORT.md)); Fase 2 (sistema de diseño) terminada el 04/10 a falta de la revisión visual ([informe](docs/phases/FASE_2_REPORT.md)).** Tienda visual en es/ca/en con escena 3D de unboxing y panel de administración con catálogo, precios, inventario y equipo sobre Supabase (`atelier-dev`). El entorno de desarrollo tiene 50 perfumes publicados y el resto pendiente de completar; checkout y devoluciones implementados, con la venta aún apagada y el cierre en la PR #47 (docs/STATUS.md).

## Arranque

Requisitos: Node 24 (versión exacta en .nvmrc) y pnpm 11.19.0.

```sh
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev
```

Abrir http://localhost:3000. Sin variables de Supabase la tienda muestra la colección vacía y el panel queda cerrado. Copiar `.env.example` a `.env.local` para arrancar desconectado o usar Supabase local para desarrollar. `atelier-dev` contiene datos reales: no usar sus claves en previews. Ver [entornos y operación](docs/OPERATIONS.md).

## Objetivo actual

Entorno de pruebas independiente: catálogo real publicado e imágenes públicas, con operaciones ficticias. [Contexto del proyecto](docs/PROJECT_CONTEXT.md) · [Guía del entorno de pruebas](docs/TEST_ENVIRONMENT.md) · [Estado vigente](docs/STATUS.md) · [Operación](docs/OPERATIONS.md). Las PR #47–#51 ya están fusionadas en main; los datos de servicios fechados en los documentos deben volver a comprobarse. No confundir código fusionado con un despliegue validado.

## Comprobaciones

```sh
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm format:check
```

`check` ejecuta lint, tipado, tests unitarios y build. E2E arranca el build de producción en el puerto 3000, que debe estar libre. Comprueba rutas, idioma y el acceso al panel en móvil y escritorio.

Con Docker, la base de datos y los recorridos autenticados se prueban sobre Supabase local:

```sh
pnpm exec supabase start
pnpm test:db                      # pgTAP
node scripts/check-db-types.ts    # tipos generados
node scripts/check-db-lint.ts     # plpgsql_check
pnpm build:local && pnpm test:e2e:local
```

La CI repite todo en tres workflows: `ci.yml`, `db.yml` y `e2e.yml` (ver [supabase/README.md](supabase/README.md) y [docs/DATABASE.md](docs/DATABASE.md)).

## Qué hay

- Next.js, React, TypeScript, Tailwind, next-intl, motion, three.js (React Three Fiber) y el SDK de Anthropic para el asistente.
- Tienda en español, catalán e inglés: home animada, colección con filtros y fichas con escena 3D de unboxing (perfumes del piloto) o galería.
- Panel `/admin` con verificación en dos pasos: catálogo, PVP con regla Ómnibus, imágenes, textos, inventario de la tienda, mostrador, compras, reposición, informes y equipo. Plan por fases en [docs/ADMIN_PLAN.md](docs/ADMIN_PLAN.md).
- Asistente de inventario: informe diario programado (Vercel Cron) y chat de solo lectura con Claude (`@anthropic-ai/sdk`); se activa con `ANTHROPIC_API_KEY` y `CRON_SECRET` en el servidor ([guía](docs/ADMIN_OPERATIONS.md)).
- Supabase con RLS en todas las tablas públicas, costes fuera de la API y registros de solo inserción; migraciones y pruebas pgTAP en `supabase/`.
- `/api/health` para liveness y `?check=readiness` para lectura pública de Supabase; vigilancia diaria en Actions tras fusionar. Exclusión de indexación mientras se desarrolla.
- Vitest, Playwright, pgTAP y tres workflows de GitHub Actions (calidad, base de datos y E2E con coste centinela).
- Instrucciones para Codex en AGENTS.md y para Claude Code en CLAUDE.md; documentos originales preservados en `docs/source/`.

## Continuar con Codex

Abrir esta carpeta como proyecto y pedir: «Lee AGENTS.md, docs/STATUS.md y docs/OPERATIONS.md y continúa con el objetivo activo». Consultar [desarrollo](docs/DEVELOPMENT.md), [roadmap](docs/ROADMAP.md), [arquitectura](docs/ARCHITECTURE.md), [base de datos](docs/DATABASE.md), [seguridad](docs/SECURITY.md), [idiomas](docs/I18N.md), [precios](docs/PRICING.md), [panel de administración](docs/ADMIN_PLAN.md), [habilidades](docs/SKILLS.md), [decisiones](docs/DECISIONS.md) y [estado](docs/STATUS.md).

## Operación

La tienda física dispone de catálogo, precios, inventario, compras e informes. El checkout está implementado y su activación sigue el [plan de apertura](docs/PLAN_APERTURA.md). Las instrucciones de publicación, aislamiento, monitorización y recuperación están en [OPERATIONS.md](docs/OPERATIONS.md); la [guía del panel](docs/ADMIN_OPERATIONS.md) cubre el uso diario.
