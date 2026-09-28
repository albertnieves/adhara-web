# ADHARA — PLAN de la Fase 1: Fundaciones

Estado: **PLAN — pendiente de aprobación** (no se ha implementado nada) · 28/09/2026
Base: `docs/FASE_0_ARQUITECTURA.md` rev. 2 y ADR-001 a ADR-016.

**Objetivo:** dejar un repositorio de calidad de producción, con plataforma, base de datos, seguridad, i18n y CI funcionando y verificados. **Sin** diseño visual, **sin** páginas de negocio y **sin** datos de producto.

**Qué sí existirá al terminar:**
- rutas localizadas que responden con una página técnica mínima sin estilos (solo para verificar routing, canonical y hreflang);
- `/admin` protegido con login;
- el esquema núcleo en Supabase con RLS probada;
- CI en verde y Preview en Vercel.

---

## 0. Requisitos previos (necesito de ti antes de IMPLEMENT)

| # | Qué | Por qué |
|---|---|---|
| P1 | Repositorio de GitHub (nombre y organización o usuario) con acceso para esta sesión | Dónde vivirá el código; CI con GitHub Actions |
| P2 | Proyecto de Vercel (o permiso para crearlo con el conector) | Previews por PR |
| P3 | Dos proyectos de Supabase, `adhara-dev` y `adhara-prod` (o permiso para crearlos con el conector), y región UE | Entornos separados; datos en la UE (RGPD) |
| P4 | Email del primer usuario `owner` | Bootstrap del primer administrador |
| P5 | Confirmar el gestor de paquetes **pnpm** y Node **LTS vigente** | Reproducibilidad |

Los conectores de Supabase y Vercel están disponibles en esta sesión. **No crearé ni modificaré nada en ellos sin tu aprobación explícita del PLAN.**

---

## 1. Archivos que voy a crear

