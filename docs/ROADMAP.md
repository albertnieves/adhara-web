# Roadmap vigente — 29/10/2026

Orden de trabajo. [STATUS.md](STATUS.md) contiene el estado verificado y sus entradas fechadas; [OPERATIONS.md](OPERATIONS.md), los pasos técnicos; [PLAN_APERTURA.md](PLAN_APERTURA.md), los pasos del banco y del negocio; [PLAN_ENVIOS.md](PLAN_ENVIOS.md), los de los transportistas. El plan original de 17 fases se conserva en `docs/source/FASE_0_ARQUITECTURA.md` y los informes de fase; su estado resumido está al final.

## Dónde estamos

- **Escaparate público** en `latelierdudesert.com` (es/ca/en), sin indexar: colección, fichas, catálogo olfativo, casas, club y textos legales en borrador.
- **Panel** para la operación de la tienda física: catálogo, precios con Ómnibus, costes y márgenes, inventario, mostrador, compras, reposición, informes, asistente, consola del titular, códigos de descuento, mensajes y envíos.
- **Venta online hecha y apagada** (`WEB_CHECKOUT`): cesta y checkout con recogida en Castelldefels o envío por peso y transportista, Redsys con tarjeta y Bizum (probados con el entorno de pruebas de BBVA el 23 y el 25/10), correos, devoluciones, Sendcloud (claves en Production y tarifas sincronizadas el 26/10), cuenta de cliente y formulario de contacto, estos dos tras sus propios interruptores.
- **Fusionadas** desde el roadmap anterior: #47 (cierre de la apertura), #50 y #51 (envíos), #48 (entornos y vigilancia), #49 (cabeceras SEO) y #53 (sección Envíos del panel, 28/10).
- **Analítica, publicidad y feed de productos** (29/10, §179–180, [MEDICION_Y_PUBLICIDAD.md](MEDICION_Y_PUBLICIDAD.md)): hechos y apagados hasta poner los IDs; el feed sale con la venta.
- **Búsqueda global, filtros en el móvil y recorrido olfativo** (29/10, §181–182): hechos; se publican al fusionar su PR. Puntos 5 y 6 de este roadmap.

Lo que falta para vender es sobre todo configuración y trámites del titular, del banco y de la asesoría, no código.

## 1. Apertura de la venta — objetivo activo

