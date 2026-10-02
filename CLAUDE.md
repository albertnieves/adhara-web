# L’Atelier du Désert (adhara-web) — instrucciones para Claude Code

Ecommerce de perfumería árabe con tienda en es/ca/en y panel de administración. **Las reglas de [AGENTS.md](AGENTS.md) valen igual para Claude Code**; este archivo las resume y añade lo propio de esta herramienta. El estado real está en [docs/STATUS.md](docs/STATUS.md); los documentos de `docs/source/` son propuestas de referencia, no órdenes ni prueba de que algo exista.

## Stack (versiones exactas en package.json)

Node 24.16.0 (`.nvmrc`), pnpm 11.19.0, Next.js 16.3.6 (App Router, webpack), React 19.3.0, TypeScript 6.0.3 estricto, Tailwind 4.3.3, next-intl 4.14.7, Supabase (supabase-js 2.117.2, ssr 0.12.7, CLI 2.118.0, Postgres 17), zod 4.6.5, three 0.186.1 con React Three Fiber, motion 13.4.4, `@anthropic-ai/sdk` 0.130.0, Vitest 5.0.2 y Playwright 1.63.0. Versiones exactas y lockfile; no se instalan librerías por anticipación (pagos y email llegan en su fase).

## Arquitectura

- `src/app/` compone rutas; la lógica vive en `src/modules/<dominio>/` (`domain/` puro, `server/` con `server-only`, `ui/`), con `index.ts` para el cliente y `server.ts` para el servidor. `src/lib/` es infraestructura compartida.
- Server Components por defecto. Los componentes de cliente solo importan `index.ts`.
- Prohibido: `any` (ESLint lo trata como error), secretos o clave privilegiada fuera de módulos `server-only`, importar `server.ts` desde el cliente.
- Detalle en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [docs/DATABASE.md](docs/DATABASE.md).

## Seguridad

- Dinero en céntimos enteros y porcentajes en puntos básicos; precio y stock se calculan y validan en servidor.
- Costes, proveedores y pedidos de compra en el esquema `internal`, no expuesto. Nunca en props, HTML, RSC ni respuestas públicas; solo mediante funciones `admin_*` con permiso y MFA.
- Toda tabla de `public` tiene RLS y pruebas pgTAP de autorización. Una redirección no sustituye la autorización en servidor: `requireStaff` / `requirePermission` en cada página, acción y Route Handler del panel.
- La clave privilegiada (`SUPABASE_SECRET_KEY`) solo para invitaciones de Auth y el informe diario. Nunca se piden claves por chat ni se suben secretos; `.env.example` solo lleva valores públicos y nombres.
- Detalle en [docs/SECURITY.md](docs/SECURITY.md) y [docs/PRICING.md](docs/PRICING.md).

## Idiomas

Español por defecto, catalán e inglés, todas las URL con prefijo y rutas traducidas (next-intl, ADR-010). Los mensajes de `ca` y `en` tienen las mismas claves que `es`. El panel está solo en español. Detalle en [docs/I18N.md](docs/I18N.md).

## Datos de producto

**Nunca inventar** productos, precios, notas, reseñas ni imágenes presentadas como producto real. Si falta un dato, el perfume queda en borrador o el campo vacío. Conservar siempre la procedencia (`source_ref`, origen y fuente de la imagen). Ver [docs/PRODUCT_RESEARCH.md](docs/PRODUCT_RESEARCH.md).

## Protocolo de trabajo

1. **PLAN:** objetivo, alcance, archivos y riesgos; preguntar solo lo que de verdad decide el usuario.
2. **IMPLEMENT:** solo lo acordado, en una rama propia (`codex/<tema>` o la que asigne el entorno, DECISIONS §17) y revisable mediante PR.
3. **VERIFY:** `pnpm check` (lint, tipos, unitarias y build) tras cambios funcionales; `pnpm test:e2e` tras cambios de rutas o navegación (requiere build); con Supabase local, `pnpm test:db`, `node scripts/check-db-types.ts` y `pnpm test:e2e:local`. La CI repite todo en `ci.yml`, `db.yml` y `e2e.yml`.
4. **REPORT:** qué se hizo, comprobaciones con su resultado, decisiones (en [docs/DECISIONS.md](docs/DECISIONS.md)), límites y siguiente paso, en español. No declarar hecho lo que no se ha verificado.

No desplegar a producción por defecto ni ejecutar `supabase db reset` contra `adhara-dev` (tiene datos reales). Las migraciones remotas se aplican con el conector de Supabase y se guardan con la misma versión en `supabase/migrations/`.

## Entorno

- `pnpm dev` y `pnpm build` usan webpack y `localhost` (DECISIONS §11–12).
- Supabase local con Docker: `pnpm exec supabase start`; `scripts/local-env.ts` pasa sus variables a cualquier comando (`pnpm build:local`, `pnpm test:e2e:local`).
- `next dev` puede reescribir `AGENTS.md` y `next-env.d.ts`: no subir esos cambios.

## Documentos

[README](README.md) · [Estado](docs/STATUS.md) · [Roadmap](docs/ROADMAP.md) · [Decisiones](docs/DECISIONS.md) · [Arquitectura](docs/ARCHITECTURE.md) · [Base de datos](docs/DATABASE.md) · [Seguridad](docs/SECURITY.md) · [Idiomas](docs/I18N.md) · [Precios](docs/PRICING.md) · [Research](docs/PRODUCT_RESEARCH.md) · [Panel](docs/ADMIN_PLAN.md) · [Guía del panel](docs/ADMIN_OPERATIONS.md) · [Habilidades](docs/SKILLS.md) · [Informe de la Fase 1](docs/phases/FASE_1_REPORT.md)
