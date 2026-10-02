# Informe de la Fase 1 — Fundaciones

Cierre del 02/10/2026, a petición del usuario. Plan: `docs/source/FASE_1_PLAN.md`. La Fase 1 se desarrolló entre el 28/09 y el 02/10 en las PR #5 a #12. Por decisión del usuario, en paralelo se adelantaron una tienda visual, el panel de administración y las fases R y S. Estado y excepciones en [DECISIONS.md](../DECISIONS.md) §83–90.

## Resultado por criterio (plan §16)

Evidencia en CI: PR #12, commit `a15fdda` (los tres workflows se repiten en el commit final de la PR):

- [CI · quality](https://github.com/albertnieves/adhara-web/actions/runs/36970755078);
- [Database](https://github.com/albertnieves/adhara-web/actions/runs/36970755158);
- [E2E](https://github.com/albertnieves/adhara-web/actions/runs/36970755121).

| #   | Criterio                                                                       | Estado                  | Evidencia                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | lint, typecheck, unitarias y build sin errores, sin avisos de TS ni `any`      | Cumplido                | `ci.yml` en verde; en local, `pnpm check`: 212 unitarias en 28 archivos y build sin avisos de TypeScript. `@typescript-eslint/no-explicit-any` es error y la búsqueda de `any`, `@ts-ignore` y `@ts-expect-error` fuera de `database.types.ts` no encuentra nada |
| 2   | Tres workflows en verde en la PR de la fase                                    | Cumplido                | `ci.yml`, `db.yml` y `e2e.yml` en verde en la PR #12                                                                                                                                                                                                             |
| 3   | Preview de Vercel desplegada y accesible                                       | Cumplido                | Preview de `a15fdda` en estado READY (protegida con Vercel Authentication, accesible para el titular)                                                                                                                                                            |
| 4   | `/` → `/es` (307), `Accept-Language: ca` → `/ca`, cookie `en` → `/en`          | Cumplido                | `tests/e2e/setup.spec.ts`                                                                                                                                                                                                                                        |
| 5   | `/es/catalogo`, `/ca/cataleg` y `/en/catalog` con su `<html lang>`             | Cumplido                | `tests/e2e/setup.spec.ts`, en 390×844 y 1440×900                                                                                                                                                                                                                 |
| 6   | `ca.json` y `en.json` con todas las claves de `es.json`                        | Cumplido                | `tests/unit/i18n.test.ts`                                                                                                                                                                                                                                        |
| 7   | `buildAlternates` con sus 4 casos                                              | Cumplido                | `tests/unit/seo-alternates.test.ts` (6 casos)                                                                                                                                                                                                                    |
| 8   | `db reset` aplica migraciones y seed en local y en `adhara-dev`                | Cumplido con excepción  | `db.yml`: `supabase db reset` desde vacío con las 17 migraciones. En `adhara-dev`, paridad 17/17 sin reset porque tiene datos reales (§85)                                                                                                                       |
| 9   | pgTAP en verde, con los siete casos mínimos                                    | Cumplido                | 263/263 en 8 archivos (`db.yml`); detalle abajo                                                                                                                                                                                                                  |
| 10  | `internal` no expuesto en `adhara-dev`                                         | Cumplido                | REST con la clave publicable, 02/10: `internal.variant_cost_records`, `internal.price_change_log`, `internal.suppliers` y `private.store_revisions` responden 406 `PGRST106`; `rpc/admin_variant_costs` responde 42501                                           |
| 11  | `cost-leak.spec.ts` en verde con el centinela                                  | Cumplido                | `e2e.yml`: 134/134 pruebas públicas, incluidas 26 del centinela (987654): comprobación de que el perfume centinela está publicado y HTML, RSC, JSON y cabeceras de 12 rutas, en 2 tamaños                                                                        |
| 12  | Tipos generados iguales al esquema                                             | Cumplido                | `db.yml`, `scripts/check-db-types.ts`                                                                                                                                                                                                                            |
| 13  | Sin secretos y con escaneo en CI                                               | Cumplido                | `ci.yml`, `pnpm scan:secrets` (sin secretos en los archivos versionados)                                                                                                                                                                                         |
| 14  | Acceso al panel: sin sesión, sin ficha, sin MFA y con `aal2`                   | Cumplido                | `admin-auth.spec.ts` (sin sesión → acceso) y recorridos autenticados de `e2e.yml`: sesión sin ficha → 404 (nuevo), alta de MFA obligatoria y panel con `aal2` (9/9)                                                                                              |
| 15  | Primer owner real con MFA                                                      | Cumplido con diferencia | `system_admin` con TOTP verificado desde el 01/10 (lectura del 02/10); creado por preasignación, no con `bootstrap-owner` (§87)                                                                                                                                  |
| 16  | Cabeceras de seguridad; `/admin` con `noindex` y `no-store`                    | Cumplido                | `setup.spec.ts` y `admin-auth.spec.ts`                                                                                                                                                                                                                           |
| 17  | Documentos de §15; ADR-010 sustituye a ADR-008                                 | Cumplido                | Esta PR: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `I18N.md`, `PRICING.md`, `PRODUCT_RESEARCH.md`, `ROADMAP.md` y este informe; registro de ADR en DECISIONS                                                                            |
| 18  | Sin datos de producto en dev ni prod                                           | Superado por el usuario | El usuario pidió cargar el piloto, el catálogo y la compra (§88): 30 marcas y 458 perfumes en `adhara-dev`, con procedencia                                                                                                                                      |
| 19  | Informe con archivos, versiones, decisiones, problemas, deuda y siguiente fase | Cumplido                | Este documento                                                                                                                                                                                                                                                   |

### Criterio 9, caso por caso

| Caso                                          | Prueba                                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon` no ve borradores                       | `02` (perfumes, marcas, formatos) y `07` (textos de borradores; usuario sin ficha de personal)                                                                      |
| `anon` no lee `internal` ni ejecuta `admin_*` | `03` (esquema y tablas de costes) y `07` (ninguna de las 42 funciones `admin_*` es ejecutable por `anon`; sin privilegios en `internal` ni `private`)               |
| Sin permiso no se obtiene el coste            | `03`: el encargado y un usuario sin ficha reciben `forbidden` (equivale al `content_editor` del plan, que no existe en los roles aprobados, §14)                    |
| `aal1` no obtiene el coste                    | `03`                                                                                                                                                                |
| Solo inserción                                | `01` (borrar auditoría), `02` y `03` (modificar movimientos y costes), `07` (modificar auditoría e historial de PVP; borrar historiales y movimientos), `04` y `06` |
| No se publica sin la regla de publicación     | `02` y `07` (formato activo con PVP y `catalog.publish`, §86)                                                                                                       |
| El PVP no cambia sin permiso                  | `02` (sin MFA) y `07` (encargado con MFA, usuario sin ficha, `anon` y administrador sin MFA)                                                                        |

## Pruebas del plan §14 y dónde están

| Plan                                                      | Implementado                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.test.ts`                                             | `tests/unit/admin-access.test.ts` (sin variables el panel queda cerrado; URL y clave publicable válidas) y `secret-scan.test.ts`. Sin `src/lib/env.ts` que haga fallar el build: sin variables, la tienda funciona vacía y el panel cerrado (§8, §24) |
| `money.test.ts`, `seo-alternates.test.ts`                 | Con el mismo nombre                                                                                                                                                                                                                                   |
| `margin.test.ts`                                          | `tests/unit/pricing.test.ts` (caso de referencia de 29,95 €)                                                                                                                                                                                          |
| `i18n-routing.test.ts`                                    | `tests/unit/i18n.test.ts`                                                                                                                                                                                                                             |
| `can-publish.test.ts`                                     | La regla está en SQL: pgTAP `02` y `07`                                                                                                                                                                                                               |
| pgTAP `01_rls_catalog` … `06_constraints`                 | `01`–`07` (tabla anterior). La restricción `UNIQUE (locale, slug)` no aplica: el slug es único por perfume y común a los tres idiomas                                                                                                                 |
| `i18n.spec.ts`, `admin-auth.spec.ts`, `cost-leak.spec.ts` | `setup.spec.ts`, `admin-auth.spec.ts` más `tests/integration/admin.spec.ts`, y `cost-leak.spec.ts`                                                                                                                                                    |

## Archivos

452 archivos versionados al cierre. Los de la Fase 1 en sentido estricto, más lo que el usuario adelantó:

| Área          | Archivos                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuración | `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `playwright.local.config.ts`, `vercel.json`, `.env.example` |
| CI            | `.github/workflows/ci.yml`, `db.yml` y `e2e.yml`                                                                                                                                                            |
| Aplicación    | `src/proxy.ts`, `src/app/` (51 archivos: tienda en `[locale]`, panel en `admin`, `api` y `auth`), `src/modules/` (179 archivos en 15 módulos), `src/lib/` (10) y `messages/{es,ca,en}.json`                 |
| Base de datos | `supabase/config.toml`, 17 migraciones, 8 archivos pgTAP, prueba de concurrencia, plantillas de email de Auth y 4 cargas de datos en `supabase/data/`                                                       |
| Pruebas       | `tests/unit/` (28), `tests/e2e/` (7), `tests/integration/admin.spec.ts` y `tests/fixtures/test-db.sql`                                                                                                      |
| Scripts       | `scripts/scan-secrets.ts`, `check-db-types.ts`, `check-db-lint.ts`, `test-concurrency.ts`, `local-env.ts` y `bootstrap-owner.ts`                                                                            |
| Documentación | `README.md`, `AGENTS.md`, `CLAUDE.md` y `docs/` (estado, roadmap, decisiones, arquitectura, base de datos, seguridad, idiomas, precios, research, panel y este informe)                                     |

En esta PR de cierre: los tres workflows (`ci.yml` reescrito, `db.yml` y `e2e.yml` nuevos), `scripts/check-db-lint.ts`, `supabase/tests/database/07_phase1_guarantees.test.sql`, `tests/fixtures/test-db.sql`, la prueba del centinela en `cost-leak.spec.ts`, el recorrido «sesión sin ficha → 404», el escritorio de Playwright a 1440×900 y los documentos de §15.

## Versiones instaladas

Exactas en `package.json` y `pnpm-lock.yaml`: Node 24.16.0, pnpm 11.19.0, Next.js 16.3.6, React 19.3.0, TypeScript 6.0.3, Tailwind CSS 4.3.3, next-intl 4.14.7, `@supabase/supabase-js` 2.117.2, `@supabase/ssr` 0.12.7, Supabase CLI 2.118.0 (Postgres 17), zod 4.6.5, `server-only` 0.0.1, three 0.186.1, `@react-three/fiber` 9.8.1, `@react-three/drei` 10.7.9, motion 13.4.4, `@anthropic-ai/sdk` 0.130.0, ESLint 9.39.5 con `eslint-config-next` 16.3.6, Prettier 3.9.9, Vitest 5.0.2 y Playwright 1.63.0.

## Decisiones tomadas durante la implementación

Las principales, con su número en DECISIONS:

- webpack en lugar de Turbopack y servidores en `localhost` (§11–12);
- roles `system_admin`, `store_admin` y `viewer` (§14);
- MFA para todo el personal y decisión de acceso en servidor con `getUser()` (§22);
- esquema de catálogo simplificado y procedencia en `source_ref` (§30);
- reglas de publicación y de PVP en triggers (§31);
- stock solo mediante funciones (§33);
- tienda estática con cliente anónimo e ISR (§36);
- roles preasignados por email (§44);
- costes internos de solo inserción (§45);
- escaneo de secretos propio (§50);
- lecturas paginadas por encima de 1000 filas (§51);
- precios del PDF como coste interno (§54);
- en el cierre: CI en tres workflows, paridad de migraciones, esquema diferido, método del owner, criterio 18 superado y registro de ADR (§83–90).

## Problemas encontrados

- Turbopack no abría el puerto de su proceso CSS en el entorno: se compila con webpack (§11).
- Bucles de redirección con `127.0.0.1` y con una ruta comodín de 404 en las rutas traducidas (§12, §37).
- React 19 reiniciaba los formularios al terminar una acción y borraba lo escrito (§38).
- PostgREST devuelve como mucho 1000 filas por petición (§51).
- Con `loading.tsx`, una página sin permiso muestra «no encontrado» con estado 200 (§65).
- Sin Docker en el entorno de Codex: pgTAP se validó contra `adhara-dev` en transacciones revertidas hasta que hubo Docker (§21, §64).
- Versiones recientes de motion y del SDK de Anthropic no cumplían la antigüedad mínima de pnpm: se fijaron versiones anteriores sin excepciones (§27, §79).
- Solapes en el panel por un lateral con `flex-wrap` (§74).
- En el cierre: plpgsql_check da como error tres tablas temporales que crea la propia función (se aceptan como falsos positivos). Además, el contenedor de trabajo se reinició y hubo que volver a levantar Docker; no afectó al repositorio.

## Deuda técnica

- Esquema del plan diferido (§86): taxonomía, research y claims, `media_assets`, `tax_rates`, `locales`, colecciones y buckets.
- Sin `src/lib/env.ts` con validación global en build: hoy cada cliente valida su configuración y el panel queda cerrado si falta.
- Sin workflow de despliegue de migraciones ni `adhara-prod` (§84).
- Avisos de plpgsql_check: `admin_get_content` marcada `STABLE` llama a una función volátil; una conversión en `parse_quantity_items`. Las tablas temporales podrían sustituirse por CTE para que el lint no necesite excepciones.
- `loading.tsx` hace que las páginas sin permiso respondan 200 en lugar de 404 (§65).
- ESLint 9 por compatibilidad de los plugins de Next (§7).
- Las acciones `checkout@v4`, `setup-node@v4` y `pnpm/action-setup@v4` usan Node 20, en retirada en GitHub Actions. Supabase CLI 2.119.0 disponible. CI sin caché de build de Next.
- Revisiones de PVP y claves de inventario sin política de purga ([DELIVERY_REPORT.md](../DELIVERY_REPORT.md)).
- Imágenes provisionales y escenas 3D solo para los 4 perfumes del piloto.
- Protección de contraseñas filtradas desactivada en Supabase Auth.

## Pendiente del usuario

1. Proteger `main` en GitHub: PR obligatoria y `CI`, `Database` y `E2E` en verde.
2. Configurar la verificación en dos pasos del administrador de la tienda (primer acceso).
3. Configurar en Vercel `ANTHROPIC_API_KEY`, `CRON_SECRET` y `SUPABASE_SECRET_KEY` (solo servidor).
4. Decidir cuándo crear `adhara-prod` y separar Production (antes de abrir la web al público).

## Siguiente fase recomendada

**Fase 2 — Design System**, en paralelo con la **preparación de la Fase 3 — Importación**:

- Fase 2: formalizar tokens (color, tipografía, espaciado y movimiento, claro y oscuro) y primitivas compartidas a partir del sistema visual provisional y de las piezas del panel (`Sheet`, avisos y botones), con una página interna de referencia.
- Preparación de la Fase 3: importar el CSV del catálogo con costes desde el panel y revisar marcas, perfumes sin marca y fotos.

La prioridad de negocio acordada el 01/10 sigue en pie: el checkout con TPV (A5/F10) en cuanto lleguen los datos del TPV, y los mensajes cuando haya proveedor de correo.
