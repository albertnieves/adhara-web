# Seguridad

Cómo se protegen el panel, los datos internos y los secretos. Estado al 02/10/2026; cada afirmación tiene una prueba o una comprobación citada.

## Roles y permisos

Fuente única: `src/modules/auth/domain/permissions.ts`. La misma matriz está sembrada en `public.role_permissions`; `tests/unit/permissions-sql.test.ts` falla si divergen y `01_staff_permissions` comprueba la tabla de verdad en SQL.

| Rol            | Quién                      | Alcance                                                                                |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `system_admin` | Administrador del sistema  | Todo: personal, configuración y control del negocio (`business.control`)               |
| `store_admin`  | Administrador de la tienda | Operación, costes, compras y reembolsos; sin personal, configuración ni control        |
| `viewer`       | Encargado                  | `inventory.view`, `orders.view`, `messages.view` y `agent.use`; sin clientes ni costes |

Sustituyen a `owner`, `manager`, `store_staff` y `content_editor` de la Fase 0 (DECISIONS §14). Los clientes no son personal: con la cuenta de cliente (F14, apagada tras `CUSTOMER_ACCOUNTS`) solo ven su ficha y sus pedidos (ver «Cuenta de cliente»).

## MFA

- Todo el personal entra con TOTP. Sin factor, `/admin/mfa` obliga a darlo de alta; con factor sin verificar en la sesión, pide el código. El panel solo se abre con sesión `aal2` (`tests/unit/admin-access.test.ts` y recorridos de `tests/integration/admin.spec.ts`).
- Todo permiso del personal exige `aal2` también en SQL (`private.current_aal()`), también los de lectura desde la revisión de seguridad del 17/10 (DECISIONS §159): con solo la contraseña, la API directa no da nada del panel (pgTAP `20`).
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
- Las tareas, los costes del negocio y las entregas del control (`/admin/control`) también viven en `internal`, solo para el titular: `business.control` con MFA **y** estar en `internal.control_owners`, una lista que solo se cambia por SQL (DECISIONS §127). Otro administrador del sistema recibe 404. La auditoría no guarda sus importes (pgTAP `09`).
- Ninguna tabla pública tiene columnas de coste (pgTAP `03`). La tienda solo recibe disponible, últimas unidades o agotado (`storefront_availability`).
- La procedencia de cada perfume (`product_sources`), que puede nombrar al proveedor, solo la lee el personal con MFA; `products` no la lleva (DECISIONS §158; pgTAP `20` y `cost-leak.spec.ts` con la clave pública).
- `tests/e2e/cost-leak.spec.ts` recorre las rutas públicas (HTML, RSC, JSON y cabeceras) buscando nombres de campos de coste y, en `e2e.yml`, el coste centinela de `tests/fixtures/test-db.sql` (987654 céntimos, también como 9.876,54 €), su proveedor y su referencia.
- El informe diario y el asistente trabajan en unidades, sin costes, importes ni nombres de proveedor (`tests/unit/assistant.test.ts`).

## Secretos y claves

