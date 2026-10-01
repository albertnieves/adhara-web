# Panel de administración — plan por fases

Estado: **A0 y A1 implementadas; A2 (catálogo, PVP, cambios masivos, costes y margen por formato, etiquetas de precio e importación CSV) en versión base; A3 completa y A4.1 hecha en la fase R (proveedores, pedidos de compra, mostrador y vigilante; [PLAN_TIENDA_REPOSICION.md](PLAN_TIENDA_REPOSICION.md)), pendiente de aplicar su migración en `adhara-dev`** · 01/10/2026

Este documento concreta el back-office de ADHARA sobre la arquitectura de docs/source (Fase 0 §10–§11 y plan de Fase 1). No sustituye esos documentos. Cada fase A se corresponde con fases del roadmap original (F1…F17), indicadas entre paréntesis.

## 1. Qué debe resolver el panel

Operar la tienda online y la física de Castelldefels desde un único sitio, usable en tablet detrás del mostrador:

- **Precios:** PVP, precio anterior (rebajas conforme a Ómnibus), coste interno y margen, con cambios individuales y masivos revisados.
- **Stock e inventario:** existencias por variante y ubicación, movimientos auditables, recepciones, recuentos, ventas en tienda y probadores.
- **Agente de inventario:** vigila el stock, detecta problemas, propone reposiciones y responde preguntas. **Nunca modifica stock ni precios por sí mismo.**
- **Pedidos:** envío y Click & Collect, estados, incidencias y reembolsos.
- **Mensajes con clientes:** bandeja unificada enlazada a cliente y pedido, con borradores del agente que siempre revisa una persona.
- **Soporte del negocio:** clientes y consentimientos, promociones, proveedores y compras, informes, configuración, usuarios y auditoría.

## 2. Reglas que no cambian en ninguna fase

1. `/admin` sigue devolviendo 404 hasta tener juntos sesión, roles, MFA y RLS (docs/DECISIONS.md §9). No hay pantallas «de maqueta» con datos inventados.
2. Autorización en cuatro capas: proxy (sesión), layout del admin (`requireStaff`), cada Server Action (`requirePermission`) y RLS en la base de datos.
3. Dinero en céntimos enteros; porcentajes en puntos básicos; precio y stock se calculan y validan en servidor.
4. Costes, proveedores y precios de compra en el esquema `internal`, fuera de la API pública. Solo se leen mediante funciones con permiso `pricing.view_cost` y sesión `aal2`.
5. Los movimientos de inventario, el historial de precios y el registro de auditoría son de solo inserción.
6. Toda acción sensible queda en `audit_log` (quién, qué, antes y después).
7. El agente propone; una persona con el permiso correspondiente aprueba. Las propuestas aprobadas se ejecutan por los mismos casos de uso que usaría una persona, con sus validaciones.

## 3. Roles y permisos

Fuente de verdad en código: `src/modules/auth/domain/permissions.ts`. De ella saldrán el seed de `role_permissions` y la tabla de verdad de las pruebas pgTAP. Roles confirmados el 29/09/2026:

| Rol (código)   | Quién                                             | Alcance                                                                                                                                                        |
| -------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system_admin` | Administrador del sistema (Albert)                | Todo, incluidos usuarios, roles y configuración                                                                                                                |
| `store_admin`  | Administrador de la tienda (Agustín, en el local) | Toda la operación: precios y costes, stock, compras, pedidos y reembolsos, mensajes, clientes, promociones, catálogo e informes. Sin usuarios ni configuración |
| `viewer`       | Encargado                                         | Solo lectura: stock, pedidos y mensajes, y preguntas al asistente de inventario. Sin datos de clientes ni costes                                               |

Los **clientes** no son personal: tendrán cuenta en la tienda online (fase A7/F14) y solo verán sus propios pedidos, direcciones y mensajes, garantizado por RLS.

Todo el personal tendrá MFA obligatoria desde la fase A1. Los permisos de precios, costes, compras, reembolsos, clientes, configuración y personal exigen además sesión verificada con MFA (aal2), comprobado también en SQL.

## 4. Fases

### A0 — Reglas de negocio del admin (hecha, sin servicios externos)

Objetivo: fijar en código probado las reglas que usarán base de datos y pantallas, antes de escribir migraciones.

| Módulo              | Contenido                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/money.ts`  | Céntimos, IVA en puntos básicos, bruto↔neto con redondeo half-even, lectura de importes «29,95 €»                                  |
| `modules/auth`      | Roles, permisos, permisos con aal2 y `isAllowed`                                                                                   |
| `modules/pricing`   | Margen (desconocido sin coste), referencia Ómnibus de 30 días, revisión de cambios de PVP, ajustes masivos y redondeos comerciales |
| `modules/inventory` | Tipos de movimiento y efectos, invariantes (`reserved ≤ on_hand`), recuentos, vigilante de stock del agente                        |
| `modules/orders`    | Máquina de estados con permiso y efecto de inventario por transición                                                               |
| `modules/messaging` | Estados de conversación, plazo de respuesta y revisión obligatoria de borradores del agente                                        |

