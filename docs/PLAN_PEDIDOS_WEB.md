# Pedidos de la web y confirmación de tarjeta

Estado: **PR de trabajo, primera entrega de dominio** · 10/10/2026.

Objetivo solicitado: al pagar con tarjeta en la web, el pedido aparece automáticamente
en el panel con sus datos y queda disponible para preparar y entregar. La compra debe
quedar registrada aunque el cliente cierre la pestaña después del pago.

Esta entrega añade `planCardPaymentConfirmation` y pruebas unitarias a `modules/orders`.
Es una función de decisión pura; **todavía no cobra, verifica firmas, guarda pedidos,
reserva stock ni añade pantallas**. La tienda sigue sin checkout. No se modifica la
base remota ni se instalan SDK de pagos. Las fases siguientes se irán incorporando
a esta rama/PR y sus casillas solo se cerrarán con evidencia.

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

## Entregas de esta PR

- [x] P01 — Reglas de decisión para notificaciones ya verificadas y pruebas unitarias.
- [ ] P02 — Persistencia de pedidos, líneas, contactos, intentos, eventos y reservas;
      migración con RLS, proyecciones por permiso, pgTAP y tipos generados.
- [ ] P03 — Checkout es/ca/en: contacto, entrega, resumen calculado en servidor,
      idempotencia, reserva y caducidad. Tarifas reales antes de habilitar envíos.
- [ ] P04 — Adaptador del TPV, notificación autenticada, confirmación atómica,
      conciliación y pruebas oficiales de sandbox. Sin credenciales en el repositorio.
- [ ] P05 — Panel → Pedidos web: listado, filtros, ficha, incidencias, preparación,
      envío/recogida y entrega; usar el sistema de diseño y permisos existentes.
- [ ] P06 — Confirmación para el comprador, cola de correo y reembolsos con su proveedor.
- [ ] P07 — Validación integrada: pago correcto/rechazado, firma falsa, importe alterado,
      duplicados concurrentes, última unidad, caducidad contra pago, pago tardío, permisos
      y ausencia de datos personales/costes en respuestas públicas; E2E móvil/escritorio.

P02 y la base del panel pueden avanzar sin credenciales del banco. La activación de P03–P04
requiere TPV de pruebas y las decisiones comerciales. P01 no satisface la aceptación
de A5: la idempotencia, autorización y atomicidad reales se demostrarán en SQL y E2E.

## Pendientes para activar ventas

Confirmar proveedor/TPV y configurar sus credenciales de pruebas en el entorno del
servidor, nunca por chat; decidir recogida, envíos o ambas, con zonas y tarifas reales;
confirmar tratamiento de pagos tardíos (propuesta inicial: revisión manual), facturación
y proveedor de correo. Mantener los requisitos de apertura de `STATUS.md`.

La referencia anterior a Stripe en A5 es histórica: no se elige ni instala Stripe
por defecto; se sigue el TPV previsto en el estado actual del proyecto.
