# Entorno y validación de administración

Node 24.16.0, pnpm 11.19.0 y Supabase CLI 2.118.0, fijadas en el repositorio. Requiere Docker. El worktree `admin-store-delivery` preserva el checkout original y sus cambios locales. Esta entrega se apoya en la PR #9 de Claude (`f95c370`); no sustituye sus fases R/S.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
pnpm format:check
pnpm scan:secrets
pnpm exec supabase start
pnpm test:db
node scripts/check-db-types.ts
# Exclusivamente local: elimina fixtures y reaplica migraciones.
pnpm exec supabase db reset --local
node scripts/test-concurrency.ts
pnpm build:local
pnpm test:e2e:local
pnpm exec supabase stop
```

El proyecto local `adhara-admin-delivery` usa API 54321, PostgreSQL 54322, Studio 54323 y Mailpit 54324. `local-env.ts` obtiene credenciales efímeras de la CLI sin imprimirlas, exige loopback y las pasa al proceso hijo. No crea `.env`. `auth.enable_signup=false` cierra el registro público; `auth.email.enable_signup=true` mantiene habilitado el proveedor de email.

`check` incluye lint, tipos, unitarios y build. `test:e2e` comprueba la navegación sobre el build sin Supabase. `build:local` y `test:e2e:local` comprueban el panel y la publicación contra servicios locales. El puerto 3000 debe estar libre.

pgTAP revierte sus fixtures. La prueba de concurrencia requiere personal vacío y usa conexiones independientes al contenedor con nombre fijo. Los recorridos de navegador crean usuarios, completan TOTP y usan Mailpit; conservan fixtures hasta reset. No ejecutar contra `adhara-dev` ni cargar `supabase/data` como seed. No guardar trazas de pantallas de MFA. Para desarrollo conectado: `node scripts/local-env.ts pnpm dev`.

Crear migraciones con `pnpm exec supabase migration new <nombre>`; reaplicarlas desde cero, comprobar RLS y regenerar tipos:

```sh
./node_modules/.bin/supabase gen types --local --schema public > src/lib/supabase/database.types.ts
pnpm exec prettier --write src/lib/supabase/database.types.ts
node scripts/check-db-types.ts
```

La CI incorpora base local, tipos, concurrencia y navegador autenticado. El éxito local no acredita por sí solo CI ni Preview. Para Auth remoto, configurar Site URL/allowlist y plantillas `supabase/templates`; invitaciones requieren `SUPABASE_SECRET_KEY` únicamente en servidor. No enviar correos reales para validar el desarrollo.
