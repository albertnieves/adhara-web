# Fase S — Informes y control

Estado: **en desarrollo en la rama `claude/wonderful-babbage-4ojhui`, encima de la fase R** · 01/10/2026

Parte de A8 de [ADMIN_PLAN.md](ADMIN_PLAN.md): los informes y el visor de auditoría. Se hace antes que A6.1 (mensajes) y A5 (pedidos online) porque esas fases esperan decisiones del negocio: proveedor de email, textos legales del formulario de contacto, cuenta de Stripe y envíos. Los informes solo necesitan datos que ya existen (movimientos, costes, compras y ventas de mostrador). Todo es de solo lectura.

## Objetivo

Que el negocio sepa cuánto vale lo que tiene, qué se mueve y qué no, qué margen deja cada marca y cómo cumplen los proveedores, y que la gestoría reciba cada mes el cierre de existencias sin trabajo manual.

## Bloques

| Bloque                    | Entregable                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 — Base                | Plan, decisiones y migración solo de funciones de lectura                                                                                                                     |
| S02 — Inventario y cierre | Existencias iniciales, entradas, ventas, devoluciones, mermas y probadores, ajustes, traslados y existencias finales de un mes o periodo; valor a coste; CSV para la gestoría |
| S03 — Rotación            | Ventas, stock medio, rotación, días de cobertura y última venta por formato; más vendidos e inmovilizado                                                                      |
| S04 — Márgenes            | Margen teórico por marca y por formato (PVP sin IVA frente a coste); formatos sin coste o por debajo del margen mínimo                                                        |
| S05 — Compras             | Por proveedor: pedidos, unidades pedidas y recibidas, valor recibido a coste y plazo real frente al declarado (para ajustar el vigilante)                                     |
| S06 — Auditoría           | Visor del registro de auditoría con filtros por persona, acción, entidad y fechas                                                                                             |
| S07 — Validación          | pgTAP por rol, cuadre de existencias, pruebas unitarias, E2E de acceso y recorrido real con datos                                                                             |

## Criterios de aceptación

- **Cuadre.** Para cada formato: existencias iniciales + entradas − ventas + devoluciones − mermas y probadores ± ajustes − traslados = existencias finales, y las finales coinciden con el nivel actual si el periodo acaba hoy. Las mismas categorías de movimiento en SQL y en TypeScript, con prueba de paridad.
- **Costes.** El valor a coste solo aparece con `pricing.view_cost` y MFA. Sin ese permiso, los informes muestran unidades. El coste de una fecha es el último registrado antes de ella. Un formato sin coste nunca vale 0: se lista aparte como «sin coste».
- **Permisos.** Informes con `reports.view`; compras por proveedor con `purchasing.manage`; auditoría con `staff.manage`. El encargado no ve informes.
- **Fechas.** Los periodos son días y meses de la tienda (Europe/Madrid), también en los cambios de hora.
- **Gestoría.** El CSV abre en Excel en español (`;`, BOM, CRLF y sin inyección de fórmulas, como el de movimientos).
- **Sin importes de venta.** El mostrador no guarda importes (DECISIONS §59), así que los informes de ventas son en unidades. No se estiman ingresos con el PVP actual.

## Fuera de alcance

- Dashboard del inicio (E06 de Codex) y configuración de la tienda (E05): los informes exponen funciones puras que el dashboard puede reutilizar.
- Ventas en euros, IVA repercutido y cierre contable: llegan con el checkout (A5) o con el TPV.
- Valoración FIFO o por precio medio ponderado: se usa el último coste registrado, que es lo que guarda el sistema hoy. Confirmar con la asesoría si la gestoría necesita otro criterio.

## Decisiones que necesito de ti

| #   | Pregunta                                                                              | Bloque |
| --- | ------------------------------------------------------------------------------------- | ------ |
| 1   | ¿Qué formato y criterio de valoración pide la gestoría para el cierre de existencias? | S02    |
| 2   | Margen mínimo deseado (hoy 0 %, provisional): define qué formatos salen «por debajo»  | S04    |
