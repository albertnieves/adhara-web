# Pedidos de la web y confirmación de tarjeta

Estado: **PR de trabajo: P01 (reglas), P02 (base de datos) y P05 (panel) hechas** · 12/10/2026.

Objetivo solicitado: al pagar con tarjeta en la web, el pedido aparece automáticamente
en el panel con sus datos y queda disponible para preparar y entregar. La compra debe
quedar registrada aunque el cliente cierre la pestaña después del pago.

P01 añadió `planCardPaymentConfirmation` (decisión pura) a `modules/orders`. P02 añade
la migración `20261011230000_web_orders.sql`: pedidos, líneas, contacto, intentos de
pago, notificaciones, cronología y reserva de stock, con las funciones que crean el
pedido, registran el cobro, liberan reservas caducadas y cambian el estado desde el
panel (detalle abajo). **Todavía no hay checkout, adaptador del banco ni pantallas**:
nadie llama aún a esas funciones fuera de las pruebas, la tienda sigue sin vender y
la migración **no se ha aplicado en `adhara-dev`** (se aplicará al fusionar, como las
demás). No se instalan SDK de pagos. Las casillas solo se cierran con evidencia.

## Flujo previsto

1. El cliente elige artículos y cantidades, indica contacto y modalidad de entrega.
   El servidor consulta catálogo publicado, precio vigente y disponibilidad. No acepta
   precios, descuentos, costes de envío ni un estado «pagado» enviados por el navegador.
2. Antes de ir al banco se guarda un pedido técnico `pending_payment`, sus líneas con
   precios congelados, una referencia de intento de pago y una reserva con caducidad.
   La creación y reserva son atómicas e idempotentes. Así se puede relacionar el cobro
   con los datos del cliente aunque este no vuelva a la web.
3. El cliente introduce su tarjeta en la página del proveedor. No almacenamos número,
   CVV ni el formulario de tarjeta. Redsys por redirección es la opción recogida en
   `STATUS.md`; el proveedor definitivo y su protocolo se confirmarán con el banco.
4. La notificación servidor a servidor se autentica con el adaptador del proveedor:
   firma, comercio, terminal, entorno y tipo de operación. Después se comparan referencia,
   importe y moneda con los datos guardados. La URL de retorno solo consulta el estado;
   nunca confirma el cobro. Si la notificación tarda, muestra «confirmando el pago».
5. Una transacción bloquea el pedido/reserva, registra el cobro y pasa a `paid`,
   comprometiendo la reserva. El pedido entra en la cola operativa «Pagados por preparar».
   Se descuenta físicamente al enviar o entregar, conforme a los estados existentes.
6. El personal autorizado pasa a preparando y luego a enviado o listo para recoger.
   La entrega cierra el pedido. Cada paso registra actor, fecha y efecto de inventario.
   Los correos saldrán de una cola persistente cuando se configure el proveedor; un fallo
   de correo no debe revertir el pedido ni cobrar otra vez.

El panel distinguirá pendientes de pago de pedidos confirmados. Un intento fallido o
abandonado no aparecerá como venta pagada ni como trabajo de preparación.

## Datos de la ficha del pedido

| Bloque         | Datos que se guardarán                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Identificación | ID interno, número visible único, canal web, fecha, idioma es/ca/en                                                   |
| Cliente        | Nombre, email y teléfono; cuenta opcional, sin obligar a registrarse                                                  |
| Entrega        | Envío con dirección completa y tarifa aplicada, o recogida con ubicación                                              |
| Líneas         | ID de variante, SKU, nombre y formato comprados, cantidad, precio unitario y total en céntimos; instantánea histórica |
| Importes       | Artículos, descuentos aplicados si existen, envío, impuestos incluidos desglosados según configuración y total EUR    |
| Pago           | Proveedor, referencia de intento, transacción, importe recibido, moneda, fecha y resultado; sin datos de tarjeta      |
| Operación      | Estado, reserva, incidencias y cronología; seguimiento de envío cuando exista                                         |

Los totales se calculan y validan en servidor. La modificación posterior del catálogo
no reescribe el pedido. Costes y proveedores internos no forman parte de la ficha pública.
La lectura operativa exige `orders.view`; los datos personales exigen además
`customers.view` (el encargado `viewer` solo recibe una proyección sin datos personales).
Preparar/entregar requiere `orders.fulfill` y MFA; reembolsar, `orders.refund` y MFA.
No se expondrá una búsqueda pública por número de pedido o email. El acceso del comprador
se implementará con sesión propia o un mecanismo seguro específico para invitados.

