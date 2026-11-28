# Abrir la venta online — semana del 26/10/2026

## Plan de cierre para abrir el lunes 30/11 (revisión del 27/11)

A petición del usuario (27/11): revisar a fondo qué falta antes de abrir la tienda y un plan para cerrarlo antes del lunes. Hoy es viernes: **es el único día laborable antes del lunes**, así que lo que depende del banco, de Correos o de la asesoría se pide hoy. Lo de abajo de esta sección (21/11 y anteriores) sigue valiendo como detalle de cada paso.

### Comprobado hoy (solo lectura: `atelier-dev`, Vercel `atelier-web` y `latelierdudesert.com`)

| Qué                | Estado el 27/11                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production         | Despliegue de la PR #69 (21/11), `READY`; sin errores de ejecución en 7 días. Venta en pruebas encendida (`WEB_CHECKOUT=1`, `WEB_CHECKOUT_TEST=1`, `REDSYS_ENVIRONMENT=test`).                                                                                                                                                                     |
| Tareas programadas | Funcionan: copia diaria hasta el 27/11, informe diario hasta el 26/11, correos de pedidos enviados (2).                                                                                                                                                                                                                                            |
| Pedidos            | 1001 y 1005 cancelados y devueltos (pruebas de octubre). 1002, 1003, 1004 y **1006** (21/11, 02:03 UTC, recogida, 29,90 €) siguen «esperando pago» con la reserva liberada: **el 1006 nunca recibió aviso del banco**, así que la prueba del 21/11 con la tarjeta de pruebas no se completó.                                                       |
| Pesos              | **0 de 50** formatos publicados con peso (tamaños 20, 100, 105, 150, 200 ml y uno sin tamaño). Sin pesos solo se ofrece la recogida.                                                                                                                                                                                                               |
| Envíos             | Correos Paq Estándar activo solo en la península, gratis desde 60 €; Baleares apagada. Peso máximo 1 kg y tramos de Correos sincronizados solo hasta 1 kg. Caja guardada de **30 × 30 × 30 cm** (peso volumétrico de unos 4,5–5,4 kg: encarece la etiqueta real). 0 etiquetas creadas.                                                             |
| Textos legales     | «Envíos y devoluciones» publica «Enviamos a la España peninsular y las Illes Balears», pero Baleares está apagada: **el texto promete una zona que el checkout no ofrece.** Falta el arbitraje de consumo y la revisión de la asesoría.                                                                                                            |
| Accesos            | Las dos cuentas activas (administración del sistema y de la tienda) tienen MFA; la del 30/09 sin MFA está dada de baja. Hecho.                                                                                                                                                                                                                     |
| Dependencias       | `pnpm audit --prod`: **7 avisos moderados de Next.js 16.4.4** (eran 2 el 21/11), todos corregidos en 16.4.5. Casi todos son de `'use cache'`/Cache Components, que la web no usa; el de SVG en la optimización de imágenes y el de cookies en rutas Edge tienen poca exposición aquí.                                                              |
| Secretos en Vercel | Siguen en Production las variables de la integración de Supabase que el código no usa (`POSTGRES_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`…). Siguen las de Preview de `claude/exciting-brown-j08p6y` y `claude/vigilant-mendel-p4mv93`, esta con un `SUPABASE_SECRET_KEY` (clave privilegiada de la base real). |
| Firewall de Vercel | No se puede leer con el conector (sin permiso): comprobarlo a mano.                                                                                                                                                                                                                                                                                |
| Buscadores         | `robots.txt` con `Disallow: /` y `noindex` (`SEO_INDEXING` sin poner). El feed de Google/Meta sale vacío: las 75 fotos publicadas son oficiales de marca «provisionales», que el feed no admite.                                                                                                                                                   |
| Catálogo           | 50 publicados, 44 con unidades (332 en total), 6 agotados (van al final). 0 costes de compra cargados; la tabla de trabajo `internal._inv_20261113` sigue.                                                                                                                                                                                         |
| Asesor de Supabase | Los mismos tipos de aviso de siempre (funciones `security definer` ejecutables y RLS sin política en tablas internas): nada nuevo.                                                                                                                                                                                                                 |

