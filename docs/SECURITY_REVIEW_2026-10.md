# Revisión de seguridad antes de cobrar — 17/10/2026

A petición del usuario, mientras llegan los datos del TPV. Decisiones en [DECISIONS.md](DECISIONS.md) §158–162; reglas vigentes en [SECURITY.md](SECURITY.md).

## Alcance y método

- **Tres revisiones en paralelo, solo de lectura:** pagos y checkout (Redsys, cesta, pedidos, códigos, devoluciones y correos); base de datos (cada función `security definer` en su última versión, permisos finales, RLS de las 31 tablas públicas, Storage); y aplicación (autorización de cada página, Server Action y Route Handler, flujos de Auth, rutas públicas, XSS, cabeceras y dependencias).
- **Cada hallazgo se comprobó** siguiendo el camino desde una entrada del atacante hasta el daño, en el código y, cuando hacía falta, en `adhara-dev` con consultas de solo lectura (permisos de columna, funciones que ejecuta `anon`, permisos sin MFA, procedencias publicadas).
- **Asesor de seguridad de Supabase (`adhara-dev`):** sin avisos nuevos. Las funciones que ejecuta `anon` son las tres públicas por diseño (`newsletter_subscribe`, `storefront_availability`, `track_product_event`); las `web_order_*` solo las ejecuta el servidor; sigue pendiente la protección de contraseñas filtradas.
- **`pnpm audit --prod`:** marcaba Next.js 16.3.6 y `source-map-js` 1.2.1; corregido (§162).

## Arreglado en esta entrega

| Gravedad   | Hallazgo                                                                                                                                                                                                                | Arreglo                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Alta       | Cualquiera podía crear pedidos sin pagar en bucle y dejar el stock reservado (también para la tienda física); el freno previsto en el Firewall por ruta no cubría las Server Actions, que responden en cualquier página | Freno por cliente en `placeOrder`, `applyDiscountCode` y `retryPayment`; caducidad hasta vaciar la cola (§160) |
| Media      | La API pública daba `products.source_ref`: 47 de 50 publicados nombraban al proveedor y las unidades compradas                                                                                                          | Tabla `product_sources` solo para el personal (§158)                                                           |
| Media      | Con solo la contraseña de alguien del equipo (sin MFA), la API directa daba los datos de los clientes                                                                                                                   | MFA en todos los permisos, también los de lectura (§159)                                                       |
| Media      | Con `REDSYS_ENVIRONMENT=test` en producción, la tarjeta de pruebas pública daba pedidos pagados                                                                                                                         | Configuración `test` rechazada en producción (§161)                                                            |
| Media      | Next.js 16.3.6: SSRF en la optimización de imágenes, fuga de draft mode y envenenamiento de caché                                                                                                                       | Next.js 16.3.8 (§162)                                                                                          |
| Baja–media | Con el alta pública, el rol del personal podía acabar en una cuenta abierta antes por otra persona con ese email                                                                                                        | Rol solo para cuentas confirmadas; la invitación no reutiliza un alta sin confirmar (§162)                     |
| Baja       | `setPassword` no comprobaba el segundo factor por sí misma (solo su página)                                                                                                                                             | `requireStaffPasswordStep` en la página y en la acción (§162)                                                  |
| Baja       | Sin HSTS explícito ni CSP                                                                                                                                                                                               | HSTS y CSP mínima (`frame-ancestors`, `object-src`, `base-uri`) (§162)                                         |
| Baja       | Los códigos de descuento se podían probar sin límite                                                                                                                                                                    | Mismo freno que el pedido (§160)                                                                               |

## Pendiente antes de encender la venta online

- **Aplicar las migraciones** `20261016120000_customer_accounts.sql` y `20261017120000_security_review.sql` en `adhara-dev`, en ese orden y justo al fusionar.
- **Probar el TPV en una Preview** con las variables `test` solo en Preview; en producción, solo `live` (§161).
- **Firewall de Vercel:** límite por IP a las peticiones `POST` con la cabecera `Next-Action` en cualquier ruta (no solo `/finalizar-compra`) y a `/api/pagos/redsys`. Complementa el freno de la aplicación ante muchas IP.
- **Captcha (Turnstile) en el pedido**, si aparecen abusos: el freno por IP no para a quien tiene muchas IP.
- **Decisiones del negocio sobre las reservas:** unidades máximas por formato en un pedido web (hoy 10), no reservar las últimas unidades de la tienda y si la reserva debe durar menos de 30 minutos.
- **Liberar a mano:** que el personal pueda cancelar un pedido sin pagar y devolver su reserva (hoy solo lo hace la caducidad). Hecho el 23/10: «Liberar la reserva» (DECISIONS §164).
- **Devoluciones** (bajo, solo personal con MFA):
  - una petición repetida con la misma clave puede mandarse dos veces al banco mientras la primera sigue sin respuesta;
  - una devolución «sin respuesta clara» o que quedó a medias no se puede resolver desde el panel (hay que mirar el portal de Redsys) y bloquea otras en ese pedido;
  - se puede marcar «enviado» un pedido con una devolución en curso.