| Variable                                                                             | Dónde                  | Uso                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                   | Cliente y servidor     | Públicas; la RLS protege los datos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `SUPABASE_SECRET_KEY`                                                                | Solo servidor (Vercel) | Invitaciones de Auth y borrar la cuenta de cliente de la sesión que no es del personal (`createAuthAdminClient`, §145), informe diario y copia diaria (`createJobClient`, tras `CRON_SECRET`); pedidos web (`createOrdersClient`, solo `web_order_*`: checkout, notificación del banco, caducidad, correos, resultado de las devoluciones y freno de las acciones públicas, DECISIONS §131, §136–139 y §160); mensajes (`createMessagesClient`, solo `web_contact_submit`, `web_inbound_email_record` y `web_message_emails_*`, §154) |
| `ANTHROPIC_API_KEY`, `CRON_SECRET`, `ASSISTANT_DAILY_LIMIT`                          | Solo servidor (Vercel) | Asistente y tareas programadas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `SUPABASE_BACKUPS_TOKEN` (opcional)                                                  | Solo servidor (Vercel) | Lista de copias de la plataforma en la consola; token personal limitado a «Backups: Read»                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL`, `REDSYS_SECRET_KEY`, `REDSYS_ENVIRONMENT` | Solo servidor (Vercel) | TPV virtual (P04): firma de los pagos y devoluciones y verificación de las notificaciones; `REDSYS_ENVIRONMENT` (`test`/`live`) es obligatoria                                                                                                                                                                                                                                                                                                                                                                                        |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                       | Solo servidor (Vercel) | Correos de los pedidos (P06) y respuestas de la bandeja; la clave también lee los correos recibidos (A6.1)                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `INBOUND_EMAIL_DOMAIN`, `RESEND_WEBHOOK_SECRET`, `CONTACT_FORM`                      | Solo servidor (Vercel) | Bandeja de mensajes (A6.1): subdominio de respuestas, firma del webhook de correo entrante e interruptor del formulario                                                                                                                                                                                                                                                                                                                                                                                                               |

- Los módulos con secretos importan `server-only`; el build falla si llegan al cliente.
- La clave privilegiada nunca está en el camino de renderizado de páginas ni recibe datos del navegador sin una autorización previa. Única excepción, desde P03: el checkout pasa a `web_order_create` formatos, cantidades y contacto validados con zod, y la función vuelve a validarlo todo y calcula precio, envío y stock en la base (DECISIONS §131 y §136).
- **Checkout (P03):** apagado por defecto (`WEB_CHECKOUT`); con él apagado, `/cesta` y `/finalizar-compra` responden 404 y las acciones no hacen nada. La cookie de la cesta solo guarda formatos y cantidades, nunca precios, y el servidor la vuelve a leer y validar; el formulario lleva un campo trampa y un `requestId` que hace idempotente el envío. Las tarifas de envío solo las cambia `admin_save_shipping_rate` (`settings.manage` con MFA, auditada). Las acciones públicas del checkout (crear el pedido, aplicar un código y volver a pagar) tienen un freno por cliente en la base (`web_order_rate_limit`, DECISIONS §160): una Server Action responde en cualquier página, así que una regla del Firewall por ruta no basta. Antes de encender la venta, además, un límite en el Firewall de Vercel para los `POST` con la cabecera `Next-Action` y para `/api/pagos/redsys`.
- **Pago con tarjeta (P04):** la tarjeta se teclea en la página del banco, nunca en la tienda, y no se guarda ningún dato de tarjeta. `/api/pagos/redsys` es pública por fuerza: solo registra un cobro si la firma (HMAC-SHA256 con la clave del comercio, comparada en tiempo constante), el comercio, el terminal y el tipo de operación cuadran, y la base vuelve a decidir con el importe y la referencia guardados. La vuelta del navegador nunca confirma nada. En producción solo se acepta `REDSYS_ENVIRONMENT=live`: el entorno de pruebas admite tarjetas públicas (DECISIONS §161). La página del pedido solo enseña el estado (sin datos personales) del pedido cuya cookie httpOnly tiene ese navegador; no hay búsqueda por número ni por email.
- **Devoluciones (P06):** el personal con `orders.refund` y MFA solo las pide; las da por hechas la respuesta firmada del banco, que registra el servidor. Nunca por encima de lo cobrado.
- **Correos (P06):** el contenido se compone en el servidor con los datos del pedido; todo lo que viene del cliente va escapado en el HTML. Los errores del proveedor se guardan como código, sin la respuesta (puede repetir la dirección).
- **Formulario de contacto (A6.1):** apagado por defecto (`CONTACT_FORM`); sin él, `/contacto` responde 404 y la acción no escribe nada. No hay ninguna función de mensajes para `anon`: el servidor valida y llama a `web_contact_submit` con la clave privilegiada (§154), que aplica 3 consultas por email y hora y 30 en total cada 10 minutos. Campo trampa e idempotencia por formulario. Antes de encenderlo, límite de peticiones del Firewall de Vercel para `/contacto` y `/api/correo/entrante`.
- **Correo entrante (A6.1):** `/api/correo/entrante` es pública por fuerza: comprueba la firma Svix de Resend (HMAC-SHA256 con `RESEND_WEBHOOK_SECRET`, tiempo constante, ±5 minutos) antes de leer nada y solo entonces pide el correo a la API de Resend. Un correo entra en una conversación existente solo con su clave aleatoria de 32 caracteres (en `private`, que no lee nadie), el email de la conversación como remitente y DMARC sin fallo; si no, abre otra (en spam si DMARC falla). Se guarda solo el texto: el panel nunca pinta HTML de un correo. Ni los registros ni la auditoría guardan textos ni emails de clientes.
- `.env.example` solo lleva valores públicos y nombres de variables. `pnpm scan:secrets` (en `ci.yml`) busca patrones de claves en los archivos versionados sin imprimirlas (criterio 13).
- `CRON_SECRET` se compara en tiempo constante; sin configurar, la tarea programada responde 503.
- Nunca se piden claves por chat: el usuario las configura en Vercel.
- La consola solo muestra si cada variable está configurada, nunca su valor. `pnpm scan:secrets` también busca tokens personales de Supabase (`sbp_…`).

## Cuenta de cliente (F14, apagada)

Plan en [PLAN_CUENTA_CLIENTE.md](PLAN_CUENTA_CLIENTE.md); decisiones §142–146.

- **Una sesión ya no significa «personal».** Clientes y personal comparten Supabase Auth. La base ya decidía por `has_permission` / `is_staff`, y pgTAP `18` lo comprueba con una cuenta de cliente (con aal1 y aal2): no ve en ninguna tabla pública más que un visitante, no pasa las funciones del panel y toda función ejecutable por una sesión comprueba permiso o MFA o está en la lista de públicas por diseño. El panel sigue exigiendo ficha de personal y `aal2`; una cuenta de cliente recibe 404 en `/admin`.
- **Solo lo suyo:** `customer_accounts` se lee por RLS (`user_id = auth.uid()`) y se escribe solo con `customer_save_account`, que valida cada campo. Los pedidos salen de `customer_orders` y `customer_order`: los hechos con la sesión (`orders.customer_id`, que el servidor fija tras `getUser()`) y los de invitado con el mismo email, **solo si la cuenta lo tiene verificado** (`email_confirmed_at`). Sin identificadores internos, cobros ni cronología; un pedido ajeno y uno inexistente responden igual (404).
- **Mensajes que no enumeran cuentas:** el alta responde «revisa tu correo» exista o no el email; la recuperación, igual; el acceso dice «email o contraseña incorrectos» en ambos casos.
- **Redirecciones cerradas:** `next` solo admite rutas de la cuenta o del checkout de esta tienda (`safeNextPath`, sin `//`, `..`, consulta ni fragmento); de los correos se toma solo la ruta del `RedirectTo`.
- **Google:** OAuth con PKCE; el verificador va en una cookie y `/auth/callback` cambia el código por la sesión. Sin el interruptor, `/auth/callback` responde 404 y el alta (`type=email`) no se confirma.
- **Personal en la tienda:** puede entrar con su cuenta, pero no borrarla desde la tienda ni cambiar la contraseña sin el segundo factor: la recuperación y la página de nueva contraseña lo mandan a `/admin/contrasena`. Cerrar sesión en la tienda es solo local (no saca al personal del panel en otros dispositivos).
- **Borrar la cuenta:** tras `getUser()` y comprobar que no es del personal, la clave privilegiada borra el usuario de Auth (§145). Se borra la ficha; los pedidos se conservan sin vínculo.
- **Antibots:** campo trampa, confirmación del email y límites de Supabase. **Pendiente antes de encender:** captcha (Turnstile) en el alta y el acceso y la protección de contraseñas filtradas.

