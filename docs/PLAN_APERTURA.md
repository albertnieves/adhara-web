# Abrir la venta online — semana del 26/10/2026

**Operación, 25/10:** la rama `codex/entornos-operacion` parte de la #47. Su nuevo build rechaza conectar una Preview a la base real; completar la prueba antigua de Bizum y después el aislamiento de [OPERATIONS.md](OPERATIONS.md). No retiró variables ni claves remotas. La #47 sigue abierta. Esta lista conserva los pasos del banco y negocio; STATUS contiene el estado vigente.

A petición del usuario (23/10): el banco ya ha dado el TPV virtual y la venta online se quiere abrir la semana que viene. Esta lista sustituye a «Pendientes para activar ventas» de [PLAN_PEDIDOS_WEB.md](PLAN_PEDIDOS_WEB.md) y recoge lo comprobado el 23/10. Decisiones en [DECISIONS.md](DECISIONS.md) §164–165.

El código del checkout, el pago con Redsys, los correos y las devoluciones está hecho y probado con un banco simulado (P03–P07). Falta sobre todo configuración y la prueba con el banco.

**Actualizado el 24/10** (rama `claude/cierre-apertura`, §168): el código que quedaba para después de abrir está hecho (los tres arreglos de las devoluciones, el saludo del correo sin el nombre, el freno del formulario de contacto y los gastos de envío de los textos con las tarifas del panel). Lo que queda es del usuario o del banco: Bizum por debajo de 5 €, el pase a producción del TPV, «Ofrecer el envío», la MFA de la segunda administradora, las dos reglas del Firewall en el panel de Vercel, plazo y transportista, la asesoría y `WEB_CHECKOUT=1`. La migración nueva ya está aplicada en `atelier-dev`.

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

**Hecho después, el 23/10:** `CRON_SECRET` en Production (las tareas programadas ya responden 401 sin la clave, no 503) y Supabase en el plan Pro. Más tarde, `RESEND_API_KEY` y `EMAIL_FROM` en Production (visto solo el nombre, §167). Falta activar en Auth la protección de contraseñas filtradas: el asesor de seguridad aún la marca.

## Datos del TPV (correo de BBVA del 23/10, §167)

- **Comercio:** L'ATELIER DU DESERT, número de comercio (FUC) `370787319`, terminal `001`. Integración por redirección, la que tiene la web (P04). BBVA pide probar cobros con **tarjeta y con Bizum** antes del pase a producción.
- **Portal de pruebas:** https://sis-t.redsys.es:25443/portalBBVA (usuario: el FUC; la contraseña inicial del correo se cambia al entrar). **Portal real:** https://canales.redsys.es/admincanales-web/index.jsp#/login, con los datos del correo que llega tras el pase.
- **Clave de pruebas:** es la genérica y pública del entorno de pruebas de Redsys (la misma de su documentación y de `tests/unit/redsys.test.ts`), no una propia del comercio. La real llega con el pase a producción y es distinta.
- **Moneda:** el correo dice «null» para el terminal de pruebas. La web siempre manda 978 (euro); si la página del banco da un error de moneda, ticket al soporte para que pongan EUR.
- **Bizum sin código nuevo:** la web no manda `DS_MERCHANT_PAYMETHODS`, así que la página del banco debe ofrecer los métodos activados en el terminal. Bizum estándar usa el mismo tipo de operación (0), la misma notificación firmada y la misma devolución REST (tipo 3) que la tarjeta (manual de Bizum de BBVA, v1.6). No se usan el doble flujo ni la API REST de Bizum. Si Bizum no aparece en la página del banco, es que el terminal no lo tiene activado: ticket al soporte.
- **Soporte del TPV:** tickets desde el portal (icono «Soporte»; categoría «Paso a producción» para el pase) o teléfono 912 983 609, 24 h.
- **Por el chat, sí:** número de comercio, terminal, métodos activados y el nombre que debe salir en la página del banco. **Nunca por el chat ni en el repositorio:** la clave real y la contraseña del portal. El usuario pone la clave en Vercel → `atelier-web` → Settings → Environment Variables, como «Sensitive»: la de pruebas solo en Preview (`REDSYS_ENVIRONMENT=test`); la real, solo en Production (`live`). Production rechaza `test` (§161).

## 1. Prueba en una Preview (datos de pruebas del banco)

