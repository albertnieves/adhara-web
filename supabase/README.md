# Supabase

Proyecto de desarrollo: **`adhara-dev`** (ref `xgpsislololgbakzcmad`), región `eu-central-1` (Frankfurt), organización del usuario. Producción (`adhara-prod`) se creará cuando la base y los permisos estén verificados.

## Migraciones

`migrations/` es la fuente de verdad del esquema. Los nombres llevan la versión con la que se aplicaron en `adhara-dev`, para que la CLI de Supabase los reconozca.

| Versión        | Contenido                                                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20260929170331 | Esquemas `internal` y `private` sin acceso desde la API; triggers `set_updated_at` y `reject_mutation`                                                                                                                  |
| 20260929170455 | `permissions`, `role_permissions`, `staff_members`, `audit_log` (solo inserción), funciones de autorización y RLS                                                                                                       |
| 20260929170513 | Índices de claves foráneas                                                                                                                                                                                              |
| 20260929220732 | Catálogo: `brands`, `products`, `product_translations`, `product_variants` (PVP en céntimos), `product_media` con procedencia, historial de PVP en `internal`, reglas de publicación y precio, bucket `product-media`   |
| 20260929220840 | Inventario: `stock_locations`, `inventory_levels`, `inventory_movements` (solo inserción), funciones `admin_record_inventory_movement`, `admin_record_stocktake`, `admin_set_reorder_point` y `storefront_availability` |
| 20260929224423 | Gestión del personal desde el panel: `admin_list_staff`, `admin_grant_staff`, `admin_set_staff_active` (staff.manage)                                                                                                   |
| 20260929230737 | Un nivel de stock se borra con su formato; el historial de movimientos sigue impidiendo borrar formatos con movimientos                                                                                                 |

La matriz de permisos se genera desde `src/modules/auth/domain/permissions.ts`; `tests/unit/permissions-sql.test.ts` falla si ambas divergen. Del mismo modo, `tests/unit/inventory-sql.test.ts` compara tipos, efectos, permisos y motivos de los movimientos con `src/modules/inventory/domain/movements.ts`.

Los tipos de `src/lib/supabase/database.types.ts` se generan desde `adhara-dev` tras cada migración.

## Pruebas de base de datos

Sin Docker, las pruebas se ejecutan contra `adhara-dev` con `tests/tap_remote.py`, que revierte todo al terminar. Resultado del 29/09/2026: `01_staff_permissions` 22/22 (sesión del PR #5) y `02_catalog_inventory` 33/33.

`tests/database/*.test.sql` son pruebas pgTAP para `supabase test db`. Crean usuarios ficticios dentro de una transacción que se revierte. Cubren anon, usuario sin personal (cliente), `viewer`, `store_admin` y `system_admin`, con y sin MFA (aal2), y la auditoría de solo inserción.

## Configuración de Auth (panel de Supabase)

- Registro público desactivado (hecho por el usuario el 29/09/2026).
- **URL Configuration:** Site URL = URL del despliegue (Preview de Vercel mientras no haya producción); añadirla también en Redirect URLs.
- **Email Templates:** en _Invite user_ y _Reset password_, el enlace debe ser
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` y
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` respectivamente.
- Alta del primer administrador: `pnpm bootstrap:owner` con `BOOTSTRAP_OWNER_EMAIL`, `SUPABASE_SECRET_KEY` y `NEXT_PUBLIC_SUPABASE_URL` en el entorno.

## Datos

`data/` guarda cargas de datos versionadas (no son migraciones): `20260929_pilot_products.sql` crea los 4 perfumes del piloto como borradores sin PVP, con su procedencia.

## Pendiente

- `config.toml` y Supabase local con la CLI cuando haya Docker disponible; añadir las pruebas pgTAP a la CI.
- Resto de migraciones de la Fase 1: taxonomía (familias, notas), procedencia del research, costes internos y proveedores.
