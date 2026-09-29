# Supabase

Proyecto de desarrollo: **`adhara-dev`** (ref `xgpsislololgbakzcmad`), región `eu-central-1` (Frankfurt), organización del usuario. Producción (`adhara-prod`) se creará cuando la base y los permisos estén verificados.

## Migraciones

`migrations/` es la fuente de verdad del esquema. Los nombres llevan la versión con la que se aplicaron en `adhara-dev`, para que la CLI de Supabase los reconozca.

| Versión        | Contenido                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| 20260929170331 | Esquemas `internal` y `private` sin acceso desde la API; triggers `set_updated_at` y `reject_mutation`            |
| 20260929170455 | `permissions`, `role_permissions`, `staff_members`, `audit_log` (solo inserción), funciones de autorización y RLS |
| 20260929170513 | Índices de claves foráneas                                                                                        |

La matriz de permisos se genera desde `src/modules/auth/domain/permissions.ts`; `tests/unit/permissions-sql.test.ts` falla si ambas divergen.

## Pruebas de base de datos

`tests/database/*.test.sql` son pruebas pgTAP para `supabase test db`. Crean usuarios ficticios dentro de una transacción que se revierte. Cubren anon, usuario sin personal (cliente), `viewer`, `store_admin` y `system_admin`, con y sin MFA (aal2), y la auditoría de solo inserción.

## Configuración de Auth (panel de Supabase)

- Registro público desactivado (hecho por el usuario el 29/09/2026).
- **URL Configuration:** Site URL = URL del despliegue (Preview de Vercel mientras no haya producción); añadirla también en Redirect URLs.
- **Email Templates:** en _Invite user_ y _Reset password_, el enlace debe ser
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` y
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` respectivamente.
- Alta del primer administrador: `pnpm bootstrap:owner` con `BOOTSTRAP_OWNER_EMAIL`, `SUPABASE_SECRET_KEY` y `NEXT_PUBLIC_SUPABASE_URL` en el entorno.

## Pendiente

- `config.toml` y Supabase local con la CLI cuando haya Docker disponible; añadir las pruebas pgTAP a la CI.
- Resto de migraciones de la Fase 1 (catálogo, precios internos, publicación, storage).
