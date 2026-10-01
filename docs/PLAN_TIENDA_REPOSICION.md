# Fase R — Tienda física y reposición

Estado: **implementada en la rama `claude/wonderful-babbage-4ojhui`, pendiente de revisión y de aplicar la migración en `adhara-dev`** · 30/09/2026

Completa la fase A3 (inventario operativo) y abre la A4.1 (vigilante determinista) de [ADMIN_PLAN.md](ADMIN_PLAN.md). Se trabaja en paralelo al bloque E01–E07 de Codex (permisos con MFA, cuentas, ediciones fiables, editor de contenido, panel de pendientes y validación), así que evita tocar sus pantallas y su esquema.

## Objetivo

Que el stock de la tienda de Castelldefels sea fiable y que reponer sea una decisión informada:

1. Lo vendido en el mostrador se descuenta del stock en el momento, desde la tablet (ADMIN_PLAN §6.1: sin esto el stock online no es fiable).
2. Las compras a proveedor se piden, se reciben y suman stock con trazabilidad (qué pedido, qué albarán, quién).
3. Un vigilante sin IA avisa de agotados, stock bajo, cobertura insuficiente, stock inmovilizado y niveles que no cuadran con sus movimientos, y propone cantidades que una persona convierte en pedido.

## Bloques

| Bloque            | Entregable                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 — Base        | Rama desde el último `main`, Supabase local con la CLI para validar sin tocar `adhara-dev` ni la configuración de E01, plan y decisiones                                     |
| R02 — Proveedores | Ficha de proveedor y condiciones por formato (referencia, múltiplo de compra, plazo, preferente) en `internal`, con asignación por marca                                     |
| R03 — Pedidos     | Borrador → pedido → recepción parcial o total → cerrado; la recepción suma stock con `PURCHASE_RECEIPT` en la misma transacción, sin recibir de más y sin duplicar           |
| R04 — Mostrador   | Pantalla de tablet: buscar o escanear (lector que teclea), varias líneas, venta o devolución todo o nada con el nº de ticket del TPV; un doble toque registra una sola venta |
| R05 — Reposición  | Alertas con `watchStock` y propuestas de reposición que una persona con permiso de compras convierte en borradores de pedido por proveedor                                   |
| R06 — Parámetros  | Ventana de ventas, cobertura objetivo, colchón e inmovilizado visibles y editables (configuración, con MFA); valores provisionales hasta que los fije el negocio             |
| R07 — Validación  | pgTAP por rol, pruebas de concurrencia en Postgres real, unitarias de dominio y paridad SQL/TS, E2E de acceso y recorrido real del panel contra Supabase local               |

## Criterios de aceptación

- **Permisos.** Proveedores y pedidos exigen `purchasing.manage` (MFA). Vender en mostrador, `inventory.sell_in_store` y además MFA en la función SQL. Las alertas se leen con `inventory.view`; el encargado las ve sin nombres de proveedor ni costes. Los parámetros se cambian con `settings.manage`.
- **Aislamiento.** Proveedores, condiciones, pedidos y recepciones viven en `internal` (fuera de la API). Solo se leen con funciones que comprueban el permiso; el coste unitario del pedido se devuelve vacío sin `pricing.view_cost`. Ninguna página pública ni módulo de la tienda los referencia (prueba estática y E2E existente de costes).
- **Stock.** Toda entrada o salida pasa por `admin_record_inventory_movement`; los niveles siguen cuadrando con la suma de movimientos. Una venta sin unidades disponibles no descuenta nada (todo o nada) e indica el formato. Recibir más de lo pedido falla. Dos recepciones o ventas con la misma clave de petición registran una sola.
- **Concurrencia.** N ventas simultáneas de la última unidad → exactamente una tiene éxito. Dos recepciones simultáneas del mismo pedido no superan lo pedido.
- **Ediciones.** Los cambios de un pedido indican la revisión que vio la persona; si otra persona lo cambió entretanto, no se aplica y se pide recargar.
- **Vigilante.** Sin datos (sin plazo ni punto de pedido) no inventa cantidades. Los borradores nunca vendidos ni recibidos no generan alertas de agotado. Ninguna propuesta se ejecuta sola: crear el pedido es una acción humana con permiso y auditoría, por el mismo caso de uso que un pedido manual.

## Fuera de alcance (y por qué)

- **Tickets, importes o cobros en el mostrador.** El panel no es un TPV ni un sistema de facturación: solo descuenta unidades y guarda el nº de ticket del TPV o la caja. Emitir tickets o facturas exigiría cumplir el reglamento de sistemas de facturación (Veri\*factu); se decide con la asesoría y según el TPV que exista (ADMIN_PLAN §8, pregunta 5).
- **Cron y avisos por email.** El vigilante se calcula al abrir Reposición con la sesión de quien mira: no necesita clave secreta ni tarea programada. La tarea programada llegará con el proveedor de email, cuando haya a quién avisar.
- **Reservas online** (`reserve`/`commit`/`release`): llegan con el checkout (A5). El vigilante ya contempla reservas vencidas, hoy siempre 0.
- **Escaneo con la cámara** de la tablet: un lector de códigos USB o Bluetooth funciona ya (teclea el código y Enter). La cámara depende del navegador de la tablet que se elija (ADMIN_PLAN §6.2).
- **Dashboard.** El panel de pendientes es el bloque E06 de Codex; Reposición expone un resumen reutilizable (`summarizeFindings`) para que lo enlace.

## Coordinación con E01–E07

- Sin cambios en la matriz de permisos, en `admin_record_inventory_movement` ni en tablas existentes: la migración solo añade tablas y funciones. Las funciones nuevas llaman a la de movimientos con argumentos por nombre.
- Sin `supabase/config.toml` (E01): Supabase local se levanta fuera del repositorio para validar.
- Toda escritura nueva exige MFA en SQL, en línea con E02.
- Los pedidos usan revisión optimista, la misma idea que E04 para precios e imágenes.
- Solo se tocan archivos compartidos en puntos pequeños: navegación del panel, tipos generados y documentación.
- La migración no se aplica a `adhara-dev` hasta fusionar, para no desordenar el historial de migraciones mientras Codex trabaja sobre él. Al aplicarla, el archivo se renombra con la versión real (como las anteriores) y se regeneran los tipos.

## Decisiones que necesito de ti

| #   | Pregunta                                                                                                              | Bloque |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Proveedores reales: nombre, contacto, plazo de entrega y múltiplo de compra (¿Orient Fragance para todo el catálogo?) | R02    |
| 2   | ¿Hay TPV en la tienda? ¿Cuál? Mientras tanto, el mostrador descuenta con el nº de ticket                              | R04    |
| 3   | Parámetros del vigilante: días de ventas analizados, cobertura objetivo, colchón y días de inmovilizado               | R06    |
| 4   | Al recibir un pedido, ¿el coste del pedido pasa a ser el coste vigente? (opción marcada por defecto)                  | R03    |
| 5   | Aplicar la migración en `adhara-dev` cuando se fusione este PR (después de las de Codex si van antes)                 | R01    |
