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
| 20260929232007 | Roles preasignados por email (`private.pending_staff_grants`): al crear y confirmar la cuenta en Auth recibe su rol automáticamente                                                                                     |
| 20260930045615 | Costes: `internal.variant_cost_records` (solo inserción, fuera de la API) y funciones `admin_variant_costs` (pricing.view_cost) y `admin_record_variant_cost` (pricing.edit_cost), ambas con MFA                        |
| 20260930083657 | `admin_record_variant_costs`: registro de costes por lotes para la importación (hasta 2000, todo o nada), auditado con el número de filas y sin importes                                                                |

La matriz de permisos se genera desde `src/modules/auth/domain/permissions.ts`; `tests/unit/permissions-sql.test.ts` falla si ambas divergen. Del mismo modo, `tests/unit/inventory-sql.test.ts` compara tipos, efectos, permisos y motivos de los movimientos con `src/modules/inventory/domain/movements.ts`.

Los tipos de `src/lib/supabase/database.types.ts` se generan desde `adhara-dev` tras cada migración.

## Pruebas de base de datos

Sin Docker, las pruebas se ejecutan contra `adhara-dev` con `tests/tap_remote.py`, que revierte todo al terminar. Resultados: `01_staff_permissions` 22/22 (29/09, sesión del PR #5), `02_catalog_inventory` 33/33 (29/09) y `03_costs` 33/33 (30/09, con el registro por lotes).

`tests/database/*.test.sql` son pruebas pgTAP para `supabase test db`. Crean usuarios ficticios dentro de una transacción que se revierte. Cubren anon, usuario sin personal (cliente), `viewer`, `store_admin` y `system_admin`, con y sin MFA (aal2), y la auditoría de solo inserción. `03_costs` comprueba además que ninguna tabla pública tiene columnas de coste y que anon no ejecuta ninguna función que los devuelva.

## Configuración de Auth (panel de Supabase)

- Registro público desactivado (hecho por el usuario el 29/09/2026).
- **URL Configuration:** Site URL = URL del despliegue (Preview de Vercel mientras no haya producción); añadirla también en Redirect URLs.
- **Email Templates:** en _Invite user_ y _Reset password_, el enlace debe ser
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` y
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` respectivamente.
- Alta del personal: los emails preasignados en `private.pending_staff_grants` reciben su rol al crear la cuenta (Authentication → Users → Add user → Create new user, con «Auto Confirm User») o al aceptar la invitación. Alternativa: `pnpm bootstrap:owner` con `BOOTSTRAP_OWNER_EMAIL`, `SUPABASE_SECRET_KEY` y `NEXT_PUBLIC_SUPABASE_URL` en el entorno.

## Datos

`data/` guarda cargas de datos versionadas (no son migraciones), idempotentes y con su procedencia:

- `20260929_pilot_products.sql` crea los 4 perfumes del piloto como borradores sin PVP.
- `20260930_catalogo_2026.sql` crea las marcas y los 420 perfumes nuevos del «CATALOGO 2026» como borradores, sin formatos, PVP ni costes, y sus 647 imágenes provisionales. Las URL apuntan a los archivos ya subidos al bucket `product-media` de `adhara-dev`; en otro proyecto habría que subirlos antes. Los formatos y los costes llegan con el CSV desde el panel (DECISIONS §54-55).
- `20260930_piloto_publicado.sql` publica los 4 perfumes del piloto con su PVP y su procedencia (DECISIONS §57).
- `20260930_compra_orient_fragance.sql` carga la compra a Orient Fragance: 34 perfumes nuevos, un formato con PVP de la tienda oficial por perfume, 20 uds de stock por formato y publicación de los que tienen PVP (DECISIONS §57).

## Pendiente

- `config.toml` y Supabase local con la CLI cuando haya Docker disponible; añadir las pruebas pgTAP a la CI.
- Resto de migraciones de la Fase 1: taxonomía (familias, notas), procedencia del research y proveedores.