## Cabeceras e indexación

`next.config.ts` añade a todas las respuestas `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` sin cámara, micrófono ni geolocalización y `X-Robots-Tag: noindex, nofollow`, HSTS (`max-age=63072000; includeSubDomains`) y una CSP mínima (`frame-ancestors 'none'; object-src 'none'; base-uri 'self'`; DECISIONS §162); sin `X-Powered-By`. `/admin` lleva además `Cache-Control: private, no-store`. `robots.txt` lo prohíbe todo mientras se desarrolla. Comprobado en `tests/e2e/setup.spec.ts` y `admin-auth.spec.ts` (criterio 16).

## Auditoría y solo inserción

Las acciones sensibles (personal, precios, costes, stock, compras, contenido) quedan en `audit_log` con actor, acción y cambios; los costes se anotan sin importes. `audit_log`, movimientos, ventas de mostrador, recepciones, historiales de PVP y de costes, revisiones de contenido y uso del asistente rechazan `UPDATE` y `DELETE` para todos los roles (pgTAP `07`).

## Asistente

Herramientas de solo lectura con la sesión y los permisos de quien pregunta; ninguna escribe ni usa la clave privilegiada (prueba unitaria). Tope diario por persona, hasta 8 vueltas por pregunta, 60 s por petición y registro de uso de solo inserción. La consulta comprueba el origen de la petición.

## Consola del titular

- **Copias** (DECISIONS §128): bucket privado `system-backups` que solo el titular puede leer (política de Storage); la tarea diaria escribe con la clave privilegiada tras `CRON_SECRET`; la exportación usa una lista blanca de tablas con nombres citados (`%I`), nunca el texto recibido. Las copias contienen costes y proveedores: se descargan con enlace firmado de 60 s o con la sesión, siempre `private, no-store`. Restaurar solo en local con el script; en remoto lo decide el titular.
- **Visitas** (DECISIONS §129): `track_product_event` es la única función de escritura que puede llamar `anon`; solo suma contadores de perfumes publicados, no devuelve nada que revele si existen y tiene un freno global de 1200 eventos por minuto. No se guarda IP, agente de usuario, cookies ni identificadores; GPC y «No rastrear» se respetan.
- **Copias de la plataforma:** el token se usa solo en servidor, con 5 s de espera, y nunca se registra ni se muestra.

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