### Qué es «abrir» el lunes

- **Con la clave real de BBVA** (pase a producción concedido): venta real. Es el único camino para cobrar.
- **Sin la clave real:** la web sigue en venta en pruebas, sin cobro. Se puede enseñar, pero **no anunciar** ni aceptar pedidos de clientes: no hay cobro y el pedido no se prepara.

El camino crítico es el banco: ninguna tarea de código lo acorta.

### Viernes 27 (hoy, día laborable)

| #   | Tarea                                                                                                                                                                                                                                                                                                                      | Quién   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| V1  | **BBVA:** contestar en su hilo que la web está completa y pedir el pase a producción (portal de pruebas → «Pasar a producción» o ticket «Paso a producción», 912 983 609, 24 h). Si ya se pidió, preguntar el plazo.                                                                                                       | Titular |
| V2  | **Pedido de prueba completo en Production** con la tarjeta 4548 8100 0000 0003 (el 1006 se quedó sin pagar): que pase solo a «Pagado», llegue el correo y «Cancelar y devolver el dinero» dé 0900. Es lo que el banco quiere ver y comprueba el pago de punta a punta.                                                     | Titular |
| V3  | **Correos:** pedir por escrito que admite perfumes con alcohol (UN1266, clase 3, cantidades limitadas) en Paq Estándar por carretera. Sin esa confirmación no sale ningún paquete.                                                                                                                                         | Titular |
| V4  | **Asesoría:** enviar condiciones, envíos, privacidad y el adjunto del correo de confirmación; preguntar si cada pedido necesita factura o ticket y si conviene el arbitraje de consumo (Junta Arbitral de Consum de Catalunya).                                                                                            | Titular |
| V5  | **Hecho en la rama el 27/11 (§200), falta la CI y fusionar.** **Next.js 16.4.5** en una PR aparte (con `next-intl` si lo pide), con la CI completa (`ci.yml`, `db.yml`, `e2e.yml` con Lighthouse) en verde antes de fusionar.                                                                                              | Código  |
| V6  | **Hecho en la rama el 27/11 (§200), falta la CI y fusionar.** **Zonas del texto legal según las zonas activas:** que «Enviamos a…» diga solo la península mientras Baleares esté apagada (sale de `shipping_rates`, como ya hacen los gastos, §168), en es, ca y en, con su prueba unitaria. Misma PR que V5 o una propia. | Código  |

### Sábado 28 y domingo 29

| #   | Tarea                                                                                                                                                                                                                                                                                             | Quién                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| S1  | **Pesar los formatos** (Panel → Envíos → Pesos de los formatos): un frasco con su caja de cada tamaño, «Rellenar los vacíos por tamaño», revisar y guardar. Sin esto no hay envío a domicilio.                                                                                                    | Titular                           |
| S2  | **Caja y peso máximo** (Envíos → Remitente y zonas): medir la caja real de envío y guardar sus medidas (no 30 × 30 × 30), comprobar el embalaje (200 g), subir «Peso máximo con envío» a 5 kg y pulsar «Actualizar tarifas desde Sendcloud» para traer los tramos de más de 1 kg.                 | Titular                           |
| S3  | **Comprobar el checkout** en `latelierdudesert.com` con un perfume pesado: código postal de la península → «Correos · Paq Estándar» con su precio; uno de Baleares → solo recogida; dos frascos de 100 ml siguen teniendo envío.                                                                  | Titular o código                  |
| S4  | **Firewall de Vercel:** las dos reglas de 60 peticiones por minuto (paso 8 de «Configuración de Production», abajo) y publicarlas.                                                                                                                                                                | Titular                           |
| S5  | **Limpieza de secretos:** desconectar la integración de Supabase en Vercel (o borrar sus variables de Production); borrar las variables de Preview de las dos ramas de prueba; **revocar en Supabase la clave secreta creada para la prueba de octubre** (la de la Preview de `vigilant-mendel`). | Titular (o código con su permiso) |
| S6  | **GitHub:** proteger `main` (PR obligatoria y `CI`, `Database` y `E2E` en verde).                                                                                                                                                                                                                 | Titular                           |
| S7  | Fusionar V5–V6 con la CI en verde; comprobar en producción portada, ficha, cesta, pago de prueba y «Envíos y devoluciones».                                                                                                                                                                       | Código                            |