## Reintentos e incidencias

- Clave única del evento y de la transacción por proveedor, referencia única del intento
  y bloqueos SQL: dos notificaciones simultáneas producen un único efecto de stock y
  una única confirmación. La función TypeScript por sí sola no garantiza concurrencia.
- Pago pendiente o rechazado: no confirma ni revierte uno anterior. La caducidad libera
  reservas una sola vez, bajo el mismo bloqueo que la confirmación.
- Importe o moneda distintos: registrar el cobro como incidencia; no preparar. Para
  un pedido pendiente, mostrar `needs_attention`; si ya está enviado o completado,
  conservar su estado logístico y añadir la incidencia de pago.
- Pago tardío tras liberar reserva o cancelar: revisión manual; no confirmar ni volver
  a reservar automáticamente en esta primera versión. La resolución seguirá las
  transiciones existentes, comprobando stock de nuevo dentro de una transacción.
- Segundo cobro con otra transacción: incidencia, sin segundo pedido ni descuento.
- Reintento de un cobro ya registrado: sin efectos, incluso después de enviar,
  completar o reembolsar. Los duplicados de incidencias tampoco duplicarán avisos.
- Fallo de base de datos: no acusar recibo definitivo antes del commit; permitir reintento
  y conciliación. No guardar cargas completas ni datos personales en logs.
- Reembolso: operación separada con idempotencia y conciliación; nunca marcar reembolsado
  solo porque el personal pulse un botón. Pendiente de implementar el adaptador.

## P02 — base de datos (hecho el 11/10)

Migración `20261011230000_web_orders.sql`, pgTAP `13_web_orders.test.sql` (79 pruebas),
tres casos nuevos en `scripts/test-concurrency.ts` y `tests/unit/orders-sql.test.ts`
(estados y cuadro de transiciones idénticos en SQL y en TypeScript). Decisiones §131–134.

| Tabla (`public`, con RLS)                 | Contenido                                                                                      | Lee                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------ |
| `orders`                                  | Número visible (desde 1001), idioma, estado, entrega, ubicación, importes, reserva y caducidad | `orders.view`                        |
| `order_lines` (solo inserción)            | Formato, SKU, marca, nombre, tamaño, cantidad, precio unitario y total congelados              | `orders.view`                        |
| `order_contacts`                          | Nombre, email normalizado, teléfono; columnas de dirección vacías hasta que haya envíos        | `orders.view` **y** `customers.view` |
| `order_payment_attempts` (solo inserción) | Proveedor y referencia aleatoria de 12 dígitos por ida al banco, importe y moneda              | `orders.view`                        |
| `order_payments` (solo inserción)         | Cada notificación verificada una vez: transacción, resultado, importe, decisión y motivo       | `orders.view`                        |
| `order_events` (solo inserción)           | Cronología sin datos personales: creación, intentos, cobros, incidencias, reservas y estados   | `orders.view`                        |

Nadie escribe directamente. Funciones:

- **Servidor, solo con la clave privilegiada** (`web_order_*`, §131): `web_order_create`
  calcula el importe con el PVP del catálogo publicado (ignora cualquier precio recibido),
  reserva todo o nada y es idempotente por `request_id`; `web_order_new_attempt` da una
  referencia nueva mientras la reserva siga en pie; `web_order_record_payment` decide como
  `planCardPaymentConfirmation` bajo el bloqueo del pedido y guarda cada notificación una
  sola vez; `web_order_release_expired` devuelve al stock las reservas caducadas.
- **Panel:** `admin_transition_order` aplica el cuadro de `status.ts` con su efecto de
  inventario en la misma transacción, revisión optimista, cronología y auditoría.

Comprobado en local: 12 compras simultáneas de la última unidad → un pedido; la misma
notificación 8 veces a la vez → una confirmación; cobro contra caducidad simultáneos →
o pagado con la reserva, o incidencia sin ella, con el stock cuadrado.

Límites de P02, a propósito: **envío bloqueado** (`shipping_unavailable`) hasta tener
zonas y tarifas reales; **reembolsos y cancelaciones con cobro bloqueados**
(`refund_unavailable`) hasta el adaptador del proveedor (P06); sin desglose de IVA
(pendiente de la asesoría y de la facturación); la retención de datos personales
(RGPD) se decidirá con la ficha de cliente.