Criterio cumplido: `pnpm check` en verde con pruebas unitarias de cada regla (docs/STATUS.md).

### A1 — Acceso seguro al panel (F1, bloques 3–4 de docs/DEVELOPMENT.md)

- Supabase local con CLI versionada y proyecto `adhara-dev` en región UE.
- Migraciones 0001 (esquemas `internal`/`private`), 0002 (idiomas) y 0003 (`staff_members`, `role_permissions`, `audit_log`, `has_permission`, `is_staff`, `current_aal`), con el seed de permisos generado desde la matriz de A0.
- Login por invitación, MFA TOTP obligatoria, `/admin/acceso`, `/admin/mfa`, guardas de servidor y shell del admin con navegación preparada para tablet.
- Cabeceras `noindex` y `no-store` en `/admin`.

Aceptación: criterios 14–16 de la Fase 1 (sin sesión → acceso; sin fila de personal → 404; sin MFA → alta de MFA; con aal2 → panel) en E2E, y pgTAP de la matriz de permisos.

Necesito: organización de Supabase y permiso para crear `adhara-dev` en la UE; email del administrador del sistema (primer usuario) y de Agustín; Docker disponible para Supabase local.

### A2 — Catálogo y precios (F1 migraciones 0004–0009, parte de F3)

- Productos y variantes (solo lo que exista en el catálogo real importado; nada inventado).
- Editor de precios por variante con los cuatro precios: **PVP** con IVA, **precio anterior** (solo con rebaja anunciada y validado con Ómnibus), **coste** neto interno y **precio del catálogo PDF** como referencia de importación.
- Margen en € y % en pantalla solo para quien tenga `pricing.view_cost` con aal2.
- Cambios masivos por marca, línea o selección: vista previa por fila con `reviewPriceChange`; los avisos que exigen confirmación se confirman uno a uno y quedan registrados.
- Historial de precios (`internal.price_change_log`) y auditoría.
- Etiquetas de precio imprimibles tras un cambio.

Aceptación: pgTAP de aislamiento de costes (criterio 9 de la Fase 1), `cost-leak.spec.ts` en verde, un cambio de PVP sin permiso falla en servidor y en SQL, y el precio anterior no supera el mínimo de 30 días.

Necesito: qué representan los precios del PDF (PVP, mayorista o coste); margen mínimo deseado y umbral de «cambio grande»; quién registra costes.

### A3 — Inventario operativo (F9)

- `stock_locations` (hoy, la tienda de Castelldefels), `inventory_levels`, `inventory_movements` y reservas; funciones SQL `reserve`, `commit` y `release` con las invariantes de A0.
- Recepción de mercancía, recuentos por zona con diferencias, ajustes con motivo, probadores (`TESTER_ALLOCATION`), mermas y devoluciones.
- **Venta en tienda:** pantalla de mostrador que descuenta stock, o integración con el TPV si tiene API. Es la dependencia principal para que el stock online sea fiable.
- Proveedores y órdenes de compra (en `internal`), necesarias para las propuestas del agente.
- Exportación de movimientos y valor del inventario a coste (solo con permiso de costes).

Aceptación (F9): N compras simultáneas de la última unidad → exactamente una tiene éxito; `on_hand` coincide con la suma de movimientos; ningún rol puede editar ni borrar movimientos.

Hecho en la fase R (01/10/2026): proveedores con condiciones por formato, pedidos de compra con recepción parcial y mostrador (venta y devolución sin tickets ni importes, DECISIONS §59). Las reservas (`reserve`/`commit`/`release`) quedan para A5. Aceptación comprobada: 24 ventas simultáneas de la última unidad → una con éxito; recepciones simultáneas sin pasarse de lo pedido; nivel = suma de movimientos (`supabase/tests/concurrency/`).

Necesito: si existe TPV y cuál; proveedores habituales, plazos de entrega y múltiplos de compra.

### A4 — Agente de inventario (nueva, tras A3)

Diseño completo en §5. Dos subfases:

- **A4.1 Vigilante determinista:** tarea programada (Vercel Cron con `CRON_SECRET`) que construye la foto del inventario, ejecuta `watchStock` y guarda hallazgos y propuestas. Panel «Alertas de stock» en el dashboard y cola de aprobación. Sin modelo de lenguaje: funciona aunque no haya proveedor de IA. **Hecho en la fase R sin tarea programada:** se calcula al abrir Reposición y las propuestas se convierten en borradores de pedido por acción humana (DECISIONS §63). La tarea programada llegará con los avisos por email.
- **A4.2 Asistente conversacional:** chat dentro del admin («¿qué debería pedir a este proveedor?», «¿por qué no cuadra el stock de este perfume?») con herramientas de solo lectura y de propuesta.

