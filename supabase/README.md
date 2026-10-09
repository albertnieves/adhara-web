# Supabase

Proyecto de desarrollo: **`adhara-dev`** (ref `xgpsislololgbakzcmad`), región `eu-central-1` (Frankfurt), organización del usuario. Producción (`adhara-prod`) se creará cuando la base y los permisos estén verificados.

## Migraciones

`migrations/` es la fuente de verdad del esquema. Los nombres llevan la versión con la que se aplicaron en `adhara-dev`, para que la CLI de Supabase los reconozca.

| Versión        | Contenido                                                                                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20260929170331 | Esquemas `internal` y `private` sin acceso desde la API; triggers `set_updated_at` y `reject_mutation`                                                                                                                                                                                    |
| 20260929170455 | `permissions`, `role_permissions`, `staff_members`, `audit_log` (solo inserción), funciones de autorización y RLS                                                                                                                                                                         |
| 20260929170513 | Índices de claves foráneas                                                                                                                                                                                                                                                                |
| 20260929220732 | Catálogo: `brands`, `products`, `product_translations`, `product_variants` (PVP en céntimos), `product_media` con procedencia, historial de PVP en `internal`, reglas de publicación y precio, bucket `product-media`                                                                     |
| 20260929220840 | Inventario: `stock_locations`, `inventory_levels`, `inventory_movements` (solo inserción), funciones `admin_record_inventory_movement`, `admin_record_stocktake`, `admin_set_reorder_point` y `storefront_availability`                                                                   |
| 20260929224423 | Gestión del personal desde el panel: `admin_list_staff`, `admin_grant_staff`, `admin_set_staff_active` (staff.manage)                                                                                                                                                                     |
| 20260929230737 | Un nivel de stock se borra con su formato; el historial de movimientos sigue impidiendo borrar formatos con movimientos                                                                                                                                                                   |
| 20260929232007 | Roles preasignados por email (`private.pending_staff_grants`): al crear y confirmar la cuenta en Auth recibe su rol automáticamente                                                                                                                                                       |
| 20260930045615 | Costes: `internal.variant_cost_records` (solo inserción, fuera de la API) y funciones `admin_variant_costs` (pricing.view_cost) y `admin_record_variant_cost` (pricing.edit_cost), ambas con MFA                                                                                          |
| 20260930083657 | `admin_record_variant_costs`: registro de costes por lotes para la importación (hasta 2000, todo o nada), auditado con el número de filas y sin importes                                                                                                                                  |
| 20260930220818 | Guardas de MFA en las escrituras SQL y protección del último administrador                                                                                                                                                                                                                |
| 20260930220820 | Ediciones seguras: revisiones de PVP ligadas a la sesión, foto principal única, precio anterior y auditoría del catálogo                                                                                                                                                                  |
| 20260930220822 | Contenido de la tienda (portada y datos) con borrador, revisiones de solo inserción y publicación; bucket `editorial`                                                                                                                                                                     |
| 20260930220824 | Invitaciones del personal                                                                                                                                                                                                                                                                 |
| 20260930224000 | Fase R: proveedores, pedidos y recepciones en `internal`; mostrador (`store_sales`), parámetros del vigilante y sus funciones `admin_*`, con MFA en toda escritura                                                                                                                        |
| 20261001090000 | Fase S: informes de solo lectura `admin_report_inventory_period` (reports.view; costes con pricing.view_cost) y `admin_report_purchases` (purchasing.manage)                                                                                                                              |
| 20261002044249 | Asistente (aplicada en `adhara-dev` el 02/10): `daily_reports` (lectura con `agent.use`, escritura solo del servidor), `assistant_usage` (solo inserción), `admin_open_purchase_orders` sin proveedor ni costes y lectura del vigilante también para la tarea programada (`service_role`) |
| 20261009150000 | Perfil olfativo: `product_scent_profiles` (lectura pública de publicados; escritura `catalog.edit` o `research.edit`), notas como claves del vocabulario y fuente `https` obligatoria                                                                                                     |
| 20261009150100 | Suscriptores a promociones: `newsletter_subscribers` (sin acceso público; `customers.view` lee y `customers.manage` da de baja o borra) y alta pública `newsletter_subscribe`                                                                                                             |

La matriz de permisos se genera desde `src/modules/auth/domain/permissions.ts`; `tests/unit/permissions-sql.test.ts` falla si ambas divergen. Del mismo modo, `tests/unit/inventory-sql.test.ts` compara tipos, efectos, permisos y motivos de los movimientos con `src/modules/inventory/domain/movements.ts`.