- **Rama:** `claude/vigilant-mendel-p4mv93` (la de los textos de Bizum, §167). Variables de Preview limitadas a esa rama: `WEB_CHECKOUT=1`, `REDSYS_MERCHANT_CODE=370787319`, `REDSYS_TERMINAL=001`, `REDSYS_ENVIRONMENT=test`, `REDSYS_SECRET_KEY` (la de pruebas del correo, Sensitive) y `SUPABASE_SECRET_KEY` (una clave nueva solo para la prueba; sin ella la Preview no crea pedidos). Con todas puestas, **volver a desplegar** la Preview: `WEB_CHECKOUT` se lee al generar las páginas.
- **Antes de pagar:** en el portal de pruebas, comprobar en el terminal 001 la notificación online por HTTP, Bizum, las devoluciones y la moneda.
- **Datos reales:** la Preview usa `atelier-dev`, la misma base que la tienda. Los pedidos de prueba quedan en ella (cancelados y devueltos) con el contacto del usuario; el primer pedido real tendrá un número posterior. La Preview no tiene el correo: la confirmación queda en la cola de la base y la manda la tarea programada de Production, así que también se prueba el correo.
- **Recorrido** (el usuario paga en su navegador; aquí se comprueban la base y los registros de Vercel):
  - **Tarjeta** (4548 8100 0000 0003, la de pruebas de Redsys): recogida de una unidad; un primer intento que no se completa (el pedido sigue esperando pago y se puede volver a intentar); un segundo intento aceptado (pasa a «Por preparar» sin recargar a mano); en el panel de la Preview, «Cancelar y devolver el dinero» (tiene que volver la respuesta 0900 firmada).
  - **Bizum** (datos del manual de BBVA), con otro pedido: primero `ko@ko.ko`, rechazado (el pedido sigue esperando pago); al volver a intentarlo, el móvil 700000000, aceptado. Después, la devolución de ese cobro desde el panel.
  - Con otro pedido, «Liberar la reserva» (§164).
  - En el portal de pruebas, que se ven los cobros y las devoluciones.
- **Resultado del 23/10** (pedidos 1001–1003 en `atelier-dev`, recogida en tienda):
  - **Tarjeta, correcto:** el 1001, con un primer intento sin completar y el reintento aceptado, pasó solo a «Pagado» 37 s después; la confirmación la mandó la tarea programada de Production (Resend funciona). «Cancelar y devolver el dinero» desde el panel de la Preview: 0900 firmado en menos de un segundo, pedido cancelado y unidad de vuelta al stock.
  - **Tarjeta denegada, correcto:** el 1002 recibió la notificación firmada (`Ds_Response` 9673) y siguió esperando el pago, sin cobro.
  - **Liberar la reserva, correcto:** en el 1002 y el 1003.
  - **Bizum, el 23/10:** aparece en la página del banco (activado en el terminal), pero con 32,90 € se denegó (pedido 1003, sin aviso del banco). El manual de BBVA solo da por buenos en pruebas los importes de menos de 5 €.
  - **Bizum, correcto el 25/10** (código `PRUEBATPV` del 90 %, creado por el usuario solo para la prueba; 3,29 €, recogida): el 1004, rechazado, recibió el aviso firmado («no completado») y siguió esperando el pago; el 1005, aceptado, pasó solo a «Pagado» 14 s después de ir al banco, con el aviso firmado por el importe exacto; «Cancelar y devolver el dinero» desde el panel de la Preview: 0900 en menos de un segundo, pedido cancelado y unidad de vuelta al stock; la confirmación la mandó la tarea de correos de Production. Bizum usa la misma notificación y la misma devolución que la tarjeta, como decía el manual (§167). El 1004 conserva su reserva hasta que caduque sola (30 minutos).
- **Al terminar:** desactivar el código `PRUEBATPV` (no tiene fecha de fin ni límite de usos), comprobar en el portal de pruebas que salen los cobros y las devoluciones, borrar las variables de Preview de esta rama (y las que quedan de la prueba del 17/10, rama `claude/exciting-brown-j08p6y`) y revocar en Supabase la clave secreta creada para la prueba.
- **Pase a producción:** con la prueba bien, botón **«Pasar a producción»** en el portal de pruebas. BBVA manda otro correo con los datos del entorno real (portal y clave real). Hacerlo cuanto antes: no se sabe cuánto tarda.

## 2. Configuración de Production (usuario)

1. ~~`CRON_SECRET` (valor aleatorio largo, Sensitive): caducidad de reservas, correos, copia diaria e informe.~~ Hecho el 23/10.
2. ~~Supabase Pro para `atelier-dev`, que es la base de la tienda.~~ Hecho el 23/10, también la protección de contraseñas filtradas (el asesor de seguridad ya no la marca).
3. Resend: dominio de envío verificado (SPF y DKIM en el DNS de Vercel), `RESEND_API_KEY` y `EMAIL_FROM` (p. ej. `L’Atelier du Désert <pedidos@latelierdudesert.com>`). Hecho el 23/10: la confirmación del pedido de prueba 1001 salió por Resend desde Production.
4. TPV real, cuando llegue el correo del pase a producción: `REDSYS_MERCHANT_CODE=370787319`, `REDSYS_TERMINAL=001` (o el que diga ese correo), `REDSYS_SECRET_KEY` (la real) y `REDSYS_ENVIRONMENT=live`; opcional `REDSYS_MERCHANT_NAME`.
5. Panel → Configuración → Tarifas de envío: guardadas el 23/10 (península 4,00 €, gratis desde 60 €; Illes Balears 10,00 €, gratis desde 120 €), pero sin «Ofrecer el envío»: hoy solo se podría recoger en la tienda.
   **Con la rama de envíos (25/10, §171–176, [PLAN_ENVIOS.md](PLAN_ENVIOS.md)):** el precio plano desaparece; el envío se cobra por peso y transportista. Antes de «Ofrecer el envío» hacen falta el remitente y el embalaje (Configuración → Envíos), el peso de los formatos publicados (Catálogo → Pesos de envío) y al menos un servicio activo con sus tramos: uno manual con el contrato propio o los de Sendcloud con sus claves. El envío gratis desde 60 € y 120 € se conserva por zona.