Aceptación: el agente no tiene ninguna herramienta que escriba stock o precios (prueba sobre la lista de herramientas y sobre los permisos SQL del rol que usa); toda propuesta aprobada pasa por el caso de uso normal y queda en auditoría; un conjunto de escenarios de evaluación (fotos de inventario → hallazgos y respuestas esperados) en verde antes de activarlo.

Necesito: parámetros del vigilante (días de cobertura objetivo, colchón sobre el plazo, días para considerar stock inmovilizado); para A4.2, confirmar proveedor de IA y clave de API en variables de entorno del servidor.

### A5 — Pedidos y Click & Collect (F10–F12)

- Listado con filtros por estado, tipo de entrega y fecha; ficha con cronología (estados, pagos, efectos de inventario, mensajes).
- Acciones calculadas con `availableTransitions`: el personal solo ve lo que puede hacer.
- Tablero de recogidas en tienda (preparar → listo → entregado) con verificación del cliente en mostrador.
- Cola `needs_attention` (pago sin stock, importes que no cuadran) y reembolsos vía Stripe con aal2.
- Avisos al cliente por email en cada cambio relevante (cuando exista proveedor de email).

Aceptación (F10–F12): el precio manipulado en cliente no altera el cobro; el webhook es idempotente; un pedido Click & Collect reserva stock de la tienda; cada transición aplica su efecto de inventario en la misma transacción.

Necesito: cuenta de Stripe, proveedor de email, zonas y tarifas de envío, política ante pagos llegados sin stock (reembolso automático o manual).

### A6 — Mensajes con clientes (nueva)

- **A6.1 Bandeja básica:** formulario de contacto del storefront y email entrante/saliente. Conversaciones enlazadas a cliente y pedido, notas internas, asignación, plantillas y plazo de respuesta (`isOverdue`).
- **A6.2 WhatsApp Business** (API oficial de Meta): requiere verificación de empresa, número dedicado y plantillas aprobadas para mensajes fuera de la ventana de 24 h.
- **A6.3 Borradores del agente:** propuesta de respuesta con el contexto del pedido; nunca se envía sin que una persona la revise.

Aceptación: RLS impide leer conversaciones sin `messages.view`; un borrador del agente no puede enviarse sin aprobación (prueba en servidor y SQL); retención y borrado de mensajes ligados al borrado RGPD del cliente.

Necesito: canales que queréis atender (email, WhatsApp, Instagram); número de WhatsApp Business si aplica; tiempo de respuesta objetivo.

### A7 — Clientes, promociones y fidelización (F11, F14)

Ficha de cliente (pedidos, conversaciones, consentimientos con fecha), exportación y borrado RGPD, promociones por código o automáticas con vigencia y límites, sets de regalo.

### A8 — Dashboard, informes y configuración (F11)

- Dashboard: ventas del día/7/30 días por canal, pedidos por preparar, recogidas listas, alertas del agente, mensajes vencidos y stock crítico.
- Informes: margen por marca y línea, rotación, stock inmovilizado, valor del inventario a coste y cierre mensual en CSV para la gestoría.
- Configuración: datos y horarios de la tienda, IVA, envíos, parámetros de precios y del vigilante, usuarios, roles y visor de auditoría.

Aceptación (F11): cada KPI coincide con una consulta de control y los roles se prueban según la matriz.

## 5. Agente de inventario

### Capas

| Capa                     | Qué hace                                                                                                                                                                                                   | Depende de IA |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------: |
| Vigilante (`watchStock`) | Reglas deterministas: agotados, bajo mínimo, cobertura insuficiente, reservas vencidas, niveles incoherentes, stock inmovilizado; calcula cantidades de reposición con plazo, colchón y múltiplo de compra |      No       |
| Cola de propuestas       | Cada propuesta (reponer, liberar reservas, ajuste tras recuento) espera aprobación de alguien con permiso                                                                                                  |      No       |
| Asistente conversacional | Explica hallazgos, prioriza, agrupa propuestas por proveedor y responde preguntas sobre el inventario                                                                                                      |      Sí       |

Los hallazgos siempre llevan los datos que los justifican (disponible, ventas en la ventana, plazo, pendiente de recibir). Si faltan datos, el vigilante no inventa una cantidad: deja la propuesta vacía para que decida una persona.

### Asistente (A4.2)

