# Abrir la venta online — semana del 26/10/2026

A petición del usuario (23/10): el banco ya ha dado el TPV virtual y la venta online se quiere abrir la semana que viene. Esta lista sustituye a «Pendientes para activar ventas» de [PLAN_PEDIDOS_WEB.md](PLAN_PEDIDOS_WEB.md) y recoge lo comprobado el 23/10. Decisiones en [DECISIONS.md](DECISIONS.md) §164–165.

El código del checkout, el pago con Redsys, los correos y las devoluciones está hecho y probado con un banco simulado (P03–P07). Falta sobre todo configuración y la prueba con el banco.

## Comprobado el 23/10 (solo lectura)

| Qué                               | Estado                                                                                                                                                                                | Consecuencia                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variables de Production en Vercel | Solo `SUPABASE_SECRET_KEY` y las dos públicas de Supabase. Faltan `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `REDSYS_*`, `WEB_CHECKOUT` (y `ANTHROPIC_API_KEY`, ajena a la venta) | Sin `CRON_SECRET` las tareas programadas responden 503: **las reservas sin pagar no caducan nunca**, los correos no salen y no hay copia diaria            |
| Plan de Supabase                  | Gratuito                                                                                                                                                                              | Sin copias de la plataforma; con lo anterior, hoy no hay ninguna copia. Recomendado Pro: copias diarias, sin pausa por inactividad y contraseñas filtradas |
| Correo de los pedidos             | Sin configurar                                                                                                                                                                        | La confirmación con las condiciones (soporte duradero, §138) es obligatoria al vender                                                                      |
| Tarifas de envío                  | Ninguna guardada                                                                                                                                                                      | Solo se podría recoger en la tienda                                                                                                                        |
| Administradora de la tienda       | Sin verificación en dos pasos                                                                                                                                                         | No puede entrar al panel a preparar pedidos                                                                                                                |
| Email y teléfono de la tienda     | Vacíos en Configuración                                                                                                                                                               | No salen en el aviso legal ni en las condiciones                                                                                                           |
| Pedidos en `atelier-dev`          | Ninguno                                                                                                                                                                               | La prueba del 17/10 con el comercio público de Redsys (rama `claude/exciting-brown-j08p6y`) no se llegó a hacer; sus variables de Preview siguen en Vercel |
| URL de la notificación del banco  | `https://latelierdudesert.com/api/pagos/redsys` acepta POST (503 sin TPV); `www` redirige (308) al dominio sin `www`                                                                  | Correcto: sin `NEXT_PUBLIC_SITE_URL`, el servidor usa el dominio sin `www`. No hay que definir esa variable en Production                                  |
| Protección de despliegues         | Sin Vercel Authentication ni contraseña                                                                                                                                               | El banco puede avisar a una Preview                                                                                                                        |
| Firewall de Vercel                | Sin reglas                                                                                                                                                                            | Solo frenan los límites de la aplicación (§160)                                                                                                            |

**Hecho después, el 23/10:** `CRON_SECRET` en Production (las tareas programadas ya responden 401 sin la clave, no 503) y Supabase en el plan Pro. Falta activar en Auth la protección de contraseñas filtradas: el asesor de seguridad aún la marca.

## Datos del TPV

- **Por el chat, sí:** número de comercio (FUC, 9 cifras), número de terminal, métodos activados (tarjeta, Bizum, Google Pay, Apple Pay), si el banco activó la notificación online por HTTP y las devoluciones, y el nombre que debe salir en la página del banco.
- **Nunca por el chat ni en el repositorio:** la clave de firma SHA-256 (la de pruebas y la real) y la contraseña del portal de Redsys (Canales). El usuario las pone en Vercel → `atelier-web` → Settings → Environment Variables, como «Sensitive».
- La clave es de 32 caracteres en base64. La de pruebas va solo en Preview (`REDSYS_ENVIRONMENT=test`); la real, solo en Production (`live`). Production rechaza `test` (§161).

## 1. Prueba en una Preview (datos de pruebas del banco)