Los tipos de `src/lib/supabase/database.types.ts` se generan desde `adhara-dev` tras cada migración.

## Pruebas de base de datos

`tests/database/*.test.sql` son pruebas pgTAP para `supabase test db` (`pnpm test:db`). Crean usuarios ficticios dentro de una transacción que se revierte y cubren anon, usuario sin personal (cliente), `viewer`, `store_admin` y `system_admin`, con y sin MFA (aal2). Se ejecutan en cada PR y en `main` en `db.yml`, sobre Supabase local recién reiniciado (`supabase db reset`). Resultado del 09/10 (CLI 2.118.0): 293/293 en 9 archivos.

| Archivo                 | Pruebas | Qué cubre                                                                                                                                                                     |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01_staff_permissions`  | 22      | Matriz de permisos, MFA, personal y auditoría de solo inserción                                                                                                               |
| `02_catalog_inventory`  | 33      | Visibilidad pública, PVP con MFA, publicación, movimientos y niveles                                                                                                          |
| `03_costs`              | 33      | Costes fuera de la API, permisos y MFA, historial de solo inserción; ninguna tabla pública con columnas de coste                                                              |
| `04_delivery`           | 47      | Entrega de administración: MFA en escrituras, último administrador, revisiones de PVP, contenido e invitaciones                                                               |
| `04_purchasing_counter` | 54      | Proveedores, pedidos, recepción, mostrador y vigilante por rol                                                                                                                |
| `05_reports`            | 22      | Informes: permisos, cuadre de existencias, coste a fecha y plazo real                                                                                                         |
| `06_assistant`          | 24      | Informes diarios, registro de uso y lecturas de la tarea programada                                                                                                           |
| `07_phase1_guarantees`  | 28      | Criterio 9 de la Fase 1: RLS en todas las tablas públicas, anon sin `admin_*` ni escritura, PVP sin permiso, publicación y UPDATE/DELETE en solo inserción                    |
| `08_scent_newsletter`   | 30      | Perfil olfativo (restricciones, lectura de publicados, escritura con permiso y MFA) y suscriptores (alta pública, sin lectura pública, baja y borrado con `customers.manage`) |

Además, en `db.yml`: `scripts/check-db-types.ts` (tipos generados iguales a las migraciones) y `scripts/check-db-lint.ts` (`supabase db lint` con plpgsql_check; falla con cualquier error salvo tres falsos positivos de tablas temporales, DECISIONS §84).

Antes de tener Docker, las pruebas se ejecutaron contra `adhara-dev` con `tests/tap_remote.py`, que revierte todo al terminar (29–30/09).

### Concurrencia

`tests/concurrency/counter_and_receipts.sh` abre sesiones paralelas contra una base **local** (deja datos en tablas de solo inserción; se limpia con `supabase db reset`): N ventas simultáneas de la última unidad, la misma venta enviada N veces y N recepciones simultáneas de un pedido. Resultado con 24 sesiones: una sola venta, una sola venta para la misma clave, nunca más de lo pedido y nivel igual a la suma de movimientos. Se ejecuta en `db.yml` con `scripts/test-concurrency.ts`.

### Coste centinela

`../tests/fixtures/test-db.sql` crea, solo en la base local de `e2e.yml`, un perfume ficticio publicado con un coste de 987654 céntimos y un proveedor con ese número; `tests/e2e/cost-leak.spec.ts` comprueba que no aparece en ninguna respuesta pública. Nunca se carga en `adhara-dev`.

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

- Esquema diferido a su fase: taxonomía, research y claims, `media_assets`, `tax_rates`, `locales`, colecciones y buckets del plan (DECISIONS §86).
- Proyecto `adhara-prod` y workflow de despliegue de migraciones (DECISIONS §84).
- Protección de contraseñas filtradas en Supabase Auth.

## Entrega de administración

Cuatro migraciones adicionales: `20260930220818` MFA/último administrador, `20260930220820` ediciones/PVP/stock/media, `20260930220822` contenido/editorial y `20260930220824` invitaciones. Son complementarias a las fases R/S y están aplicadas en `adhara-dev` desde el 01/10. CLI local fijada, comandos y tipos en `docs/ADMIN_LOCAL_VALIDATION.md`; aplicación y reversión en `docs/DELIVERY_REPORT.md`.
