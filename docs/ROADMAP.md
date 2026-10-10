# Roadmap

Roadmap de la Fase 0 (`docs/source/FASE_0_ARQUITECTURA.md` §17), con el estado real al 10/10/2026. El orden del documento original se mantiene (ADR-009). El panel de administración avanza en sus propias fases A0–A8 ([ADMIN_PLAN.md](ADMIN_PLAN.md)), enlazadas con estas, y por decisión del usuario se adelantaron partes visuales y operativas (DECISIONS §27 y fases R y S).

Estados: **hecha**, **cerrada con excepciones** (criterios cumplidos salvo excepciones escritas en DECISIONS), **en parte** (hay entregas, faltan criterios), **pendiente**.

| #   | Fase                     | Estado                                | Qué hay y qué falta                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Arquitectura             | Hecha                                 | Documentos en `docs/source/`. La «rev. 2» citada por el plan de la Fase 1 no se recibió (DECISIONS §4).                                                                                                                                                                                                                                  |
| 1   | Fundaciones              | Cerrada con excepciones               | 02/10/2026. Informe en [phases/FASE_1_REPORT.md](phases/FASE_1_REPORT.md); excepciones en DECISIONS §83–90.                                                                                                                                                                                                                              |
| 2   | Design System            | Cerrada a falta de la revisión visual | 04/10/2026. DS-00 a DS-12 hechas: tokens en dos capas, contraste AA, `/admin/diseno`, biblioteca común y tienda y panel migrados, con axe y objetivos de 44 px como pruebas que fallan. 12 de 13 criterios cumplidos; falta la revisión visual del usuario (criterio 13). Informe en [phases/FASE_2_REPORT.md](phases/FASE_2_REPORT.md). |
| 3   | Importación del catálogo | En parte                              | 424 perfumes del PDF y 34 de la compra cargados como borradores con procedencia; importador CSV con revisión en el panel. Falta importar el CSV de costes (usuario) y el informe de importación.                                                                                                                                         |
| 4   | Research                 | En parte                              | Perfiles olfativos de 47 de los 50 publicados, cada uno con su fuente (DECISIONS §108–111). Procedencia del resto simplificada en `source_ref` y en la media ([PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md)).                                                                                                                               |
| 5   | Catálogo (tienda)        | En parte                              | Colección con filtros en es/ca/en con ISR y catálogo olfativo con filtros por familia, estación, momento y nota. En el móvil, cuadrícula de dos columnas con vista amplia opcional (§119). Faltan páginas de marca, colecciones, búsqueda global y objetivos de Lighthouse.                                                              |
| 6   | Ficha y Scent Journey    | En parte                              | Ficha con galería o escena 3D, formatos, PVP, disponibilidad y «También de» la misma casa; ficha olfativa con pirámide, rueda de estaciones, huella y perfumes afines. Faltan el Scent Journey completo y JSON-LD.                                                                                                                       |
| 7   | Media                    | En parte                              | Imágenes por perfume con origen, fuente y marca de provisional; subida desde el panel. Faltan biblioteca, flujo de aprobación y derechos.                                                                                                                                                                                                |
| 8   | 3D                       | En parte                              | Escena de unboxing bajo demanda para los 4 perfumes del piloto. Faltan el resto del catálogo, pipeline GLB y presupuestos en CI.                                                                                                                                                                                                         |
| 9   | Inventario               | Hecha en lo principal                 | Niveles, movimientos de solo inserción, recuentos, mostrador, compras, recepciones, reposición y prueba de concurrencia. Las reservas del checkout llegan con la F10.                                                                                                                                                                    |
| 10  | Carrito y checkout       | Empezada                              | PR de trabajo [#31](https://github.com/albertnieves/adhara-web/pull/31) (borrador): reglas de confirmación del pago (P01) y plan P02–P07 en `PLAN_PEDIDOS_WEB.md`. Activarla espera los datos del TPV virtual y el proveedor de correo (DECISIONS §82).                                                                                  |
| 11  | Admin operativo          | En parte                              | Informes, auditoría, equipo, contenido, suscriptores e informe diario del asistente. Faltan pedidos, clientes y promociones.                                                                                                                                                                                                             |
| 12  | Click & Collect          | Pendiente                             | Depende de la F10.                                                                                                                                                                                                                                                                                                                       |
| 13  | Homepage                 | En parte                              | Portada animada con título editable desde el panel (borrador, vista previa y publicación), preguntas frecuentes y suscripción al club.                                                                                                                                                                                                   |
| 14  | Cuenta de cliente        | Pendiente                             |                                                                                                                                                                                                                                                                                                                                          |
| 15  | SEO y analítica          | En parte                              | Canonical y hreflang por idioma con el dominio propio. Todo `noindex` hasta que se decida abrir a buscadores; sin sitemap ni analítica.                                                                                                                                                                                                  |
| 16  | QA y seguridad           | Pendiente                             | Ya hay pgTAP, E2E, auditoría de maquetación y axe, prueba de fuga de costes y escaneo de secretos en CI.                                                                                                                                                                                                                                 |
| 17  | Producción               | En parte                              | Dominio `latelierdudesert.com` y web pública desde el 10/10 (§117–118); textos legales en borrador (§113–116). Faltan plan Pro de Vercel, `adhara-prod`, pagos reales, copias de seguridad y monitorización.                                                                                                                             |

## Dónde estamos (10/10/2026)

La web es un **escaparate completo y público**: colección con PVP, fichas (4 con escena 3D), catálogo olfativo, club de promociones y textos legales, en tres idiomas y en `latelierdudesert.com`, todavía sin indexar. El **panel cubre la operación de la tienda física**: catálogo, precios con Ómnibus, costes y márgenes, inventario, mostrador, compras, reposición, informes y asistente. **No se puede comprar online**: es lo siguiente y depende sobre todo de datos del banco.

Lo que falta para cada paso depende más de decisiones y datos del negocio que de código: TPV virtual, correo transaccional, datos legales de envíos y pagos, plan Pro de Vercel y `adhara-prod` (STATUS, «Pendiente del usuario»).

## Siguientes fases y entregas

Seis hitos. Cada entrega es una PR revisable con su verificación (`pnpm check`, E2E y, si toca la base, pgTAP y tipos). Tamaño relativo: S (un día), M (dos o tres días), L (una semana o más). No hay fechas: el ritmo lo marcan los bloqueos de la última columna.

### H0 — En curso

| Entrega                       | Qué incluye                                                                                                        | Tamaño | Bloquea  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------ | -------- |
| Móvil: cuadrícula y menú      | Esta rama: cuadrícula de dos columnas con vista amplia, menú móvil que vuelve a navegar y galería de 44 px.        | S      | Revisión |
| Cierre de la Fase 2           | Revisión visual del usuario en la Preview (`/admin/diseno`, tonos de colección, tienda y panel).                   | S      | Usuario  |
| Presentación al cliente (#32) | Documentación de la presentación y reparto de cuentas. Antes de fusionar, renumerar su §113 (ya existe en `main`). | S      | Revisión |

### H1 — Escaparate listo para abrir a buscadores

Objetivo: que la web pueda indexarse y enlazarse sin riesgo, aunque aún no venda online.

| Entrega                   | Qué incluye                                                                                                                                                     | Tamaño | Bloquea                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------- |
| Catálogo completo (F3)    | Importar el CSV de costes desde el panel, revisar marcas «por revisar» y los 6 perfumes sin marca, fijar PVP y publicar por tandas; informe de importación.     | M      | Usuario (importación y revisión)    |
| Filtros móviles           | Filtros de la colección en una fila con desplazamiento o en un panel «Filtros» (hoy ocupan cinco filas a 390 px) y controles de 44 px (pendiente 12 de STATUS). | S      | Decisión de diseño                  |
| Legal definitivo          | Teléfono, envíos, pagos y arbitraje en los textos; revisión de la asesoría (§113–116).                                                                          | S      | Cliente y asesoría                  |
| SEO base (F15)            | Sitemap por idioma, JSON-LD de producto, Open Graph y quitar `noindex` cuando lo legal esté cerrado.                                                            | M      | Legal definitivo                    |
| Fotos y derechos (F7)     | Derechos de las fotos oficiales o fotos propias; los 6 publicados sin foto oficial.                                                                             | M      | Usuario                             |
| Infraestructura comercial | Vercel Pro, `adhara-prod` con copias diarias, URLs de Auth con el dominio, MFA del administrador de la tienda y `main` protegida.                               | S      | Usuario (planes y cuentas, ver #32) |

### H2 — Venta online con recogida en tienda (F10, F12, A5)

Objetivo: primera venta real pagada con tarjeta. Se recomienda empezar solo con recogida en Castelldefels y añadir envíos después. Sigue el plan de la PR #31.

| Entrega                  | Qué incluye                                                                                             | Tamaño | Bloquea                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------- |
| P02 Persistencia         | Pedidos, líneas, intentos de pago y reservas con RLS, pgTAP y tipos. Puede empezar ya.                  | L      | —                                   |
| P03 Carrito y checkout   | Carrito y checkout es/ca/en con precios y stock de servidor, recogida en tienda, reserva con caducidad. | L      | Decisión: recogida, envíos o ambos  |
| P04 TPV                  | Redsys por redirección: notificación firmada, confirmación atómica, conciliación y pruebas de sandbox.  | M      | **Datos del TPV virtual del banco** |
| P05 Panel de pedidos     | Listado, ficha, incidencias, preparar → listo para recoger → entregado (Click & Collect).               | M      | P02                                 |
| P06 Correo y reembolsos  | Confirmación al comprador y avisos de recogida (Resend), reembolsos con el TPV.                         | M      | **Proveedor de correo y DNS**       |
| P07 Validación integrada | Pago correcto y rechazado, firma falsa, importe alterado, duplicados, última unidad, caducidad, E2E.    | M      | P02–P06                             |
| Envíos                   | Zonas, tarifas, envío gratis y transportista, en una entrega aparte.                                    | M      | Decisión de tarifas y transportista |

### H3 — Clientes y mensajes (A6.1, A7, F14)

| Entrega                    | Qué incluye                                                                                                | Tamaño | Bloquea              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ | -------------------- |
| Bandeja de mensajes (A6.1) | Formulario de contacto y email entrante y saliente, enlazados a cliente y pedido, con plantillas y plazos. | L      | Proveedor de correo  |
| Fichas de cliente (A7)     | Pedidos, mensajes y consentimientos; exportación y borrado RGPD.                                           | M      | H2                   |
| Promociones                | Códigos y promociones automáticas con vigencia y límites, conectadas al club de Sender.                    | M      | H2                   |
| Cuenta de cliente (F14)    | Opcional: historial de pedidos y datos guardados, sin obligar a registrarse para comprar.                  | M      | Decisión del negocio |

### H4 — Catálogo y experiencia (F4–F8, F13)

| Entrega               | Qué incluye                                                                                       | Tamaño | Bloquea                          |
| --------------------- | ------------------------------------------------------------------------------------------------- | ------ | -------------------------------- |
| Marcas y colecciones  | Página por casa, colecciones editoriales (tonos `oud`, `indigo`, `forest`, D3) y búsqueda global. | M      | —                                |
| Scent Journey         | Recorrido guiado por familias y momentos a partir de los perfiles olfativos.                      | M      | Perfiles del resto del catálogo  |
| Research del catálogo | Perfiles olfativos y textos con fuente para los perfumes que se publiquen.                        | L      | Catálogo publicado (H1)          |
| 3D para más perfumes  | Pipeline GLB, presupuestos de peso en CI y escenas para los más vendidos.                         | L      | Medidas reales del kit de tienda |
| Rendimiento           | Objetivos de Lighthouse en móvil para portada, colección y ficha.                                 | S      | —                                |

### H5 — QA, seguridad y producción (F16, F17)

| Entrega               | Qué incluye                                                                                                                | Tamaño | Bloquea        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ | -------------- |
| Revisión de seguridad | Revisión de permisos, RLS y superficie pública antes de cobrar en producción; protección de contraseñas filtradas en Auth. | M      | H2             |
| Operación             | Monitorización de errores y disponibilidad, copias comprobadas con una restauración de prueba y guía de incidencias.       | M      | `adhara-prod`  |
| Migraciones           | Despliegue automático de migraciones de `main` a `adhara-prod` con revisión.                                               | S      | `adhara-prod`  |
| Analítica             | Solo si se decide: sin cookies o con aviso de consentimiento que permita rechazar.                                         | S      | Decisión legal |

## Orden recomendado

H0 → H1 (en paralelo con P02 de H2, que no necesita credenciales) → resto de H2 en cuanto lleguen los datos del TPV → H3 → H4 y H5. Lo único que de verdad frena la venta online es el **TPV virtual** (STATUS, pendiente 6) y el **correo transaccional** (pendiente 7): conviene pedirlos ya.