```
adhara/
├─ .github/
│  └─ workflows/
│     ├─ ci.yml                    # lint, typecheck, unit, build
│     ├─ db.yml                    # supabase local: reset + tests pgTAP + diff de tipos
│     └─ e2e.yml                   # Playwright contra build + supabase local
├─ .vscode/settings.json           # formato al guardar, TS del workspace (opcional)
├─ messages/
│  ├─ es.json                      # cadenas técnicas mínimas (idioma principal)
│  ├─ ca.json
│  └─ en.json
├─ public/
│  └─ (vacío salvo favicon provisional; el logo SVG llega en la Fase 2)
├─ scripts/
│  ├─ bootstrap-owner.ts           # crea/invita al primer owner (service role; local/CI)
│  └─ check-env.ts                 # valida .env antes de dev/build
├─ src/
│  ├─ app/
│  │  ├─ [locale]/
│  │  │  ├─ layout.tsx             # <html lang>, provider de next-intl, metadata base
│  │  │  ├─ page.tsx               # página técnica mínima (sin estilos de marca)
│  │  │  └─ not-found.tsx
│  │  ├─ admin/
│  │  │  ├─ layout.tsx             # guard: requireStaff() en servidor
│  │  │  ├─ page.tsx               # shell vacío: "Admin — Fase 1"
│  │  │  ├─ acceso/page.tsx        # login email+password
│  │  │  ├─ acceso/actions.ts      # Server Actions: signIn, signOut
│  │  │  └─ mfa/page.tsx           # alta y verificación TOTP
│  │  ├─ auth/callback/route.ts    # intercambio de código (invitación, recuperación)
│  │  ├─ api/health/route.ts       # comprobación de salud (sin datos sensibles)
│  │  ├─ robots.ts                 # no indexar mientras no haya producción
│  │  ├─ sitemap.ts                # esqueleto por locale (vacío de entidades)
│  │  ├─ layout.tsx                # raíz mínima
│  │  └─ globals.css               # Tailwind + tokens base (neutros provisionales)
│  ├─ proxy.ts | middleware.ts     # según la convención de la versión de Next instalada
│  ├─ config/
│  │  ├─ site.ts                   # nombre, URL base, locales
│  │  └─ features.ts               # flags (p. ej. enable3d=false)
│  ├─ lib/
│  │  ├─ env.ts                    # zod: esquemas server/client separados
│  │  ├─ money.ts                  # céntimos, IVA neto/bruto, margen € y %
│  │  ├─ supabase/
│  │  │  ├─ server.ts              # cliente con cookies (RSC / Actions)
│  │  │  ├─ browser.ts             # cliente de navegador (publishable key)
│  │  │  ├─ admin.ts               # service role — 'server-only', uso restringido
│  │  │  ├─ proxy.ts               # refresco de sesión en proxy/middleware
│  │  │  └─ database.types.ts      # generado (supabase gen types)
│  │  └─ errors.ts                 # tipos Result/errores de dominio
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ index.ts
│  │  │  ├─ domain/permissions.ts  # catálogo de permisos (tipado)
│  │  │  └─ server/guards.ts       # getStaff(), requireStaff(), requirePermission(), requireAal2()
│  │  ├─ i18n/
│  │  │  ├─ index.ts
│  │  │  ├─ routing.ts             # locales, defaultLocale, pathnames traducidos
│  │  │  ├─ request.ts             # config de next-intl (mensajes por locale)
│  │  │  ├─ navigation.ts          # Link/redirect localizados
│  │  │  └─ seo.ts                 # buildAlternates(): canonical + hreflang + x-default
│  │  ├─ catalog/                  # solo tipos de dominio + can_publish (función pura)
│  │  │  ├─ index.ts
│  │  │  └─ domain/{types.ts,publishing.ts}
│  │  └─ pricing/
│  │     ├─ index.ts               # solo tipos públicos (sin coste)
│  │     └─ domain/margin.ts       # cálculo de margen (puro, testeado)
│  └─ components/
│     └─ ui/.gitkeep               # el Design System llega en la Fase 2
├─ supabase/
│  ├─ config.toml                  # esquemas expuestos: public, graphql_public (NO internal)
│  ├─ migrations/                  # ver §8
│  ├─ seed.sql                     # SOLO locales + tasas de IVA + permisos (datos de referencia)
│  └─ tests/                       # pgTAP (ver §14)
│     ├─ 00_helpers.sql
│     ├─ 01_rls_catalog.test.sql
│     ├─ 02_rls_translations.test.sql
│     ├─ 03_pricing_isolation.test.sql
│     ├─ 04_staff_permissions.test.sql
│     ├─ 05_append_only.test.sql
│     └─ 06_constraints.test.sql
├─ tests/
│  ├─ unit/                        # vitest
│  │  ├─ env.test.ts
│  │  ├─ money.test.ts
│  │  ├─ margin.test.ts
│  │  ├─ i18n-routing.test.ts
│  │  ├─ seo-alternates.test.ts
│  │  └─ can-publish.test.ts
│  ├─ e2e/                         # playwright
│  │  ├─ i18n.spec.ts
│  │  ├─ admin-auth.spec.ts
│  │  └─ cost-leak.spec.ts
│  └─ fixtures/test-db.sql         # datos SOLO de test (centinelas), nunca en seed
├─ docs/
│  ├─ ARCHITECTURE.md  DATABASE.md  DECISIONS.md  ROADMAP.md
│  ├─ SECURITY.md  I18N.md  PRICING.md  PRODUCT_RESEARCH.md (borrador)
│  └─ phases/FASE_1_REPORT.md      # se escribe en REPORT
├─ .env.example
├─ .editorconfig  .gitignore  .nvmrc  .prettierrc  .prettierignore
├─ eslint.config.mjs
├─ next.config.ts
├─ postcss.config.mjs
├─ playwright.config.ts
├─ vitest.config.ts
├─ tsconfig.json
├─ package.json  pnpm-lock.yaml
├─ README.md
└─ CLAUDE.md
```

**Tests con datos de prueba:** `tests/fixtures/test-db.sql` crea un par de filas con nombres evidentes (`__TEST_PRODUCT__`, coste centinela `987654`) **solo** en la BD efímera de CI y local. No son datos de catálogo, nunca se cargan en dev ni en prod, y el seed no los incluye.

---

## 2. Dependencias

Fijaré las **últimas versiones estables en el momento de IMPLEMENT** y las documentaré en el REPORT. No doy números de versión ahora para no fijar versiones que quizá ya no sean las vigentes.

**Runtime**

| Paquete | Motivo |
|---|---|
| `next`, `react`, `react-dom` | Stack aprobado |
| `@supabase/supabase-js`, `@supabase/ssr` | Cliente y sesión en cookies para SSR |
| `next-intl` | Routing por locale con rutas traducidas y mensajes ICU (ADR-010) |
| `zod` | Validación de env, Server Actions y (más adelante) webhooks |
| `server-only` | Impide importar código de servidor en el cliente |

**Desarrollo**