### Lunes 30

**Si ha llegado la clave real:**

1. Vercel → `atelier-web` → Production: `REDSYS_SECRET_KEY` real («Sensitive»), `REDSYS_ENVIRONMENT=live` y **quitar `WEB_CHECKOUT_TEST`** (el build falla si se queda); redesplegar.
2. Cancelar desde el panel los pedidos de prueba que queden (1002, 1003, 1004, 1006 y los de V2).
3. Compra real de poco importe con una tarjeta propia (y, si se puede, con Bizum), correo recibido y devolución desde el panel.
4. Si se decide (pregunta 3): `SEO_INDEXING=1` y redesplegar.
5. Anunciar la venta.

**Si no ha llegado:** la web se queda como está (venta en pruebas, sin anunciar); revisar Panel → Pedidos web cada día y cancelar lo que entre. Seguir con el banco.

### Criterios para anunciar la venta (todos)

- [ ] Clave real puesta, `live`, sin `WEB_CHECKOUT_TEST`, y una compra real pequeña con su devolución comprobadas.
- [ ] Envío a domicilio: formatos pesados **y** confirmación escrita de Correos. Si falta cualquiera de las dos, abrir solo con recogida en la tienda (apagar «Ofrecer el envío» en la península; los textos legales se ajustan solos).
- [ ] Textos legales sin promesas que el checkout no cumple (V6) y con el visto bueno de la asesoría, o con la decisión explícita del titular de abrir antes de tenerlo.
- [ ] Next.js 16.4.5 desplegado; Firewall con sus reglas; secretos de más retirados.

### Para después de abrir (no bloquea el lunes)

Costes de compra del 13/11 y borrar `internal._inv_20261113` (sin ellos no hay márgenes); fotos propias o con derechos para el feed de Google Merchant y Meta; IDs de analítica y publicidad tras la asesoría; Baleares cuando Correos confirme el barco; contrato propio con Correos y la primera factura (IVA del envío); envío gratis temporal (`claude/epic-fermat-o5afnx`, toca `web_order_create`); formulario de contacto y cuentas de cliente (apagados); captcha solo si hay abusos.

### Preguntas para el titular

1. ¿Se pidió ya a BBVA el pase a producción? ¿Han dicho plazo?
2. Si el lunes no hay confirmación escrita de Correos, ¿abrir solo con recogida en la tienda o esperar?
3. ¿Se abre la web a los buscadores (`SEO_INDEXING=1`) el mismo lunes, o tras la revisión de la asesoría?

**Operación, 25/10:** la rama `codex/entornos-operacion` parte de la #47. Su nuevo build rechaza conectar una Preview a la base real; completar la prueba antigua de Bizum y después el aislamiento de [OPERATIONS.md](OPERATIONS.md). No retiró variables ni claves remotas. La #47 sigue abierta. Esta lista conserva los pasos del banco y negocio; STATUS contiene el estado vigente.

A petición del usuario (23/10): el banco ya ha dado el TPV virtual y la venta online se quiere abrir la semana que viene. Esta lista sustituye a «Pendientes para activar ventas» de [PLAN_PEDIDOS_WEB.md](PLAN_PEDIDOS_WEB.md) y recoge lo comprobado el 23/10. Decisiones en [DECISIONS.md](DECISIONS.md) §164–165.

El código del checkout, el pago con Redsys, los correos y las devoluciones está hecho y probado con un banco simulado (P03–P07). Falta sobre todo configuración y la prueba con el banco.

