# ADHARA · adhara-web

Base de desarrollo para el ecommerce de perfumería árabe ADHARA. **Preparación inicial; Fase 1 todavía incompleta.** No contiene productos, checkout, autenticación ni base de datos conectada.

## Arranque

Requisitos: Node 24 (versión exacta en .nvmrc) y pnpm 11.19.0.

```sh
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev
```

Abrir http://localhost:3000. El arranque técnico no necesita claves ni cuentas externas. Las variables futuras están en .env.example; cuando hagan falta, copiarlas a .env.local sin subirlo a Git.

## Comprobaciones

```sh
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm format:check
```

`check` ejecuta lint, tipado, tests unitarios y build. E2E arranca el build de producción en el puerto 3000, que debe estar libre. Comprueba rutas e idioma en móvil y escritorio. No verifica auth ni RLS: aún no existen.

## Qué hay

- Next.js, React, TypeScript, Tailwind y next-intl.
- Home y catálogo técnicos en español, catalán e inglés.
- Endpoint /api/health y exclusión de indexación mientras se desarrolla.
- Vitest, Playwright y workflow de GitHub Actions preparado.
- Reglas de negocio del panel de administración (permisos, precios, inventario, vigilante de stock, pedidos y mensajes) probadas con Vitest, todavía sin pantallas ni base de datos. Plan por fases en [docs/ADMIN_PLAN.md](docs/ADMIN_PLAN.md).
- Instrucciones para Codex en AGENTS.md y documentos originales preservados.

## Continuar con Codex

Abrir esta carpeta como proyecto y pedir: «Lee AGENTS.md y docs/STATUS.md y continúa con el siguiente bloque de fundaciones». Consultar [desarrollo](docs/DEVELOPMENT.md), [panel de administración](docs/ADMIN_PLAN.md), [habilidades](docs/SKILLS.md), [decisiones](docs/DECISIONS.md) y [estado](docs/STATUS.md).