| Paquete | Motivo |
|---|---|
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom` | Tipado |
| `tailwindcss`, `@tailwindcss/postcss` | Estilos (Tailwind v4, config CSS-first) |
| `eslint`, `eslint-config-next`, `typescript-eslint` | Lint (incluye reglas de Core Web Vitals) |
| `prettier`, `prettier-plugin-tailwindcss` | Formato y orden de clases consistente |
| `vitest` | Tests unitarios |
| `@playwright/test` | E2E (Chromium ya disponible en CI) |
| `supabase` (CLI) | Migraciones, BD local, `gen types`, `test db` (pgTAP) |
| `tsx` | Ejecutar scripts TS (`bootstrap-owner`, `check-env`) |

**No se instalan en la Fase 1** (llegan en su fase): `stripe`, `framer-motion`, `three`, `@react-three/fiber`, `@react-three/drei`, `@gltf-transform/cli` y el proveedor de email.

**Reglas de arquitectura con `no-restricted-imports`** (nativo de ESLint, sin plugins adicionales):
- `three` y `@react-three/*` prohibidos fuera de `modules/product-experience/viewer-3d`;
- `@/lib/supabase/admin` prohibido fuera de `app/api/**`, `scripts/**` y `modules/*/server/jobs`;
- `@/modules/*/server/*` prohibido desde otro módulo (se usa su `index.ts`);
- `@/modules/pricing/server/*` prohibido fuera de `app/admin/**`.

---

## 3. Configuración de Next.js (`next.config.ts`)

- **App Router**, TypeScript y `reactStrictMode: true`; `poweredByHeader: false`.
- Plugin de **next-intl** envolviendo la config.
- `images.remotePatterns`: solo el host de Supabase Storage del proyecto (`/storage/v1/object/public/**`), formatos `avif` y `webp`.
- **Cabeceras de seguridad** en `headers()`:
  - `Strict-Transport-Security` (solo en producción);
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `Permissions-Policy` restrictiva (cámara, micro y geolocalización desactivadas);
  - `X-Frame-Options: DENY` / `frame-ancestors 'none'`;
  - **CSP en modo `Report-Only`** en la Fase 1, que pasará a obligatoria en la Fase 16 cuando se conozcan Stripe, mapas y analítica.
- `/admin/**`: `X-Robots-Tag: noindex, nofollow` y `Cache-Control: private, no-store`.
- `typedRoutes` si la versión instalada lo ofrece estable.
- **Caché:** activaré el modelo de caché de la versión instalada (componentes cacheados / `use cache` si está estable), pero **sin cachear nada de negocio** en la Fase 1. La política de caché se fija en la Fase 5, con datos reales.
- **Proxy/middleware** (`src/proxy.ts` o `src/middleware.ts` según la convención de la versión instalada). Hace dos cosas:
  1. negociación y reescritura de locale (next-intl) para rutas públicas;
  2. refresco de sesión de Supabase y redirección a `/admin/acceso` si no hay sesión.

  El `matcher` excluye estáticos, `_next`, `api/health` e imágenes. **La autorización de verdad no está aquí**: está en el layout del admin, en cada Server Action y en RLS.

> Nota: Next.js ha cambiado convenciones entre versiones (p. ej. `middleware` → `proxy`, APIs de caché). En IMPLEMENT verificaré la documentación de la versión instalada y registraré cualquier desviación en el REPORT.

---

## 4. Configuración de TypeScript (`tsconfig.json`)

- `"strict": true`
- `"noUncheckedIndexedAccess": true`: los accesos por índice devuelven `T | undefined`.
- `"noImplicitOverride": true`, `"noFallthroughCasesInSwitch": true`
- `"verbatimModuleSyntax": true`: `import type` explícito.
- `"moduleResolution": "bundler"`, `"module": "esnext"`, `"target": "ES2022"`
- `"paths": { "@/*": ["./src/*"] }`
- `"incremental": true`, plugin `next`
- `"exactOptionalPropertyTypes"`: **no** se activa. Choca con los tipos generados de Supabase. Queda registrado como decisión.
- Reglas de ESLint complementarias: `@typescript-eslint/no-explicit-any: error` (con excepción documentada solo en archivos generados) y `consistent-type-imports`.
- Script `typecheck`: `tsc --noEmit`.

---

## 5. Configuración de Tailwind

- **Tailwind v4, configuración CSS-first**: sin `tailwind.config.js`. Tokens en `@theme` dentro de `globals.css`.
- **Fase 1 = infraestructura, no diseño:**
  - solo neutros provisionales y escala de espaciado;
  - **tokens como variables CSS semánticas** (`--color-surface`, `--color-ink`, `--color-accent`…) para que la Fase 2 cambie los valores sin tocar componentes;
  - soporte de tema oscuro por clase o atributo preparado (sin paleta todavía).
- Breakpoints mobile-first por defecto, con posible `3xl` para las pantallas editoriales grandes. Se ajustan en la Fase 2.
- `prettier-plugin-tailwindcss` para el orden de clases.
- Fuentes: **no** se cargan en la Fase 1; se eligen en la Fase 2 (`next/font`).

---

## 6. Estrategia i18n ES / CA / EN

Implementa §4.1 de la Fase 0 (ADR-010).

- **`modules/i18n/routing.ts`:**
  - `locales = ['es','ca','en']`, `defaultLocale = 'es'`;
  - `localePrefix: 'always'`: todas las URLs públicas llevan prefijo;
  - `localeDetection` solo en `/`: cookie > `Accept-Language` > `es`, con 307;
  - `pathnames` con el mapa de segmentos traducidos (`/catalogo` ↔ `/cataleg` ↔ `/catalog`, etc.) **declarado completo desde ya**, aunque las páginas lleguen en fases posteriores. Así las rutas y los tests quedan fijados.
- **Carpeta interna:** `src/app/[locale]/...` con segmentos en español; next-intl reescribe los segmentos traducidos.
- **Mensajes:** `messages/{locale}.json` con namespaces por módulo. `es` es la referencia. Un test comprueba que `ca` y `en` tienen **las mismas claves** que `es`; se permiten valores provisionales marcados, pero nunca claves que falten.
- **SEO (`modules/i18n/seo.ts`):** la función pura `buildAlternates({ entityPaths, publishedLocales, currentLocale })` devuelve:
  - `canonical`: propio si el locale actual está publicado; si no, el de `es`;
  - `robots`: `noindex` si el locale actual no está publicado;
  - `languages`: solo locales publicados + `x-default` → `es`.

  Testeada de forma unitaria y usada por todas las páginas a partir de la Fase 5.
- **`<html lang>`** correcto por locale.
- **Formato:** moneda y fechas con `Intl` vía next-intl (`es-ES`, `ca-ES`, `en-GB`; `en-GB` es una elección provisional para usar formato europeo, a confirmar).
- **BD:** tabla `locales` + tablas `*_translations` (§8).
- **Admin:** fuera de `[locale]`, interfaz solo en español en esta fase; los mensajes del admin están en `messages/es.json#admin`.

---

## 7. Estructura inicial de Supabase

- **Proyectos:** `adhara-dev` y `adhara-prod` en región UE, más BD **local** (Docker, `supabase start`) para desarrollo y CI.
- **Esquemas:**
  - `public`: expuesto por la API, con RLS obligatoria en todas las tablas;
  - `internal`: **no expuesto** (fuera de `api.schemas` en `config.toml` y en el dashboard). Contiene costes, precios del distribuidor y proveedores;
  - `private`: funciones auxiliares (`has_permission`, triggers), no expuesto.
- **Extensiones:** `pgcrypto` (uuid/tokens), `pg_trgm` y `unaccent` (búsqueda y normalización de nombres), `pgtap` (solo tests).
- **Convenciones:**
  - `snake_case`; PK `uuid default gen_random_uuid()`;
  - `created_at`/`updated_at timestamptz` con trigger;
  - enumeraciones como `text` + `CHECK` (fáciles de ampliar, sin `ALTER TYPE`);
  - dinero en `integer` (céntimos);
  - porcentajes en puntos básicos (`integer`).
- **Storage (buckets en la Fase 1, sin contenido):**
  - `catalog-source`: privado;
  - `product-media-drafts`: privado;
  - `product-media`: público de lectura, solo personal escribe;
  - `models-3d`: público de lectura, solo personal escribe;
  - `brand-media`: público de lectura;
  - `references`: privado.
- **Auth:**
  - **registro público desactivado** (los clientes llegan en la Fase 14);
  - el personal entra por invitación;
  - email + contraseña con política de longitud mínima;
  - **MFA TOTP activado**;
  - URLs de redirección limitadas al dominio de Preview/Producción.
- **Tipos:** `supabase gen types typescript --local > src/lib/supabase/database.types.ts`. CI falla si difiere de lo commiteado.

---

## 8. Primeras migraciones

Orden y contenido (una migración = un tema; todas reversibles con migración inversa documentada si hiciera falta):

| # | Migración | Contenido |
|---|---|---|
| 0001 | `extensions_and_schemas` | Extensiones, esquemas `internal` y `private`, trigger `set_updated_at()`, revocación de privilegios por defecto en `internal`/`private` a `anon` y `authenticated` |
| 0002 | `i18n_locales` | `locales` (code PK, name, is_default, enabled, position) |
| 0003 | `staff_and_permissions` | `staff_members` (user_id PK → auth.users, role, active, created_by), `role_permissions` (role, permission), `audit_log` (actor, action, entity, entity_id, before, after, at), funciones `private.has_permission(text)`, `private.is_staff()`, `private.current_aal()` |
| 0004 | `taxonomy` | `brands` (+ `_translations`), `product_lines` (+ `_translations`), `categories` (+ `_translations`), `olfactory_families` (+ `_translations`), `fragrance_notes` (+ `_translations`, aliases[]), `accords` (+ `_translations`) |
| 0005 | `products_and_variants` | `products`, `product_translations`, `product_variants` (retail_price_cents, compare_at_price_cents, tax_rate_id, sin coste), `product_notes`, `product_accords`, `product_relations`, `collections` + `collection_translations` + `collection_products`, `slug_redirects`, `tax_rates` |
| 0006 | `research_provenance` | `catalog_imports`, `catalog_raw_items` (ingest_status), `sources`, `product_sources`, `product_claims`, `product_conflicts`, `product_field_provenance` |
| 0007 | `media` | `media_assets` (origin, rights, status), `product_media` (role, position), `product_3d_assets`, `visual_briefs` |
| 0008 | `pricing_internal` | `internal.suppliers`, `internal.supplier_products`, `internal.supplier_catalog_prices`, `internal.variant_cost_records` (solo inserción), `internal.price_change_log` (solo inserción), vista `internal.variant_current_cost`; funciones `public.admin_get_variant_pricing(uuid)` y `public.admin_record_cost(...)` con `SECURITY DEFINER` + `search_path` fijo + comprobación de permiso y `aal2`; `REVOKE EXECUTE … FROM anon, public` |
| 0009 | `publishing_rules` | `can_publish(product_id)`; trigger que impide `publication_status = 'published'` si `can_publish` es falso; restricción que impide escribir `retail_price_cents` salvo desde funciones autorizadas (vía `private.pricing_write_allowed` o columna protegida con trigger + permiso) |
| 0010 | `rls_policies` | Políticas de todas las tablas (§9) |
| 0011 | `storage_buckets` | Buckets y políticas de `storage.objects` |

**Diferido a su fase** (diseñado en la Fase 0, no se migra ahora): inventario, reservas y movimientos (F9); carritos, pedidos y pagos (F10); clientes, direcciones y wishlist (F14); promociones (F11); `market_price_observations` y `price_proposals` (F4b); órdenes de compra y recepciones (F9); `content_blocks` (F13).

**`seed.sql` (solo datos de referencia, sin productos ni marcas):**
- `locales` (es por defecto, ca, en);
- `tax_rates`: IVA general 21 %; los tipos reducidos no aplican a perfumería según mi conocimiento, pero conviene confirmarlo con el asesor fiscal;
- `role_permissions` (matriz de la Fase 0 §11).

Las familias olfativas y las notas **no** se siembran: se construirán desde el research para no inventar una taxonomía.

---

## 9. RLS

**Principio: denegar por defecto.** RLS activada en todas las tablas de `public`; sin política, no hay acceso.

| Tabla(s) | anon / authenticated (no staff) | Staff (según permiso) |
|---|---|---|
| `products` | SELECT si `publication_status='published'` y `archived_at is null` | SELECT todo; INSERT/UPDATE con `catalog.edit`; publicar solo con `catalog.publish` (+ trigger `can_publish`) |
| `product_translations` y demás `*_translations` | SELECT si `status='published'` **y** la entidad padre está publicada o es pública | CRUD con `catalog.edit` / `content.edit` |
| `product_variants` | SELECT si el producto está publicado y la variante activa (el coste no existe en esta tabla) | UPDATE de `retail_price_cents`/`compare_at_price_cents` solo con `pricing.edit_retail`, y además se registra en `internal.price_change_log` |
| `brands`, `product_lines`, `categories`, `collections`, `olfactory_families`, `fragrance_notes`, `accords`, `tax_rates`, `locales` | SELECT de lo publicado o activo | CRUD con `catalog.edit` |
| `product_notes`, `product_accords`, `product_media`, `product_3d_assets` | SELECT si el producto está publicado (y el asset está `approved`) | CRUD con `catalog.edit` / `media.edit` |
| `catalog_imports`, `catalog_raw_items`, `sources`, `product_sources`, `product_claims`, `product_conflicts`, `product_field_provenance`, `visual_briefs` | **Sin acceso** | SELECT con `research.edit`/`catalog.edit`; escritura con `research.edit` |
| `media_assets` | SELECT solo si `status='approved'` y está referenciado por un producto publicado | CRUD con `media.edit` |
| `staff_members`, `role_permissions` | Sin acceso | Cada miembro lee su propia fila; `staff.manage` gestiona |
| `audit_log` | Sin acceso | INSERT vía funciones; SELECT con `staff.manage`; **UPDATE/DELETE prohibidos a todos** |
| `internal.*` | **Inalcanzable** (esquema no expuesto + sin privilegios) | Solo mediante funciones `admin_*` con `pricing.view_cost` / `pricing.edit_cost` y `aal2` |
| `storage.objects` | Lectura en buckets públicos; nada en privados | Escritura según bucket y permiso |

- **Funciones de ayuda:** `SECURITY DEFINER`, `STABLE`, `search_path = ''`, con los nombres de objeto calificados. Así se evitan ataques de `search_path` y la recursión de RLS al consultar `staff_members`.
- **Rendimiento:** en las políticas, `(select private.has_permission('x'))` va envuelto en subselect para que se evalúe una vez por consulta. Hay índices en todas las columnas usadas por políticas.
- **service role:** solo en scripts y (más adelante) webhooks y cron. **Nunca** en el camino de renderizado de páginas.

---

## 10. Autenticación del admin

**Flujo:**
1. **Alta:** un `owner` invita desde el admin (a partir de la F11; en la F1, con `scripts/bootstrap-owner.ts`). Supabase envía el email de invitación → `/auth/callback` → fijar contraseña.
2. **Login:** `/admin/acceso` (email + contraseña) mediante una Server Action. Errores genéricos, sin revelar si el email existe.
3. **MFA:** si el usuario no tiene factor TOTP, `/admin/mfa` le obliga a darlo de alta. Si lo tiene, verificación → sesión `aal2`. Los permisos `pricing.*` y `staff.manage` **requieren `aal2`**, tanto en servidor como en SQL.
4. **Protección** (cada capa por separado):
   - proxy/middleware: sin sesión → `/admin/acceso`;
   - `app/admin/layout.tsx`: `requireStaff()`, que usa `supabase.auth.getUser()` (validado contra Supabase, nunca solo la cookie) + fila activa en `staff_members`; si no, 404 (no se revela que el admin existe);
   - **cada Server Action del admin** llama a `requirePermission()` al empezar;
   - RLS en la BD.
5. **Cierre de sesión** mediante Server Action; sesión con expiración y refresco gestionados por `@supabase/ssr`.
6. **Rate limiting del login:** en la Fase 1, los límites nativos de Supabase Auth. Si se necesita un limitador propio, se decidirá en la F16.
7. **Auditoría:** login correcto, login fallido y alta de MFA → `audit_log`.

---

## 11. Estructura del repositorio

Es la de §1, que concreta la §14 de la Fase 0 rev. 2. Reglas:
- `app/` solo compone y enruta;
- la lógica vive en `modules/<dominio>/{domain,server,schemas,ui}`;
- `lib/` contiene infraestructura transversal;
- `components/ui` es el Design System (vacío hasta la F2).

Los módulos que se crean en la F1 son solo los necesarios: `auth`, `i18n`, y los tipos y reglas puras de `catalog` y `pricing`. El resto se crea en su fase para no dejar carpetas vacías sin propósito.

---

## 12. Variables de entorno

| Variable | Ámbito | Uso |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Cliente + servidor | URL base (canonical, OG, callbacks) |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente + servidor | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente + servidor | Clave pública (antes «anon key»; usaré la nomenclatura vigente del proyecto) |
| `SUPABASE_SECRET_KEY` | **Solo servidor** | Clave de servicio (antes «service_role»); solo en scripts, webhooks y cron |
| `SUPABASE_PROJECT_REF` | CI | Vincular la CLI |
| `SUPABASE_ACCESS_TOKEN` | CI (secreto) | CLI para `db push` a dev/prod |
| `SUPABASE_DB_PASSWORD` | CI (secreto) | Migraciones remotas |
| `BOOTSTRAP_OWNER_EMAIL` | Local / uso puntual | `scripts/bootstrap-owner.ts` |

**Reservadas para fases futuras** (se documentan ahora en `.env.example` como comentarios, sin usarse): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `CRON_SECRET`, `EMAIL_API_KEY`.

- `src/lib/env.ts` valida con zod **al arrancar y en build**: si falta algo, el build falla con un mensaje claro.
- El esquema del cliente solo acepta `NEXT_PUBLIC_*`.
- Un test impide que una variable sin `NEXT_PUBLIC_` se importe desde código cliente.
- **Nunca** se commitean `.env*` salvo `.env.example`.

---

## 13. CI (GitHub Actions)

| Workflow | Disparador | Pasos |
|---|---|---|
| `ci.yml` | PR y push a `main` | checkout → pnpm (caché) → `pnpm install --frozen-lockfile` → `lint` → `typecheck` → `test:unit` → `build` (con env de CI no secretas) |
| `db.yml` | PR que toque `supabase/**` o `src/lib/supabase/**`, y push a `main` | Supabase CLI → `supabase start` → `supabase db reset` (migraciones + seed) → carga de `tests/fixtures/test-db.sql` → `supabase test db` (pgTAP) → `gen types` y **diff** con lo commiteado → `supabase db lint` |
| `e2e.yml` | PR a `main` | Supabase local + `next build && next start` → Playwright (Chromium, viewports 390×844 y 1440×900) → subir traces si falla |
| Deploy de migraciones | Push a `main` → **dev** automático; **prod solo con aprobación manual** (environment protegido) | `supabase db push` |

- **Vercel:** integración Git → Preview por PR (conectado a `adhara-dev`) y Production desde `main` (conectado a `adhara-prod`), sin dominio público hasta la F17.
- **Protección de `main`:** PR obligatorio y los tres workflows en verde.

---

## 14. Tests iniciales

**Unitarios (Vitest)**

| Test | Qué garantiza |
|---|---|
| `env.test.ts` | El esquema rechaza env incompletas; el esquema de cliente no acepta secretos |
| `money.test.ts` | Céntimos ↔ euros; neto ↔ bruto con IVA en puntos básicos; redondeo half-even documentado; sin errores de coma flotante |
| `margin.test.ts` | Margen € y % sobre neto con casos de referencia (p. ej. PVP 29,95 € con IVA 21 % y coste 18,00 €); margen de sin coste = «desconocido», nunca 0 |
| `i18n-routing.test.ts` | Cada ruta del mapa tiene su segmento en los 3 locales; no hay colisiones entre locales; los mensajes `ca`/`en` tienen las mismas claves que `es` |
| `seo-alternates.test.ts` | Canonical propio si está publicado; canonical a `es` + `noindex` si no; hreflang solo de locales publicados + `x-default` |
| `can-publish.test.ts` | La regla pura rechaza: sin marca, sin PVP aprobado, sin traducción `es` publicada, sin imagen aprobada no-PDF, con conflicto crítico abierto |

**Base de datos (pgTAP, `supabase test db`)**

| Test | Qué garantiza |
|---|---|
| `01_rls_catalog` | `anon` y `authenticated` sin personal: ven publicados, **no** ven DRAFT ni archivados; no pueden escribir |
| `02_rls_translations` | Una traducción `draft` es invisible para `anon` aunque el producto esté publicado; UNIQUE (locale, slug) |
| `03_pricing_isolation` | `anon`/`authenticated`: **no** pueden hacer `SELECT` en `internal.*` ni ejecutar `admin_get_variant_pricing`; `content_editor` recibe error de permiso; `manager` con `aal1` recibe error (requiere `aal2`); `manager` con `aal2` obtiene coste y margen |
| `04_staff_permissions` | La matriz rol → permiso se cumple (tabla de verdad completa) |
| `05_append_only` | UPDATE y DELETE en `audit_log`, `variant_cost_records` y `price_change_log` fallan para todos los roles |
| `06_constraints` | Precios ≥ 0; no se puede publicar si `can_publish` es falso; cambiar `retail_price_cents` sin permiso falla; `origin` de claims válido |

**E2E (Playwright)**

| Test | Qué garantiza |
|---|---|
| `i18n.spec.ts` | `/` redirige a `/es` (y a `/ca` con cookie o `Accept-Language` ca); `/ca/cataleg` y `/en/catalog` resuelven a la misma ruta interna; `<html lang>` correcto; `/xx` → 404 |
| `admin-auth.spec.ts` | `/admin` sin sesión → `/admin/acceso`; usuario sin fila de personal → 404; personal sin MFA → `/admin/mfa`; personal con MFA → shell del admin; logout |
| `cost-leak.spec.ts` | Con el coste centinela `987654` sembrado solo en la BD de test: recorre las rutas públicas y comprueba que el centinela **no aparece** en HTML, payload RSC, `__NEXT_DATA__`, respuestas JSON ni cabeceras |

---

## 15. Documentación

| Archivo | Contenido en la Fase 1 |
|---|---|
| `README.md` | Requisitos, arranque local (Supabase local + Next), scripts, variables, flujo de ramas y PR |
| `CLAUDE.md` | Stack y versiones instaladas; reglas de arquitectura (módulos, capas, imports prohibidos); reglas de seguridad (coste interno, precio en servidor, service role); i18n; «nunca inventar datos de producto»; protocolo PLAN/IMPLEMENT/VERIFY/REPORT; enlaces a los docs |
| `docs/ARCHITECTURE.md` | Fase 0 rev. 2 consolidada (partes técnicas) |
| `docs/DATABASE.md` | Tablas migradas, estados, diagrama ER (Mermaid), matriz de RLS, funciones |
| `docs/DECISIONS.md` | ADR-001 a ADR-016 con el formato completo; ADR-008 marcada como **sustituida por ADR-010** |
| `docs/SECURITY.md` | Roles, permisos, MFA, RLS, secretos, aislamiento del coste |
| `docs/I18N.md` | Locales, mapa de rutas, canonical/hreflang, slugs, flujo de traducción |
| `docs/PRICING.md` | Cuatro precios, IVA, fórmulas de margen, histórico de costes, pricing research (diseño), aprobación, criterio Ómnibus |
| `docs/PRODUCT_RESEARCH.md` | Borrador: orígenes, prioridad de fuentes, claims, conflictos (se completa en la F4) |
| `docs/ROADMAP.md` | Roadmap rev. 2 con estado por fase |
| `docs/phases/FASE_1_REPORT.md` | REPORT de la fase (en el paso REPORT) |

---

## 16. Criterios exactos de finalización de la Fase 1

La Fase 1 está terminada **solo** si se cumplen todos estos criterios y quedan evidenciados en el REPORT (salida de comandos o enlaces a runs de CI):

**Build y calidad**
1. `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` y `pnpm build` terminan con código 0, sin warnings de TypeScript y sin `any` fuera de archivos generados.
2. Los tres workflows de CI están en verde en el PR de la fase.
3. Hay un Preview de Vercel desplegado y accesible.

**i18n**
4. `/` → `/es` (307); con `Accept-Language: ca` → `/ca`; con cookie `en` → `/en`.
5. `/es/catalogo`, `/ca/cataleg` y `/en/catalog` resuelven (página técnica) y cada una tiene el `<html lang>` correcto.
6. `ca.json` y `en.json` tienen el 100 % de las claves de `es.json` (test).
7. `buildAlternates` cubre los 4 casos (publicado, no publicado, sin traducciones, x-default) con tests en verde.

**Base de datos y seguridad**
8. `supabase db reset` aplica las 11 migraciones y el seed sin errores en local y en `adhara-dev`.
9. Todos los tests pgTAP en verde, incluyendo como mínimo:
   - `anon` no ve DRAFT;
   - `anon` no puede leer `internal` ni ejecutar funciones `admin_*`;
   - `content_editor` no obtiene coste;
   - `aal1` no obtiene coste;
   - las tablas de solo inserción rechazan UPDATE/DELETE;
   - no se puede publicar sin `can_publish`;
   - `retail_price_cents` no cambia sin permiso.
10. `internal` **no** aparece en los esquemas expuestos de la API de `adhara-dev`. Verificación: una petición REST a `/rest/v1/...` sobre una tabla de `internal` con la publishable key devuelve error.
11. `cost-leak.spec.ts` en verde: el centinela no aparece en ninguna respuesta pública.
12. Los tipos generados coinciden con el esquema (diff vacío en CI).
13. No hay secretos en el repo; hay un escaneo básico en CI (búsqueda de patrones de claves) o GitHub secret scanning activo.

**Autenticación del admin**
14. `/admin` sin sesión → `/admin/acceso`; sesión sin personal → 404; personal sin MFA → `/admin/mfa`; personal con `aal2` → shell del admin (e2e en verde).
15. El primer `owner` real existe en `adhara-dev`, creado con `bootstrap-owner`, y tiene MFA activo.
16. Las cabeceras de seguridad están presentes en las respuestas (comprobado en e2e), y `/admin` lleva `noindex` y `no-store`.

**Documentación y alcance**
17. Todos los docs de §15 existen y reflejan lo implementado. `DECISIONS.md` contiene ADR-010 sustituyendo a ADR-008.
18. **No existe** ningún dato de producto, marca o nota en dev ni en prod (consulta de recuento = 0), y no se ha creado ninguna página de negocio ni componente visual de marca.
19. El REPORT enumera los archivos creados, las versiones instaladas, las decisiones tomadas durante la implementación, los problemas, la deuda técnica y la fase siguiente recomendada (**Fase 2 — Design System**, en paralelo con la preparación de la **Fase 3 — Importación**).

---

## Riesgos específicos de la Fase 1

- **Convenciones de Next.js** cambiantes entre versiones (proxy/middleware, caché): se verificarán contra la documentación de la versión instalada.
- **Supabase: nombres de claves** (publishable/secret frente a anon/service_role) y configuración de esquemas expuestos: se validará en el proyecto real.
- **MFA en local/CI:** los tests e2e necesitan generar TOTP. Usaré un secreto TOTP de prueba solo en la BD local y lo calcularé en el test con la API `crypto` nativa, sin dependencia extra.
- **Tiempo de CI:** `supabase start` en Actions tarda unos minutos; se cachearán las imágenes Docker si es necesario.