- **Correo de confirmación:** el nombre que escribe el comprador sale en el saludo del correo de la tienda (texto escapado, sin inyección, pero sirve para suplantar). Valorar quitarlo del saludo.

## Pendiente antes de encender la cuenta de cliente

- **Comprobar en Supabase** que «Confirm email» y «Secure email change» están activos en el proyecto: los pedidos de invitado se enseñan por el email verificado de la cuenta.
- **Inicio de sesión forzado (login CSRF) en `/auth/confirm`:** el enlace abre sesión con un GET; alguien podría hacer que otra persona entre en su cuenta. Arreglo: página intermedia con un botón que hace POST.
- **Límites de Auth:** Supabase ve la IP de Vercel, no la del cliente, así que sus límites de acceso y alta son globales. Captcha en el alta y el acceso (ya previsto) y freno por IP en esas acciones.
- **Protección de contraseñas filtradas** en Supabase Auth.

## Otros, de menor prioridad

- **Auditoría:** `record_audit_event` deja a cualquier persona del equipo con MFA escribir entradas con cualquier acción; y no quedan auditados los cambios directos en `staff_members`, `brands`, `product_variants` (salvo precios), perfiles olfativos, ubicaciones ni las bajas de suscriptores. Propuesta: lista de acciones permitidas y tamaño máximo, y disparadores de auditoría en esas tablas.
- **Club:** `newsletter_subscribe` (pública por diseño) reactiva una baja con cualquier versión de consentimiento y su freno es global. Mitigación: doble confirmación en Sender (STATUS, pendiente 0).
- **Asistente:** el tope diario se puede pasar con peticiones a la vez (solo personal con `agent.use`).
- **Visitas:** `track_product_event` se puede inflar dentro de su freno (por diseño).
- **CSV de existencias:** los importes negativos salen como texto por la protección contra fórmulas (fallo funcional, no de seguridad).
- **GitHub:** proteger `main` (PR obligatoria y CI en verde), ya en «Pendiente».

## Comprobado y correcto

- **Redsys:** firma HMAC-SHA256 con la clave derivada por pedido y comparación en tiempo constante; la notificación se valida antes de usar ningún dato (comercio, terminal, tipo, moneda e importe); la base decide con el importe y la referencia guardados; duplicados, pago tardío y cobro de más van a revisión; la vuelta del navegador no confirma nada.
- **Pedidos:** el precio, el descuento, el envío y el stock salen de la base; la cesta solo guarda formatos y cantidades; la creación es idempotente; la cookie del pedido es httpOnly con un UUID aleatorio y la página no enseña datos personales.
- **Base de datos:** todas las funciones `security definer` con `search_path = ''`, la guarda de permiso antes de la primera escritura y `revoke` de `public` y `anon`; SQL dinámico solo con `%I` y una lista blanca; RLS en todas las tablas públicas.
- **Panel:** las 71 Server Actions, todas las páginas y los Route Handlers autorizan por sí mismos; la vista previa solo la enciende `catalog.edit`; las redirecciones `next` solo admiten rutas propias.
- **Salida:** el JSON-LD escapa `<`, los enlaces de la base solo admiten https, mailto y tel, los correos escapan el HTML y los CSV se protegen contra fórmulas; los costes y el contacto del cliente solo viajan con su permiso.
- **Secretos:** todo módulo con la clave privilegiada lleva `server-only` y sus usos son los permitidos; `scan:secrets` en la CI.

## Verificación

En local con Supabase en Docker, base reiniciada como en la CI:

- pgTAP 813/813 en 21 archivos (27 nuevas en `20_security_review`); tipos generados iguales; `db lint` sin errores; concurrencia correcta.
- `pnpm check`: lint, tipos, 609 unitarias (nuevas para el freno y el entorno del TPV) y build; `format:check`, `scan:secrets` y `pnpm audit --prod` sin avisos.
- E2E: ver la PR.