**Actualizado el 24/10** (rama `claude/cierre-apertura`, §168): el código que quedaba para después de abrir está hecho (los tres arreglos de las devoluciones, el saludo del correo sin el nombre, el freno del formulario de contacto y los gastos de envío de los textos con las tarifas del panel). Lo que queda es del usuario o del banco: Bizum por debajo de 5 €, el pase a producción del TPV, «Ofrecer el envío», la MFA de la segunda administradora, las dos reglas del Firewall en el panel de Vercel, plazo y transportista, la asesoría y `WEB_CHECKOUT=1`. La migración nueva ya está aplicada en `atelier-dev`.

## Venta en pruebas para el banco (13/11)

El banco no concede el TPV definitivo sin ver la venta abierta. Desde el 13/11 (DECISIONS §193) la venta se puede encender en Production con el entorno de pruebas de Redsys, con un aviso al comprador. **Orden obligatorio:** primero fusionar la rama `claude/inventory-visual-improvements-co80yn` (el build anterior rechaza `test` en Production) y después las variables.

1. Vercel → `atelier-web` → Settings → Environment Variables → **Production**:
   - `WEB_CHECKOUT=1`
   - `WEB_CHECKOUT_TEST=1`
   - `REDSYS_MERCHANT_CODE=370787319`, `REDSYS_TERMINAL=001`, `REDSYS_ENVIRONMENT=test`
   - `REDSYS_SECRET_KEY`: la de pruebas del correo de BBVA, marcada «Sensitive». No se manda por el chat.
2. Redesplegar Production (las variables se leen al construir).
3. Comprobar: la cabecera enseña la cesta y Panel → Pedidos web enseña «Venta en pruebas». Desde el 21/11 la tienda **no** enseña «Tienda en pruebas» (el banco quiere ver la web definitiva, §196).
4. Un pedido con la tarjeta de pruebas 4548 8100 0000 0003: pasa solo a «Pagado»; cancelarlo con «Cancelar y devolver el dinero» (0900) para que la unidad vuelva al stock.
5. Panel: cambiar los destacados agotados (Asad, Yara y Club de Nuit Intense Man LE tienen 0 unidades) y el texto de la portada.
6. Avisar al banco y pedir el pase a producción.

**Mientras dure:** ningún pedido se prepara ni se envía (no hay cobro real) y los de prueba se cancelan cada día; casi todo el catálogo tiene una unidad. **Para apagarla:** quitar `WEB_CHECKOUT` y redesplegar. **Al llegar la clave real:** `REDSYS_SECRET_KEY` real, `REDSYS_ENVIRONMENT=live`, **quitar `WEB_CHECKOUT_TEST`** (el build falla si se queda) y redesplegar.

## Correos y lo que falta para vender con normalidad (21/11)

**Hecho el 21/11** (rama `claude/purchase-branch-mail-carrier-evkiry`, DECISIONS §196): PR #67 fusionada, así que Production se despliega con la venta en pruebas (las variables ya estaban desde el 13/11). Correos Paq Estándar encendido en la península en `atelier-dev` («Correos · Paq Estándar», 2 días, 7,50 € hasta 1 kg, gratis desde 60 €) con «Ofrecer el envío» en la península. Plazo («de 2 a 4 días laborables») y transportista (Correos) publicados en «Envíos y devoluciones». Comprobado también: `PRUEBATPV` desactivado y la cuenta de administración sin MFA, dada de baja.

**A. Para que el banco conceda el TPV definitivo (ahora)**