| Bloque          | Hecho                                                                                    | Falta                                                                                                                                                                                    | Quién              |
| --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| TPV             | Tarjeta (23/10) y Bizum (25/10) con cobro, rechazo, aviso firmado y devolución 0900      | Desactivar el código `PRUEBATPV`, revisar las operaciones en el portal de pruebas, «Pasar a producción» y poner las `REDSYS_*` reales (`live`) en Production                             | Titular y BBVA     |
| Envíos          | Checkout por peso y transportista, etiquetas, recogidas, puntos y seguimiento (#50, #51) | Contrato propio con Correos con los precios de su propuesta (en curso); pesar los formatos publicados, remitente y embalaje; confirmar que aceptan perfumes (UN1266); «Ofrecer el envío» | Titular y código   |
| Textos legales  | Datos del titular, teléfono, email, medios de pago y gastos de envío automáticos         | Plazo de entrega, transportista y arbitraje; revisión de la asesoría; si la web emite factura o ticket                                                                                   | Titular y asesoría |
| Accesos         | MFA de la administradora dada de alta el 23/10                                           | MFA de la cuenta del 30/09 o retirarle el acceso                                                                                                                                         | Titular            |
| Firewall        | Reglas aprobadas el 24/10 (§168)                                                         | Crear a mano en Vercel las dos reglas de 60 peticiones por minuto (la API no pudo)                                                                                                       | Titular            |
| Limpieza        | —                                                                                        | Borrar las variables de Preview de las ramas de prueba (`claude/exciting-brown-j08p6y` y `claude/vigilant-mendel-p4mv93`) y revocar la clave secreta creada para la prueba               | Titular            |
| Día de apertura | La pregunta frecuente de la compra online cambia sola (§180)                             | `WEB_CHECKOUT=1` y redesplegar; texto de la portada en el panel; compra real pequeña con correo y devolución; anunciar                                                                   | Titular            |

**Cierre:** lista de PLAN_APERTURA completada, compra real pequeña y devolución verificadas por el titular y venta encendida con autorización. Lo más lento es el pase a producción del banco: conviene pedirlo ya.

## 2. Entornos y operación

- **Hecho (#48):** `pnpm build` comprueba el destino. Production exige la base real y rechaza Redsys `test`; Preview rechaza la base real, el correo, los crons y las copias. `/api/health?check=readiness` comprueba una lectura anónima y el workflow Availability lo vigila cada día a las 06:17 UTC.
- **Previews desconectadas desde el 28/10:** `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` quedan solo en Production y Development, así que las Preview compilan sin datos y sirven para revisar diseño; para probar pedidos hace falta una base aislada con datos ficticios. Availability pasa en `main` desde el 28/10.
- **Falta (titular):** borrar las variables de Preview de las ramas de prueba del TPV, retirar los despliegues de prueba antiguos, preparar la base aislada si se quieren Previews completas (tiene coste) y registrar una restauración de copia de prueba.

**Cierre:** una Preview completa escribe solo en su base ficticia, las URLs de pruebas antiguas ya no operan sobre datos reales, Availability pasa en `main` y hay evidencia de restauración.

## 3. Catálogo completo y SEO

- **Código SEO hecho (#49 y anteriores):** sitemap por idioma, robots, JSON-LD de producto, metadatos sociales y cabeceras `X-Robots-Tag` coherentes con `SEO_INDEXING`. Sigue apagado.
- **Catálogo (F3, F7):** 50 perfumes publicados de 458 cargados como borradores. Importar el CSV de costes desde el panel, revisar marcas y nombres marcados, fijar PVP y publicar por tandas; fotos propias o con derechos (6 publicados sin foto oficial).
- **Abrir a buscadores** cuando el catálogo publicado y los textos legales estén revisados: `SEO_INDEXING=1` solo en Production y comprobaciones de [SEO_RELEASE.md](SEO_RELEASE.md).

**Cierre:** catálogo publicado con datos y media verificados, pruebas ES/CA/EN, sitemap y datos estructurados correctos, sin indexar panel, borradores ni cuentas.

## 4. Clientes y mensajes

- **Encender lo hecho:** bandeja de mensajes y formulario de contacto (subdominio de recepción en Resend, webhook y `CONTACT_FORM=1`) y cuenta de cliente (Google, correo de Auth y `CUSTOMER_ACCOUNTS=1`).
- **Código por hacer:** fichas de cliente (A7) con pedidos, mensajes y consentimientos, exportación y borrado RGPD; promociones automáticas y códigos únicos por suscriptor.

**Cierre:** un cliente escribe, compra y consulta sus pedidos, y el personal lo ve todo en su ficha sin ver más de lo que su permiso permite.

## 5. Búsqueda global y filtros móviles — hecho (29/10, §181)

`/es/buscar` busca perfumes por nombre, casa, familia o nota en los tres idiomas, con casas y familias como resultados propios, la búsqueda en la URL y propuestas cuando no hay nada. Icono en la cabecera desde 1024 px y caja en el menú del móvil y la tableta; casas de la colección en un desplegable en el móvil; cabecera de la tableta sin solapes.

**Pendiente:** medir el peso de la página si el catálogo publicado pasa de unos cientos de perfumes.

## 6. Scent Journey — hecho (29/10, §182)

`/es/recorrido-olfativo`: tres preguntas (familias, estación y momento, notas que gustan o se evitan) y propuestas al momento con su porqué y la fuente de cada perfil, con reglas fijas y reproducibles, sin IA. Solo perfumes con ficha olfativa.

**Pendiente:** más perfiles olfativos con fuente (hoy 47 de 50 publicados) para que el recorrido cubra todo lo que se publique; una versión con IA, solo si se decide.

## 7. 3D selectivo y rendimiento

Ampliar los cuatro pilotos a productos destacados con medidas reales. Pipeline GLB y presupuestos de peso y carga; Lighthouse CI en una entrega propia. Fotos reales o con derechos y alternativa accesible sin WebGL.

**Cierre:** comparación móvil y escritorio con carga bajo demanda, movimiento reducido y presupuestos comprobados.

## Pendientes que continúan

- **Revisión visual de la Fase 2** (criterio 13): `/admin/diseno`, tonos de colección, tienda y panel. Es lo único que falta para cerrarla.
- Perfiles olfativos y procedencias del resto del catálogo; proveedores reales para Reposición; decisiones de las fases R y S (PLAN_TIENDA_REPOSICION, PLAN_INFORMES).
- Envíos fuera del alcance actual: entrega en punto o taquilla para el cliente, devoluciones con etiqueta, varios bultos, coste de envío en los informes de margen y Canarias.
- Captcha en el pedido solo si hay abusos.
- Medición y publicidad (§179–180): poner los IDs tras la revisión de la asesoría; más adelante, la API de conversiones de Meta y TikTok, un feed en catalán e inglés y el EAN de cada formato para el feed.
- Sentry como integración de errores específica: hoy hay sondas y revisión de registros, sin su SDK. No activar IA ni proveedores nuevos por anticipación.

## Estado de las fases del plan original

| #   | Fase                     | Estado                                | Qué falta                                                                                         |
| --- | ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0   | Arquitectura             | Hecha                                 | —                                                                                                 |
| 1   | Fundaciones              | Cerrada con excepciones               | Excepciones en DECISIONS §83–90                                                                   |
| 2   | Design System            | Cerrada a falta de la revisión visual | Revisión visual del titular (criterio 13)                                                         |
| 3   | Importación del catálogo | En parte                              | CSV de costes, revisión y publicación por tandas; informe de importación                          |
| 4   | Research                 | En parte                              | Perfiles con fuente del resto del catálogo (47 de los 50 publicados los tienen)                   |
| 5   | Catálogo (tienda)        | En parte                              | Colecciones editoriales y objetivos de Lighthouse (búsqueda global hecha, §181)                   |
| 6   | Ficha y Scent Journey    | Hecha                                 | — (recorrido olfativo, §182; ficha olfativa y JSON-LD ya existían)                                |
| 7   | Media                    | En parte                              | Biblioteca, flujo de aprobación y derechos de las fotos                                           |
| 8   | 3D                       | En parte                              | Más perfumes, pipeline GLB y presupuestos en CI                                                   |
| 9   | Inventario               | Hecha                                 | — (las reservas del checkout llegaron con la F10)                                                 |
| 10  | Carrito y checkout       | Hecha, apagada                        | Pase a producción del TPV y `WEB_CHECKOUT=1`                                                      |
| 11  | Admin operativo          | En parte                              | Fichas de cliente (A7), promociones automáticas, WhatsApp y borradores del asistente (A6.2–A6.3)  |
| 12  | Click & Collect          | Hecha, apagada                        | Se enciende con la venta (recogida en Castelldefels)                                              |
| 13  | Homepage                 | En parte                              | Colecciones editoriales y contenido de campaña                                                    |
| 14  | Cuenta de cliente        | Hecha, apagada                        | Google, correo de Auth y `CUSTOMER_ACCOUNTS=1`                                                    |
| 15  | SEO y analítica          | Código hecho, apagado                 | Catálogo revisado, aprobación y `SEO_INDEXING=1`; IDs de analítica y publicidad (§179)            |
| 16  | QA y seguridad           | En parte                              | Firewall de Vercel y, si hay abusos, captcha (revisión del 17/10 hecha)                           |
| 17  | Producción               | En parte                              | Pase del TPV, aislamiento de Preview, restauración de prueba y despliegue revisado de migraciones |

`atelier-dev` es la base de producción aunque conserve el nombre: no se crea un `atelier-prod` vacío para cambiar la web hacia él (OPERATIONS).
