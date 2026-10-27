# Roadmap vigente — 27/10/2026

Orden de trabajo. [STATUS.md](STATUS.md) contiene el estado verificado y sus entradas fechadas; [OPERATIONS.md](OPERATIONS.md), los pasos técnicos; [PLAN_APERTURA.md](PLAN_APERTURA.md), los pasos del banco y del negocio; [PLAN_ENVIOS.md](PLAN_ENVIOS.md), los de los transportistas. El plan original de 17 fases se conserva en `docs/source/FASE_0_ARQUITECTURA.md` y los informes de fase; su estado resumido está al final.

## Dónde estamos

- **Escaparate público** en `latelierdudesert.com` (es/ca/en), sin indexar: colección, fichas, catálogo olfativo, casas, club y textos legales en borrador.
- **Panel** para la operación de la tienda física: catálogo, precios con Ómnibus, costes y márgenes, inventario, mostrador, compras, reposición, informes, asistente, consola del titular, códigos de descuento, mensajes y envíos.
- **Venta online hecha y apagada** (`WEB_CHECKOUT`): cesta y checkout con recogida en Castelldefels o envío por peso y transportista, Redsys con tarjeta y Bizum (probados con el entorno de pruebas de BBVA el 23 y el 25/10), correos, devoluciones, Sendcloud (claves en Production y tarifas sincronizadas el 26/10), cuenta de cliente y formulario de contacto, estos dos tras sus propios interruptores.
- **Fusionadas** desde el roadmap anterior: #47 (cierre de la apertura), #50 y #51 (envíos), #48 (entornos y vigilancia) y #49 (cabeceras SEO). No queda ninguna PR de código abierta salvo la #39 (documentación de la presentación al cliente).

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
| Día de apertura | —                                                                                        | `WEB_CHECKOUT=1` y redesplegar; compra real pequeña con correo y devolución; anunciar                                                                                                    | Titular            |

**Cierre:** lista de PLAN_APERTURA completada, compra real pequeña y devolución verificadas por el titular y venta encendida con autorización. Lo más lento es el pase a producción del banco: conviene pedirlo ya.

## 2. Entornos y operación

- **Hecho (#48):** `pnpm build` comprueba el destino. Production exige la base real y rechaza Redsys `test`; Preview rechaza la base real, el correo, los crons y las copias. `/api/health?check=readiness` comprueba una lectura anónima y el workflow Availability lo vigila cada día a las 06:17 UTC.
- **Consecuencia inmediata:** `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` están compartidas entre Production y Preview, así que **todas las Previews fallan el build** hasta quitarles el destino Preview (OPERATIONS, «Completar el aislamiento remoto», paso 2). Sin ellas, la Preview arranca desconectada y sirve para revisar diseño; para probar pedidos hace falta una base aislada con datos ficticios.
- **Falta:** separar esas variables, retirar los despliegues de prueba antiguos, preparar la base aislada si se quieren Previews completas y registrar una restauración de copia de prueba.

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

## 5. Búsqueda global y filtros móviles

Buscar perfumes, casas y familias; filtros claros a 390 px y estados vacíos útiles. Aprovechar los perfiles existentes y medir el rendimiento antes de añadir un buscador externo.

**Cierre:** búsqueda y navegación por teclado, móvil y tres idiomas verificadas, sin degradación de carga ni accesibilidad.

## 6. Scent Journey

Recorrido por familias, notas y momentos con perfiles verificados, reglas explicables y enlaces a perfumes disponibles. No inventar notas ni claims. La IA no es requisito para la primera versión.

**Cierre:** recomendaciones reproducibles con fuente y respuesta útil si faltan datos.

## 7. 3D selectivo y rendimiento

Ampliar los cuatro pilotos a productos destacados con medidas reales. Pipeline GLB y presupuestos de peso y carga; Lighthouse CI en una entrega propia. Fotos reales o con derechos y alternativa accesible sin WebGL.

**Cierre:** comparación móvil y escritorio con carga bajo demanda, movimiento reducido y presupuestos comprobados.

## Pendientes que continúan

- **Revisión visual de la Fase 2** (criterio 13): `/admin/diseno`, tonos de colección, tienda y panel. Es lo único que falta para cerrarla.
- Perfiles olfativos y procedencias del resto del catálogo; proveedores reales para Reposición; decisiones de las fases R y S (PLAN_TIENDA_REPOSICION, PLAN_INFORMES).
- Envíos fuera del alcance actual: entrega en punto o taquilla para el cliente, devoluciones con etiqueta, varios bultos, coste de envío en los informes de margen y Canarias.
- Captcha en el pedido solo si hay abusos; analítica solo si se decide, sin cookies o con aviso que permita rechazar.
- Sentry como integración de errores específica: hoy hay sondas y revisión de registros, sin su SDK. No activar IA ni proveedores nuevos por anticipación.

## Estado de las fases del plan original

| #   | Fase                     | Estado                                | Qué falta                                                                                         |
| --- | ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0   | Arquitectura             | Hecha                                 | —                                                                                                 |
| 1   | Fundaciones              | Cerrada con excepciones               | Excepciones en DECISIONS §83–90                                                                   |
| 2   | Design System            | Cerrada a falta de la revisión visual | Revisión visual del titular (criterio 13)                                                         |
| 3   | Importación del catálogo | En parte                              | CSV de costes, revisión y publicación por tandas; informe de importación                          |
| 4   | Research                 | En parte                              | Perfiles con fuente del resto del catálogo (47 de los 50 publicados los tienen)                   |
| 5   | Catálogo (tienda)        | En parte                              | Colecciones editoriales, búsqueda global y objetivos de Lighthouse                                |
| 6   | Ficha y Scent Journey    | En parte                              | Scent Journey (la ficha olfativa y el JSON-LD ya existen)                                         |
| 7   | Media                    | En parte                              | Biblioteca, flujo de aprobación y derechos de las fotos                                           |
| 8   | 3D                       | En parte                              | Más perfumes, pipeline GLB y presupuestos en CI                                                   |
| 9   | Inventario               | Hecha                                 | — (las reservas del checkout llegaron con la F10)                                                 |
| 10  | Carrito y checkout       | Hecha, apagada                        | Pase a producción del TPV y `WEB_CHECKOUT=1`                                                      |
| 11  | Admin operativo          | En parte                              | Fichas de cliente (A7), promociones automáticas, WhatsApp y borradores del asistente (A6.2–A6.3)  |
| 12  | Click & Collect          | Hecha, apagada                        | Se enciende con la venta (recogida en Castelldefels)                                              |
| 13  | Homepage                 | En parte                              | Colecciones editoriales y contenido de campaña                                                    |
| 14  | Cuenta de cliente        | Hecha, apagada                        | Google, correo de Auth y `CUSTOMER_ACCOUNTS=1`                                                    |
| 15  | SEO y analítica          | Código SEO hecho, apagado             | Catálogo revisado, aprobación y `SEO_INDEXING=1`; analítica solo si se decide                     |
| 16  | QA y seguridad           | En parte                              | Firewall de Vercel y, si hay abusos, captcha (revisión del 17/10 hecha)                           |
| 17  | Producción               | En parte                              | Pase del TPV, aislamiento de Preview, restauración de prueba y despliegue revisado de migraciones |

`atelier-dev` es la base de producción aunque conserve el nombre: no se crea un `atelier-prod` vacío para cambiar la web hacia él (OPERATIONS).