## P05 — panel de pedidos (hecho el 12/10)

Web → **Pedidos web** (`/admin/pedidos`, con `orders.view`) y ficha `/admin/pedidos/[id]`;
guía para el personal en [ADMIN_OPERATIONS.md](ADMIN_OPERATIONS.md#pedidos-web). Decisión §135.

- **Listado:** vistas con recuento (abiertos por defecto, por preparar, en preparación,
  para recoger, enviados, incidencias, esperando pago, sin pagar, cerrados y todos),
  filtros por entrega y por fechas de Madrid, cliente solo con `customers.view`.
- **Ficha:** estado, entrega, fechas y total; artículos con el precio congelado; cliente
  (o un aviso sin `customers.view`); notificaciones del banco e idas al banco, sin datos
  de tarjeta; incidencias abiertas con su motivo y qué hacer (la que llevó el pedido a
  «Incidencia» se resuelve al darlo por pagado; un segundo cobro sigue abierto hasta P06);
  cronología con quién hizo cada paso.
- **Pasos:** los de `status.ts` que la sesión puede dar (`panelTransitions`), sin los del
  sistema ni los reembolsos. Entregar, enviar y «Dar por pagado» piden confirmación con
  el diálogo del sistema de diseño; la base vuelve a comprobar permiso, MFA y revisión.
- **Inicio del panel:** «Pedidos web por preparar» y, si las hay, «Incidencias de pago».
- **Pruebas:** unitarias (`orders-panel.test.ts`), sin sesión (`admin-orders-access.spec.ts`),
  recorrido autenticado contra Supabase local (`tests/integration/admin-orders.spec.ts`:
  preparar, listo, entregar con descuento de stock, resolver una incidencia, y el encargado
  sin datos del cliente ni botones) y la auditoría visual del panel con la lista y una ficha.

## Entregas de esta PR

- [x] P01 — Reglas de decisión para notificaciones ya verificadas y pruebas unitarias.
- [x] P02 — Persistencia de pedidos, líneas, contactos, intentos, eventos y reservas;
      migración con RLS, proyecciones por permiso, pgTAP y tipos generados.
- [ ] P03 — Checkout es/ca/en: contacto, entrega, resumen calculado en servidor,
      idempotencia, reserva y caducidad. Tarifas reales antes de habilitar envíos.
      La base ya crea, reserva y caduca; falta la pantalla, la llamada desde el
      servidor y la tarea programada que llame a `web_order_release_expired`.
- [ ] P04 — Adaptador del TPV, notificación autenticada, confirmación atómica,
      conciliación y pruebas oficiales de sandbox. Sin credenciales en el repositorio.
- [x] P05 — Panel → Pedidos web: listado, filtros, ficha, incidencias, preparación,
      envío/recogida y entrega; usar el sistema de diseño y permisos existentes.
- [ ] P06 — Confirmación para el comprador, cola de correo y reembolsos con su proveedor.
- [ ] P07 — Validación integrada: pago correcto/rechazado, firma falsa, importe alterado,
      duplicados concurrentes, última unidad, caducidad contra pago, pago tardío, permisos
      y ausencia de datos personales/costes en respuestas públicas; E2E móvil/escritorio.

El panel (P05) ya está hecho sin credenciales del banco. La activación de P03–P04
requiere TPV de pruebas y las decisiones comerciales. La idempotencia, autorización y
atomicidad ya están demostradas en SQL (pgTAP y concurrencia real); falta el E2E (P07).

La caducidad de reservas necesita una tarea programada frecuente (propuesta: cada 5 minutos),
que el plan Hobby de Vercel no permitía. Con el plan Pro, contratado por el usuario el 11/10
(§134), se añadirá en P03 junto al checkout, protegida con `CRON_SECRET`.

## Pendientes para activar ventas

Confirmar proveedor/TPV y configurar sus credenciales de pruebas en el entorno del
servidor, nunca por chat; decidir recogida, envíos o ambas, con zonas y tarifas reales;
confirmar tratamiento de pagos tardíos (propuesta inicial: revisión manual), facturación
y proveedor de correo. Mantener los requisitos de apertura de `STATUS.md`.

La referencia anterior a Stripe en A5 es histórica: no se elige ni instala Stripe
por defecto; se sigue el TPV previsto en el estado actual del proyecto.