- **Rama propia** para la prueba y variables de Preview limitadas a esa rama: `WEB_CHECKOUT=1`, `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL`, `REDSYS_ENVIRONMENT=test` y `REDSYS_SECRET_KEY` (la pone el usuario). También `SUPABASE_SECRET_KEY` para esa rama, que hoy solo está en Production: sin ella la Preview no crea pedidos. Las variables de la prueba del 17/10 se borran.
- **Datos reales:** la Preview usa `atelier-dev`, la misma base que la tienda. Los pedidos de prueba quedan en ella (cancelados y devueltos) con el contacto del usuario; el primer pedido real tendrá un número posterior.
- **Recorrido** (el usuario paga en su navegador; aquí se comprueban la base y los registros de Vercel): recogida de una unidad; un primer intento que no se completa (el pedido sigue esperando pago y se puede volver a intentar); un segundo intento aceptado (pasa a «Por preparar» sin recargar a mano); en el panel de la Preview, «Cancelar y devolver el dinero» (tiene que volver la respuesta 0900 firmada). Con otro pedido, «Liberar la reserva» (§164).
- **Al terminar:** borrar las variables de Preview de la rama y revocar en Supabase la clave secreta creada para la prueba.

## 2. Configuración de Production (usuario)

1. ~~`CRON_SECRET` (valor aleatorio largo, Sensitive): caducidad de reservas, correos, copia diaria e informe.~~ Hecho el 23/10.
2. ~~Supabase Pro para `atelier-dev`, que es la base de la tienda.~~ Hecho el 23/10. Falta activar la protección de contraseñas filtradas: Authentication → Sign In / Providers → Email → «Prevent use of leaked passwords».
3. Resend: dominio de envío verificado (SPF y DKIM en el DNS de Vercel), `RESEND_API_KEY` y `EMAIL_FROM` (p. ej. `L’Atelier du Désert <pedidos@latelierdudesert.com>`).
4. TPV real: `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL`, `REDSYS_SECRET_KEY` (la real) y `REDSYS_ENVIRONMENT=live`; opcional `REDSYS_MERCHANT_NAME`.
5. Panel → Configuración → Tarifas de envío: península e Illes Balears, con precio, envío gratis desde y «Ofrecer el envío».
6. Panel → Configuración: email y teléfono de la tienda.
7. Verificación en dos pasos de la administradora de la tienda (la pide su primer acceso).
8. `WEB_CHECKOUT=1`, el último, el día de la apertura.

## 3. Textos legales

- **Faltan** (LEGAL.md): teléfono, tarifa de envío y desde cuánto es gratis, plazo de entrega y transportista, medios de pago y si hay adhesión al arbitraje de consumo. Con esos datos se rellenan `LEGAL_ENTITY` (también `shippingCost` y `freeShippingFrom`, copiados de las tarifas) y se cambia `LEGAL_UPDATED_AT`.
- **Revisión de la asesoría** antes de abrir: condiciones, envíos, privacidad y el adjunto del correo de confirmación. Que confirme también si la web debe emitir factura o ticket por pedido.

## 4. Día de la apertura

1. Migraciones del repositorio aplicadas en `atelier-dev` (al día desde el 23/10, con `20261023120000_order_release_reservation`).
2. Variables de Production completas, con `WEB_CHECKOUT=1`, y redesplegado.
3. Antes de anunciarlo: una compra real de poco importe con una tarjeta propia, el correo de confirmación recibido y su devolución desde el panel. Si algo falla, quitar `WEB_CHECKOUT` y redesplegar apaga la venta.
4. Anunciar la venta.

## Decisiones del 23/10

- **Entrega:** envío (península e Illes Balears) y recogida en Castelldefels desde el primer día.
- **Reservas:** como están: hasta 10 unidades del mismo formato por pedido y 30 minutos para pagar.
- **Código antes de abrir:** solo «Liberar la reserva» (§164).
- **Para después de abrir:** límite del Firewall de Vercel para los `POST` con `Next-Action` y `/api/pagos/redsys`, los tres arreglos de las devoluciones de la revisión de seguridad, quitar el nombre del comprador del saludo del correo, captcha en el pedido si hay abusos y la apertura a buscadores (`SEO_INDEXING`).
- **Siguen abiertas:** facturación (asesoría) y si un pago que llega sin stock se devuelve siempre (hoy, incidencia con revisión manual).
