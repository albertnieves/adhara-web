# Seguridad

Cómo se protegen el panel, los datos internos y los secretos. Estado al 02/10/2026; cada afirmación tiene una prueba o una comprobación citada.

## Roles y permisos

Fuente única: `src/modules/auth/domain/permissions.ts`. La misma matriz está sembrada en `public.role_permissions`; `tests/unit/permissions-sql.test.ts` falla si divergen y `01_staff_permissions` comprueba la tabla de verdad en SQL.

| Rol            | Quién                      | Alcance                                                                                |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `system_admin` | Administrador del sistema  | Todo: personal, configuración y control del negocio (`business.control`)               |
| `store_admin`  | Administrador de la tienda | Operación, costes, compras y reembolsos; sin personal, configuración ni control        |
| `viewer`       | Encargado                  | `inventory.view`, `orders.view`, `messages.view` y `agent.use`; sin clientes ni costes |

Sustituyen a `owner`, `manager`, `store_staff` y `content_editor` de la Fase 0 (DECISIONS §14). Los clientes no son personal: cuando existan (F14), solo verán sus datos por RLS.

## MFA

- Todo el personal entra con TOTP. Sin factor, `/admin/mfa` obliga a darlo de alta; con factor sin verificar en la sesión, pide el código. El panel solo se abre con sesión `aal2` (`tests/unit/admin-access.test.ts` y recorridos de `tests/integration/admin.spec.ts`).
- Las escrituras y los datos sensibles exigen `aal2` también en SQL (`private.current_aal()`). Solo `inventory.view`, `orders.view`, `messages.view`, `agent.use`, `reports.view` y `customers.view` no lo exigen en la matriz.
- La recuperación de contraseña exige el segundo factor existente y rechaza enlaces reutilizados (recorrido autenticado).
- `adhara-dev`: el administrador del sistema tiene TOTP verificado desde el 01/10; el administrador de la tienda aún no (comprobado el 02/10 con una lectura).

## Autorización en cuatro capas

1. **Proxy** (`src/proxy.ts`): refresca la sesión y, sin ella, redirige `/admin/*` a `/admin/acceso`. No autoriza.
2. **Layout del panel** (`requireStaff`): `getUser()` validado contra Supabase Auth, ficha activa en `staff_members` y `aal2`. Sin ficha, 404 (no revela que el panel existe; recorrido autenticado «una sesión sin ficha de personal recibe 404»).
3. **Cada Server Action y cada Route Handler** del panel llama a `requirePermission()` al empezar.
4. **Base de datos**: RLS en todas las tablas públicas y funciones `admin_*` que comprueban permiso y MFA (pgTAP `01`–`07`).

Una redirección nunca sustituye la autorización en servidor.

## Aislamiento de costes y proveedores

- Costes, historial de PVP, proveedores y pedidos de compra viven en `internal`, que la API no expone (`PGRST106` en `adhara-dev`, criterio 10) y sobre el que `anon` y `authenticated` no tienen privilegios (pgTAP `03` y `07`).
- Solo se leen con funciones `admin_*` que exigen `pricing.view_cost` o `purchasing.manage` con MFA.
- Las tareas, los costes del negocio y las entregas del control (`/admin/control`) también viven en `internal`, solo con `business.control` (administrador del sistema con MFA); la auditoría no guarda sus importes (pgTAP `09`).
- Ninguna tabla pública tiene columnas de coste (pgTAP `03`). La tienda solo recibe disponible, últimas unidades o agotado (`storefront_availability`).
- `tests/e2e/cost-leak.spec.ts` recorre las rutas públicas (HTML, RSC, JSON y cabeceras) buscando nombres de campos de coste y, en `e2e.yml`, el coste centinela de `tests/fixtures/test-db.sql` (987654 céntimos, también como 9.876,54 €), su proveedor y su referencia.
- El informe diario y el asistente trabajan en unidades, sin costes, importes ni nombres de proveedor (`tests/unit/assistant.test.ts`).

## Secretos y claves

| Variable                                                           | Dónde                  | Uso                                                                                 |
| ------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente y servidor     | Públicas; la RLS protege los datos                                                  |
| `SUPABASE_SECRET_KEY`                                              | Solo servidor (Vercel) | Invitaciones de Auth (`createAuthAdminClient`) e informe diario (`createJobClient`) |
| `ANTHROPIC_API_KEY`, `CRON_SECRET`, `ASSISTANT_DAILY_LIMIT`        | Solo servidor (Vercel) | Asistente y tarea programada                                                        |

- Los módulos con secretos importan `server-only`; el build falla si llegan al cliente.
- La clave privilegiada nunca está en el camino de renderizado de páginas ni recibe datos del navegador sin una autorización previa.
- `.env.example` solo lleva valores públicos y nombres de variables. `pnpm scan:secrets` (en `ci.yml`) busca patrones de claves en los archivos versionados sin imprimirlas (criterio 13).
- `CRON_SECRET` se compara en tiempo constante; sin configurar, la tarea programada responde 503.
- Nunca se piden claves por chat: el usuario las configura en Vercel.

## Cabeceras e indexación

`next.config.ts` añade a todas las respuestas `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` sin cámara, micrófono ni geolocalización y `X-Robots-Tag: noindex, nofollow`; sin `X-Powered-By`. `/admin` lleva además `Cache-Control: private, no-store`. `robots.txt` lo prohíbe todo mientras se desarrolla. Comprobado en `tests/e2e/setup.spec.ts` y `admin-auth.spec.ts` (criterio 16).

## Auditoría y solo inserción

Las acciones sensibles (personal, precios, costes, stock, compras, contenido) quedan en `audit_log` con actor, acción y cambios; los costes se anotan sin importes. `audit_log`, movimientos, ventas de mostrador, recepciones, historiales de PVP y de costes, revisiones de contenido y uso del asistente rechazan `UPDATE` y `DELETE` para todos los roles (pgTAP `07`).

## Asistente

Herramientas de solo lectura con la sesión y los permisos de quien pregunta; ninguna escribe ni usa la clave privilegiada (prueba unitaria). Tope diario por persona, hasta 8 vueltas por pregunta, 60 s por petición y registro de uso de solo inserción. La consulta comprueba el origen de la petición.

## Avisos del asesor de Supabase (`adhara-dev`, 02/10)

| Aviso                                                             | Estado                                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Funciones `SECURITY DEFINER` ejecutables por `authenticated` (44) | Intencionado: cada una comprueba permiso y MFA o solo devuelve datos públicos (DECISIONS §20, §35) |
| `storefront_availability` ejecutable por `anon`                   | Intencionado: solo devuelve el estado de disponibilidad                                            |
| Tablas de `internal` y `private` con RLS sin políticas (11)       | Intencionado: no hay acceso directo; solo funciones                                                |
| Protección de contraseñas filtradas desactivada                   | Pendiente: activarla en Supabase Auth (puede requerir plan de pago)                                |

## Pendiente

- Protección de la rama `main` en GitHub: PR obligatoria y `CI`, `Database` y `E2E` en verde. Solo puede hacerlo el titular del repositorio.
- MFA del administrador de la tienda (primer acceso).
- Proyecto `adhara-prod` separado antes de abrir la web al público; hoy Production usa `adhara-dev` (DECISIONS §43).
- URLs y plantillas de Auth para invitaciones y recuperación por email (supabase/README.md).