- **Patrón:** Claude API con el _tool runner_ del SDK oficial de TypeScript y herramientas definidas con zod (ya es dependencia). El bucle se ejecuta en nuestro servidor Next.js porque las herramientas consultan Supabase con la sesión de quien pregunta. Se descarta Managed Agents: no se necesita un entorno de ejecución alojado y añadiría otra superficie de datos.
- **Modelo:** `claude-opus-5-5` con _adaptive thinking_ y `effort` ajustado por uso (bajo para el resumen diario, más alto para análisis). Se medirá con los escenarios de evaluación antes de fijarlo. Respuestas en streaming en el chat. La dependencia `@anthropic-ai/sdk` se instala al empezar A4.2, no antes.
- **Herramientas de lectura:** niveles por variante y ubicación, movimientos filtrados, ventas por ventana, hallazgos abiertos, órdenes de compra abiertas. Los costes solo se exponen si la sesión tiene `pricing.view_cost` con aal2.
- **Herramientas de propuesta:** crear propuesta de reposición, agrupar propuestas en un borrador de orden de compra y sugerir un recuento. Escriben únicamente en la cola de propuestas.
- **Sin herramientas de escritura** sobre stock, precios, pedidos ni mensajes enviados.

### Seguridad y coste

- Las herramientas usan el cliente de Supabase de la sesión del usuario: el agente nunca ve más que la persona que pregunta y RLS se aplica igual.
- Nombres de producto, notas y mensajes se tratan como datos, no como instrucciones. Aunque un texto intentara manipular al agente, sus herramientas no pueden causar daño.
- El inventario no contiene datos personales. En la fase A6.3 (borradores de respuesta) sí se enviarían mensajes de clientes al proveedor de IA: requiere acuerdo de tratamiento, aviso en la política de privacidad y minimizar datos (sin email ni teléfono).
- Cada ejecución queda registrada (usuario, herramientas llamadas, tokens y coste). Habrá un tope diario configurable.
- Tarifa de referencia a 25/09/2026: 4 $ por millón de tokens de entrada y 20 $ por millón de salida. El coste real se medirá con el uso antes de fijar el tope.

## 6. Otras funcionalidades útiles para el negocio

Priorizadas según el impacto en la operación; cada una entra en la fase indicada:

1. **Venta en tienda o integración con TPV** (A3): sin ella el stock online no es fiable.
2. **Escaneo de EAN con la cámara de la tablet** para recepción, recuento y venta (A3). Evaluar compatibilidad del navegador de la tablet elegida antes de añadir dependencias.
3. **Probadores:** registrar frascos abiertos como probador y su coste (A3).
4. **Órdenes de compra a proveedor** generadas desde las propuestas del agente (A3–A4).
5. **Etiquetas de precio imprimibles** tras cambios de PVP (A2).
6. **Tablero de Click & Collect** para el mostrador (A5).
7. **Plantillas de respuesta** a preguntas frecuentes: envíos, devoluciones de perfumes precintados, disponibilidad (A6).
8. **Sets de regalo** que descuentan el stock de sus componentes, si se venden así (A7; decisión pendiente).
9. **Informes para la gestoría** y valor del inventario (A8).
10. **Avisos al personal** de pedido nuevo, recogida lista, stock crítico o mensaje vencido (A5–A8, con el proveedor de email).

## 7. Orden recomendado

A1 → A2 → A3 → A4.1 → A6.1 → A5 (con el checkout de F10) → A4.2 → A6.2/A6.3 → A7 → A8. El dashboard (A8) crece en cada fase con los indicadores que ya existan.

La bandeja básica de mensajes (A6.1) puede adelantarse a pedidos porque solo depende de A1 y del proveedor de email.

## 8. Decisiones que necesito de ti

| #   | Pregunta                                                                                   | Fase |
| --- | ------------------------------------------------------------------------------------------ | ---- |
| 1   | Permiso para crear `adhara-dev` en región UE dentro de «albertnieves's Org» (ya conectada) | A1   |
| 2   | Email del administrador del sistema y de Agustín                                           | A1   |
| 3   | ¿Los precios del PDF son PVP con IVA, mayorista o coste?                                   | A2   |
| 4   | Margen mínimo y umbral a partir del cual un cambio de PVP pide confirmación                | A2   |
| 5   | ¿Hay TPV en la tienda? ¿Cuál? ¿Tiene API o exportación?                                    | A3   |
| 6   | Proveedores, plazos de entrega y múltiplos de compra                                       | A3   |
| 7   | Parámetros del vigilante: cobertura objetivo, colchón, días de inmovilizado                | A4   |
| 8   | Confirmar Claude como proveedor de IA y el tratamiento de datos                            | A4.2 |
| 9   | Canales de mensajes, número de WhatsApp Business y tiempo de respuesta                     | A6   |
| 10  | Proveedor de email transaccional                                                           | A5   |