6. ~~Panel → Configuración: email y teléfono de la tienda.~~ Puestos el 23/10.
7. Verificación en dos pasos de las dos personas con rol de administración de la tienda. El 24/10: la cuenta dada de alta el 23/10 ya la tiene y ha entrado; la del 30/09 no ha entrado nunca y no la tiene (la pide su primer acceso al panel). Si esa cuenta ya no se usa, retirarle el acceso en Panel → Equipo.
8. Firewall de Vercel (aprobado el 24/10; la API no lo pudo crear, §168): Vercel → `atelier-web` → Firewall → «New rule», dos reglas con la acción «Rate Limit», ventana fija de 60 segundos, 60 peticiones, por IP y respuesta 429:
   - «Tienda: freno de acciones»: Request Method = `POST`, Header `next-action` existe y Request Path no empieza por `/admin`.
   - «Pagos: aviso del banco»: Request Path = `/api/pagos/redsys` y Request Method = `POST`.

   Publicar los cambios del Firewall. Se quitan en un clic si algo va mal.

9. Borrar las variables de Preview de las pruebas (las de la rama `claude/exciting-brown-j08p6y`, del 17/10, y las de `claude/vigilant-mendel-p4mv93` al acabar Bizum) y revocar en Supabase la clave secreta creada para la prueba.
10. `WEB_CHECKOUT=1`, el último, el día de la apertura.

## 3. Textos legales

- **Faltan** (LEGAL.md): plazo de entrega y transportista y si hay adhesión al arbitraje de consumo. Con esos datos se rellena `LEGAL_ENTITY` y se cambia `LEGAL_UPDATED_AT`. Ya están: el teléfono y el email (panel, 23/10), los medios de pago (tarjeta bancaria y Bizum, §167) y los gastos de envío, que desde el 24/10 salen solos de las tarifas activas del panel y aparecen al encender «Ofrecer el envío» (§168).
- **Revisión de la asesoría** antes de abrir: condiciones, envíos, privacidad y el adjunto del correo de confirmación. Que confirme también si la web debe emitir factura o ticket por pedido.

## 4. Día de la apertura

1. Fusionada la PR #47 (`claude/cierre-apertura`, lleva dentro la de Bizum, `claude/vigilant-mendel-p4mv93`). Su migración `20261024120000_refund_safeguards` ya está aplicada en `atelier-dev` desde el 24/10: las migraciones están al día.
2. Variables de Production completas, con `WEB_CHECKOUT=1`, y redesplegado. Con la venta encendida, la pregunta frecuente «¿Puedo comprar online?» ya responde que sí (§180), pero **el texto de la portada** («Ven a descubrir las fragancias en persona. La compra online llegará muy pronto.», en es y ca) es contenido del panel: cambiarlo en Panel → Contenido → Portada y publicar.
3. Antes de anunciarlo: una compra real de poco importe con una tarjeta propia, el correo de confirmación recibido y su devolución desde el panel. Si algo falla, quitar `WEB_CHECKOUT` y redesplegar apaga la venta.
4. Anunciar la venta.
5. Opcional, para vender más ([MEDICION_Y_PUBLICIDAD.md](MEDICION_Y_PUBLICIDAD.md), §179–180): dar de alta el feed `https://latelierdudesert.com/feeds/productos.xml` en Google Merchant Center (fichas gratuitas en Google Shopping) y en el catálogo de Meta, y, tras la revisión de la asesoría, poner los IDs de Analytics, Google Ads, Meta o TikTok en Production.

## Decisiones del 23/10

- **Entrega:** envío (península e Illes Balears) y recogida en Castelldefels desde el primer día.
- **Reservas:** como están: hasta 10 unidades del mismo formato por pedido y 30 minutos para pagar.
- **Código antes de abrir:** solo «Liberar la reserva» (§164). El 24/10, a petición del usuario, también los tres arreglos de las devoluciones y el saludo del correo sin el nombre (§168).
- **Para después de abrir:** límite del Firewall de Vercel para los `POST` con `Next-Action` y `/api/pagos/redsys`, captcha en el pedido si hay abusos y la apertura a buscadores (`SEO_INDEXING`).
- **Siguen abiertas:** facturación (asesoría) y si un pago que llega sin stock se devuelve siempre (hoy, incidencia con revisión manual).
