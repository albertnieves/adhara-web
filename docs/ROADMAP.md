# Roadmap vigente — 25/10/2026

Orden de trabajo. [STATUS.md](STATUS.md) contiene el estado verificado y sus entradas fechadas; [OPERATIONS.md](OPERATIONS.md), los pasos técnicos; [PLAN_APERTURA.md](PLAN_APERTURA.md), los pasos del banco y negocio. El plan original de 17 fases se conserva en `docs/source/FASE_0_ARQUITECTURA.md` y los informes de fase; no sustituye a este orden actualizado.

## 1. Entornos y operación — objetivo activo

- PR #47 de cierre de apertura: abierta y con sus tres workflows correctos en el último commit comprobado. Fusionarla antes de la rama de operación.
- Comprobación de destino antes de construir, ejemplo de desarrollo desconectado, readiness y vigilancia de disponibilidad: implementados en `codex/entornos-operacion`, pendientes de revisión y publicación.
- Separar las variables de Preview de los datos reales que conserva `atelier-dev`; preparar datos ficticios y retirar el acceso de las pruebas antiguas.
- Registrar una restauración de copia en un entorno aislado y su comprobación.
- Dos revisiones diarias de Codex ya creadas: técnica y avance, desde el 26/10 por la mañana, Europe/Madrid.

**Cierre:** una prueba completa en Preview no cambia ningún dato ni envía ningún correo desde Production; las URLs de pruebas antiguas ya no operan sobre datos reales; Availability pasa en `main` y hay evidencia de restauración. Detalle y límites en OPERATIONS.

## 2. Apertura de la venta — completar los bloqueos externos

Carrito, reservas, recogida/envío, Redsys, correos, devoluciones, panel y pruebas con banco simulado ya existen. La venta sigue apagada. La #47 completa protecciones de las devoluciones, contacto y coherencia de envíos legales; aún no está fusionada.

Comprobar Bizum y su devolución, pase y datos reales del TPV, tarifas ofrecidas, accesos/MFA, reglas del firewall, transportista/plazos y revisión de la asesoría. Correo de pedidos y copias ya funcionan: no volver a tratarlos como servicios sin configurar. La cuenta de cliente y el contacto tienen su activación y requisitos propios.

**Cierre:** lista de PLAN_APERTURA completada, compra real pequeña y devolución verificadas por el titular y venta encendida con autorización.

## 3. SEO base

Ya existen `src/app/sitemap.ts`, robots, JSON-LD de producto, metadatos sociales y pruebas de `SEO_INDEXING`. La rama `codex/seo-indexacion-controlada`, sobre #48, corrige la cabecera global incondicional de `next.config.ts` usando la misma decisión de SEO y añade pruebas de la configuración real y rutas operativas. Pendiente de fusión, revisión de datos reales y activación aprobada; pasos en [SEO_RELEASE.md](SEO_RELEASE.md). Publicar solo productos con datos y media verificados.

**Cierre:** pruebas ES/CA/EN, sitemap y datos estructurados correctos, sin indexar panel, borradores ni cuentas.

## 4. Búsqueda global y filtros móviles

Buscar perfumes, casas y familias; filtros claros a 390 px y estados vacíos útiles. Aprovechar los perfiles existentes y medir el rendimiento antes de añadir un buscador externo.

**Cierre:** búsqueda y navegación por teclado, móvil y tres idiomas verificadas, sin degradación de carga ni accesibilidad.

## 5. Scent Journey

Recorrido por familias, notas y momentos con perfiles verificados, reglas explicables y enlaces a perfumes disponibles. No inventar notas ni claims. La IA no es requisito para la primera versión.

**Cierre:** recomendaciones reproducibles con fuente y respuesta útil si faltan datos.

## 6. 3D selectivo y rendimiento

Ampliar los cuatro pilotos a productos destacados con medidas reales. Pipeline GLB y presupuestos de peso y carga; Lighthouse CI en una entrega propia. Fotos reales o con derechos y alternativa accesible sin WebGL.

**Cierre:** comparación móvil y escritorio con carga bajo demanda, movimiento reducido y presupuestos comprobados.

## Pendientes que continúan

Completar catálogo, costes y procedencias desde el panel; perfiles y derechos de media; fichas de cliente y consentimiento; promociones automáticas; configuración de cuenta de cliente/contacto y futura ayuda del asistente. No activar IA o proveedores nuevos por anticipación. Sentry se evaluará como integración de errores específica: esta entrega usa sondas y revisión de logs, sin añadir su SDK.
