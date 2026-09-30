# L’Atelier du Désert · adhara-web

Ecommerce de perfumería árabe **L’Atelier du Désert** («Haute Parfumerie Orientale»). El repositorio y los proyectos de Supabase y Vercel conservan el nombre de trabajo `adhara`. **En desarrollo; Fase 1 todavía incompleta.** Tienda visual en es/ca/en con escena 3D de unboxing y panel de administración con catálogo, precios, inventario y equipo sobre Supabase (`adhara-dev`). El catálogo real está cargado como borradores con foto, pendiente de formatos, costes y PVP; sin checkout todavía (docs/STATUS.md).

## Arranque

Requisitos: Node 24 (versión exacta en .nvmrc) y pnpm 11.19.0.

```sh
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev
```

Abrir http://localhost:3000. Sin variables de Supabase la tienda muestra la colección vacía y el panel queda cerrado. Para conectar `adhara-dev`, copiar `.env.example` a `.env.local` y rellenar las dos variables públicas de Supabase (no subir `.env.local` a Git).

## Comprobaciones

```sh
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm format:check
```

`check` ejecuta lint, tipado, tests unitarios y build. E2E arranca el build de producción en el puerto 3000, que debe estar libre. Comprueba rutas, idioma y el acceso al panel en móvil y escritorio. Las pruebas de base de datos (pgTAP) están en `supabase/tests` (ver supabase/README.md).

## Qué hay

- Next.js, React, TypeScript, Tailwind, next-intl, motion y three.js (React Three Fiber).
- Tienda en español, catalán e inglés: home animada, colección con filtros y fichas con escena 3D de unboxing (perfumes del piloto) o galería.
- Panel `/admin` con verificación en dos pasos: catálogo, PVP con regla Ómnibus, imágenes, textos, inventario de la tienda, movimientos y equipo. Plan por fases en [docs/ADMIN_PLAN.md](docs/ADMIN_PLAN.md).
- Supabase con RLS en todas las tablas públicas, costes fuera de la API y registros de solo inserción; migraciones y pruebas pgTAP en `supabase/`.
- Endpoint /api/health y exclusión de indexación mientras se desarrolla.
- Vitest, Playwright y workflow de GitHub Actions.
- Instrucciones para Codex en AGENTS.md y documentos originales preservados.

## Continuar con Codex

Abrir esta carpeta como proyecto y pedir: «Lee AGENTS.md y docs/STATUS.md y continúa con el siguiente bloque de fundaciones». Consultar [desarrollo](docs/DEVELOPMENT.md), [panel de administración](docs/ADMIN_PLAN.md), [habilidades](docs/SKILLS.md), [decisiones](docs/DECISIONS.md) y [estado](docs/STATUS.md).