1. **Pesar los formatos** (titular): Panel → Envíos → Pesos de los formatos. Pesar un frasco con su caja de cada tamaño (20, 100, 105, 150 y 200 ml y los dos «Formato por confirmar»), «Rellenar los vacíos por tamaño», revisar y guardar. **Sin pesos el checkout solo ofrece la recogida en la tienda** (hoy, 0 de 50).
2. Comprobar en `latelierdudesert.com`: la cesta y el pago sin ningún aviso de pruebas; con un perfume pesado y un código postal de la península sale «Correos · Paq Estándar». Un pedido con la tarjeta de pruebas 4548 8100 0000 0003 que pase solo a «Pagado» y después «Cancelar y devolver el dinero» (0900). **Mientras dure:** revisar cada día Panel → Pedidos web y cancelar lo que entre (no hay cobro real).
3. **Contestar al banco en su mismo hilo** que la web está completa (los dos puntos de su correo están resueltos: todas las fichas con imagen y ningún texto que diga que la venta no está operativa) y pedir el pase a producción: portal de pruebas → «Pasar a producción», o ticket con la categoría «Paso a producción» (912 983 609). El banco avisa de que cancela el contrato si en 6 meses desde la solicitud no tiene la URL completa.

**B. Al llegar la clave real (el mismo día)**

4. Vercel → `atelier-web` → Production: `REDSYS_SECRET_KEY` real («Sensitive»), `REDSYS_ENVIRONMENT=live` y **quitar `WEB_CHECKOUT_TEST`**; redesplegar. El build falla si el interruptor se queda.
5. Cancelar desde el panel los pedidos de prueba que queden.
6. Una compra real de poco importe con una tarjeta propia, el correo de confirmación y su devolución desde el panel.

**C. Para enviar de verdad con Correos**

7. **Confirmación por escrito de Correos** (o de Sendcloud, si se usa su contrato) de que admite perfumes con alcohol (UN1266, clase 3, cantidades limitadas) en Paq Estándar por carretera. Su página «Cómo preparar tu envío» pone los perfumes inflamables entre lo prohibido sin distinguir nacional e internacional. Sin esa confirmación no se envía nada.
8. **Peso máximo:** subir «Peso máximo con envío» (Envíos → Remitente y zonas) de 1 kg a unos 5 kg y pulsar «Actualizar tarifas desde Sendcloud». Hoy dos frascos de 100 ml con el embalaje ya pasan de 1 kg y se quedan sin envío.
9. **Baleares:** encenderla en el servicio y en la zona solo cuando Correos confirme que lleva perfumes allí (por barco).
10. **Contrato propio con Correos:** si se firma la propuesta, conectarlo en Sendcloud (o un servicio manual con sus tramos) y comprobar la primera factura: si el coste ya incluye IVA, poner 0 % en «IVA del envío».

**D. Legal y negocio (antes de anunciar la venta)**

11. **Revisión de la asesoría:** condiciones, envíos, privacidad y el adjunto del correo de confirmación ([LEGAL.md](LEGAL.md)), más si la web debe emitir factura o ticket por pedido.
12. **Arbitraje de consumo:** decidir si se adhiere a la Junta Arbitral de Consum de Catalunya (falta en las condiciones).
13. **Costes de compra del 13/11:** cargar los 99 costes netos de los presupuestos desde la hoja (la base no los tiene) y después borrar `internal._inv_20261113`. No impide vender, pero sin ellos no hay márgenes.

**E. Limpieza y seguridad (cuando se pueda)**

14. Firewall de Vercel: las dos reglas de §168 (paso 8 de abajo), si aún no están.
15. **Secretos de más en Production:** la integración de Supabase con Vercel añadió el 26/10 variables que el código no usa (`POSTGRES_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`…; siguen el 21/11). Desconectar la integración o borrarlas.
16. **Next.js 16.4.5:** la 16.4.4 tiene dos avisos moderados (GHSA-mfr8-8qww-v76h y otro de la caché) que solo afectan a `'use cache'` y `unstable_cache`, que la web no usa. Subirla en una PR aparte con la CI completa.
17. Borrar en Vercel las variables de Preview de las pruebas antiguas (ramas `claude/exciting-brown-j08p6y` y `claude/vigilant-mendel-p4mv93`; siguen el 21/11) y revocar en Supabase la clave secreta creada para la prueba de octubre.

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
