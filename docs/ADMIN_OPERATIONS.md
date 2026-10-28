# Guía del panel de tienda

## Entrar y recuperar acceso

Abrir `/admin/acceso` en el dominio autorizado. Vercel Authentication es un control adicional anterior al login del panel cuando está habilitado.

Introducir email y contraseña. En el primer acceso, configurar la app de autenticación, escanear el QR y verificar el código TOTP. Guardar la recuperación de la app en un lugar seguro; no compartir QR, claves ni códigos por chat. Cerrar sesión al terminar en dispositivos compartidos.

«He olvidado mi contraseña» envía un enlace de un solo uso. La respuesta es igual exista o no la cuenta. Si tiene MFA configurado, se verifica ese factor antes de cambiar la contraseña. Un enlace usado o inválido permite solicitar otro.

**Pérdida del segundo factor:** contactar con el administrador responsable del proyecto por un canal previamente conocido. Este verifica la identidad fuera del panel y documenta la incidencia antes de retirar el factor perdido mediante Supabase Auth y revocar las sesiones anteriores. El titular vuelve a entrar y registra un factor nuevo. El panel no omite esta comprobación. Es un procedimiento humano pendiente de ensayo operativo; no se ha retirado MFA de cuentas reales en estas pruebas.

## Editar la tienda

Inicio → Editar portada permite modificar los textos en español, catalán o inglés. Guardar borrador conserva el contenido público. «Vista previa del borrador» muestra los cambios a la sesión autorizada. «Publicar revisión guardada» los hace visibles al público. Si se sigue escribiendo, primero hay que guardar. El historial restaura una revisión como un borrador nuevo que requiere publicar después.

La imagen editorial es opcional, admite hasta 3 MB y exige descripción y procedencia. Es privada mientras solo esté en borradores. Las revisiones conservan sus archivos; una URL firmada de una imagen publicada puede seguir funcionando hasta diez minutos después de retirarla.

Configuración → Datos de la tienda permite al administrador del sistema editar dirección, localidad, teléfono, correo, horarios y enlaces sociales. Dirección confirmada: **Carrer de Pompeu Fabra 1, Castelldefels**. Los contactos sin confirmar permanecen vacíos y ocultos. No introducir secretos ni información interna en campos que se publicarán.

## Catálogo y operaciones

Los indicadores de Inicio enlazan a filtros de precio, imagen, traducciones y coste pendientes. Guardar una ficha desactualizada devuelve conflicto: copiar primero el texto que se quiera conservar y recargar.

Para PVP: escribir, revisar, confirmar avisos y aplicar. La revisión caduca en quince minutos. Un cambio de formato o coste exige revisar otra vez. Los lotes indican fallos por fila. Reenviar la misma revisión no incrementa el precio dos veces.

Para recibir mercancía: Inventario → formato → Movimiento → Recepción, con unidades y referencia. El reintento del mismo formulario no duplica stock. Para una segunda operación intencionada con los mismos valores, cerrar y abrir el formulario. Corregir errores con movimientos compensatorios o recuentos; nunca borrando el historial. Mostrador, Compras, Reposición e Informes conservan los flujos de las fases R/S.

En el Mostrador, cada línea cobra el PVP salvo que se escriba otro precio por unidad en «Precio/ud.» (un descuento; nunca por encima del PVP). El ticket muestra el total con IVA, y las últimas operaciones, su importe. Ese precio es el que suman las ventas del control; las ventas anteriores a este cambio se estiman con el PVP.

## Perfil olfativo y catálogo olfativo

Catálogo → ficha del perfume → «Perfil olfativo». Las notas se escriben como claves separadas por comas (`bergamot, rose`); la lista «Notas disponibles» da cada clave con su nombre. Una clave que no existe no se guarda: si hace falta una nota nueva, se añade al vocabulario del código con su nombre en es, ca y en. La URL `https` de la fuente es obligatoria y las estaciones y el momento solo se marcan si la fuente los indica. El catálogo olfativo de la tienda (`/es/catalogo-olfativo`) se actualiza al guardar; no muestra precio ni compra.

## Pedidos web

Web → Pedidos web (con `orders.view`). **La tienda aún no vende online**: la cesta, el pago con tarjeta o Bizum, los correos y las devoluciones están hechos y el correo ya está configurado; la venta se enciende con el TPV real y `WEB_CHECKOUT` ([PLAN_APERTURA.md](PLAN_APERTURA.md)). Un pedido entra en «Por preparar» solo cuando el banco confirma el pago; los que esperan pago o caducaron sin pagar tienen sus propios filtros y no son trabajo de preparación. Se filtra también por forma de entrega y por fechas (días de Madrid).

- **Recogida en tienda:** «Empezar a preparar» → «Listo para recoger» → «Entregado al cliente». Al entregar, comprobar el nombre y el número de pedido; las unidades reservadas se descuentan del stock en ese momento y aparecen en Movimientos con la referencia «Pedido web» y su número.
- **Envío:** la ficha muestra la dirección y el teléfono del cliente (con `customers.view`) y el bloque «Envío»: tarifas reales, etiqueta, recogida o punto de entrega y seguimiento (ver [Envíos y transportistas](#envíos-y-transportistas)). Al salir el paquete (aviso del transportista, punto de entrega o «Marcar enviado») se descuenta el stock; al entregarse, se completa. Solo se envía a la península y Baleares.
- **Sin pagar:** mientras un pedido espera el pago, sus unidades quedan reservadas 30 minutos y después vuelven solas al stock. Para devolverlas antes (el cliente avisa de que no lo quiere, o la tienda necesita la unidad), «Liberar la reserva» en la ficha (con `orders.fulfill`): el pedido queda «Sin pagar» y el cliente ya no puede pagarlo. Si estaba pagando en el banco y el cobro llega después, el pedido pasa a incidencias.
- **Incidencias:** cobros que no cuadran (importe distinto, segundo cobro o pago llegado cuando la reserva ya había caducado o se había liberado). Revisar el cobro en el portal del banco; si es correcto, «Dar por pagado» lo pasa a «Por preparar» (vuelve a reservar las unidades si hace falta y hay stock). Si no, «Cancelar y devolver el dinero» en «Devoluciones». Un segundo cobro se devuelve con «Devolver este cobro» y deja de ser incidencia cuando el banco lo acepta.
- **Devoluciones** (con `orders.refund` y MFA, y el TPV configurado): «Cancelar y devolver el dinero» en un pedido pagado sin entregar (las unidades vuelven a la tienda), «Devolver todo» o «Devolver una parte» en uno entregado, y «Devolver este cobro» en un cobro de más. El panel pide confirmación con el importe y manda la devolución al banco: **solo cuando el banco la acepta** el pedido cambia y aparece «Devuelto». Si la rechaza, no se ha devuelto nada (se ve su código). Si no responde con claridad, o si quedó enviada más de 10 minutos sin respuesta guardada («Sin respuesta del banco»), buscarla en el portal de Redsys por la referencia del cobro (sale en «Pago», «Idas al banco») y elegir (DECISIONS §168):
  - **«Consta hecha en el portal»**: se da por hecha sin mandar nada al banco y el pedido cambia como si el banco la hubiera aceptado (si era «Cancelar y devolver», queda cancelado y las unidades vuelven a la tienda).
  - **«No consta en el portal»**: se cierra como no hecha, el pedido sigue igual y se puede pedir otra.
  - **«Volver a enviar la devolución»**: la manda otra vez; el banco nunca devuelve más de lo cobrado.

  En la ficha y en la cronología queda «Comprobado en el portal del banco» con quién lo hizo. **Mientras una devolución está abierta, el pedido no cambia de estado** («Empezar a preparar», «Marcar enviado»… no aparecen): primero la responde el banco o se resuelve así. Una petición repetida (doble envío) no se manda dos veces al banco.

- **Correos al cliente:** la confirmación del pago (con las condiciones de venta adjuntas) y los avisos de «listo para recoger» y de envío salen solos con cada paso; la ficha dice si salió cada uno. Si el correo no está configurado, esperan en la cola y salen después.
- **Permisos:** el encargado ve pedidos y artículos, pero no los datos del cliente ni los botones. Preparar y entregar exigen `orders.fulfill`; resolver una incidencia y devolver, `orders.refund`. Ver nombre, email y teléfono exige además `customers.view`.
- La ficha guarda los precios del momento de la compra, las notificaciones del banco (nunca datos de la tarjeta) y una cronología con quién hizo cada paso. Si otra persona cambió el pedido a la vez, el panel pide recargar.

### Envíos y transportistas

El cliente elige transportista al pagar y paga el envío según el peso del pedido (DECISIONS §171–177; plan en [PLAN_ENVIOS.md](PLAN_ENVIOS.md)). La recogida en la tienda sigue siendo gratis. Canarias, Ceuta y Melilla no tienen envío (IGIC y aduana).

Todo lo de los envíos está en **Web → Envíos**, con cuatro pestañas (cada una sale solo a quien tiene su permiso): **Seguimiento** (`orders.view`), **Transportistas y tarifas** y **Remitente y zonas** (`settings.manage`) y **Pesos de los formatos** (`catalog.edit`). Las direcciones antiguas (Configuración → Envíos y Catálogo → Pesos de envío) llevan a su pestaña. La etiqueta, el punto de entrega y la cancelación se hacen en la ficha de cada pedido, porque llevan la dirección del cliente.

**Envíos → Seguimiento** (`orders.view`; pedir recogidas, `orders.fulfill`), el trabajo del día:

- **Contadores** de cada etapa, en el orden del paquete: Sin etiqueta → Por entregar → Esperando (recogida pedida o dejado en un punto, hasta el primer escaneo) → De camino → Entregados (30 días), con Incidencias aparte. Pulsar uno enseña solo esa etapa.
- **Por hacer** (lo que se ve al entrar): incidencias, lo que el transportista no ha escaneado a tiempo (la recogida era otro día o el paquete lleva 2 días en el punto), pedidos pagados sin etiqueta y etiquetas por entregar. Si no hay nada, lo dice.
- **Cada fila dice qué hacer** («Pide la recogida o llévalo a un punto», «Recogida el jueves…», «Revisa el seguimiento…») y se marca en color lo que espera desde hace 2 días o más. «Nº …» abre la ficha del pedido directamente en su bloque «Envío».
- **Por entregar** va en una tarjeta por transportista con sus paquetes y el peso total; «Pedir la recogida de N paquetes» abre la recogida para todos a la vez.
- **Buscar** por número de pedido (exacto, también «Nº 1042» o «#1042») o parte del número de seguimiento, mientras se escribe; **Transportista** filtra por el de la etiqueta o, sin etiqueta, el que eligió el cliente. Los contadores cuentan con la búsqueda; «Ver todas las etapas» enseña todo junto.

**Envíos → Transportistas y tarifas** y **Envíos → Remitente y zonas** (administrador del sistema, `settings.manage` con MFA):

- **Plataforma multitransportista (Sendcloud):** con sus claves en Vercel, «Actualizar tarifas desde Sendcloud» trae los servicios de la cuenta con su **coste real** por tramo de peso, cotizado desde la tienda hasta Madrid, Sevilla y A Coruña (península) y Palma, Maó y Eivissa (Baleares), quedándose con el más alto. Los nuevos entran **apagados**. Los que entregan en un punto o una taquilla no se traen (la tienda vende entrega a domicilio). Repítelo cuando cambien las tarifas: los que la plataforma ya no ofrece se apagan. «Abrir el portal de Sendcloud» lleva a su web, para crear a mano un envío que no viene de la tienda online (por ejemplo, un paquete de 1 kg para un cliente de la tienda física) y ver etiquetas y facturas. Si Sendcloud rechaza una petición, el aviso dice su código: 401, las claves; 403, un permiso o el plan de la cuenta.
- **Remitente, embalaje y recogidas:** la dirección de la tienda para las etiquetas y las recogidas (con el código postal), el peso de la caja y el relleno (se suma a los perfumes), el peso máximo con envío, las medidas de la caja habitual (opcionales), la franja habitual de recogida y el IVA que se suma al coste (21 % por defecto). Sin estos datos no hay envío.
- **Zonas:** «Ofrecer el envío» y desde cuánto es gratis (vacío: nunca). El envío gratis solo se aplica en los servicios que cuentan para él.
- **Servicios:** cada uno con lo que ve el cliente (nombre, plazo en días laborables), un recargo opcional con IVA, las zonas, si cuenta para el envío gratis, el teléfono de recogidas (para los transportistas que no las admiten por la plataforma) y «Ofrecer este servicio en la tienda». **Para encenderlo o apagarlo basta el botón «Encender» / «Apagar» de su fila en la lista**; el aviso dice si aún falta «Ofrecer el envío» en su zona. En su ficha (pulsando el nombre) están los tramos: peso, coste sin IVA y precio al cliente, y se cambian el nombre, el plazo, el recargo y las zonas. **Antes de activar uno, confirma con el transportista que acepta perfumes** (llevan alcohol: mercancía peligrosa UN1266, clase 3) y en qué servicios; a Baleares, mejor uno que vaya por barco.
- **Servicio manual** («Añadir un servicio manual», al final de Transportistas y tarifas): para un contrato propio sin API (o mientras llega la plataforma). Se escriben los tramos («hasta» tantos gramos y su coste sin IVA) y el enlace de seguimiento con `{tracking}`; la etiqueta se hace en la web del transportista.

**Envíos → Pesos de los formatos** (`catalog.edit`): los gramos de cada formato con su caja, pesados en la tienda. Un formato sin peso no se puede enviar (la cesta solo se recoge en la tienda). «Rellenar los vacíos por tamaño» copia el peso de un frasco de cada tamaño a los formatos sin peso; revisa los de frasco o caja distintos antes de guardar.

**En la ficha del pedido**, bloque «Envío» (`orders.fulfill`; la etiqueta lleva la dirección, así que también `customers.view`):

1. Lo que eligió el cliente, lo que pagó y el peso calculado.
2. **«Ver tarifas reales»:** lo que cobra ahora la plataforma por este paquete a esta dirección, con todos los servicios: coste sin IVA, con IVA y la diferencia con lo cobrado (con `pricing.view_cost`). Cambia el peso si el paquete pesa distinto.
3. **«Crear etiqueta»** en la fila del servicio (normalmente el que eligió el cliente): la compra en la plataforma al momento, guarda su coste y el pedido pasa a «Preparando». Después, **«Descargar etiqueta»** en A6 (impresora de etiquetas) o A4. Si te equivocas, **«Cancelar la etiqueta»** antes de que la recojan. Con un servicio manual, «Apuntar envío» con el número de seguimiento.
4. **Entregarlo al transportista:**
   - **Recogida en la tienda:** día y franja. «Pedirla por la plataforma» si el transportista la admite (Correos, Correos Express, DHL Parcel Iberia, UPS, FedEx; mejor con dos días laborables de margen). Si no (SEUR, GLS…), llama al teléfono de recogidas del servicio y apúntala con «La he pedido por teléfono o en su web». En **Envíos → Seguimiento** se pide una sola recogida para todas las etiquetas pendientes del mismo transportista.
   - **Punto de entrega:** «Buscar puntos cerca de la tienda» lista los del transportista a menos de 5 km con su horario de hoy. Al dejarlo, «Lo he dejado en el punto»: el pedido pasa a «Enviado» y el cliente recibe el correo con el seguimiento.
5. **Seguimiento automático:** con el aviso de la plataforma configurado, cuando el transportista escanea el paquete el pedido pasa solo a «Enviado» (con el correo y el enlace de seguimiento) y, al entregarlo, a «Completado». Las incidencias (ausente, dirección, devuelto) salen en la cronología y en Envíos → Seguimiento. «Marcar enviado» sigue disponible a mano, con el seguimiento de la etiqueta ya puesto.

## Mensajes

Web → Mensajes (con `messages.view`). Cada consulta de un cliente es una conversación: las que llegan por el formulario de contacto de la web y por email, con su número («Consulta nº 1001»). **El formulario de la web aún está apagado** (`CONTACT_FORM`): se enciende cuando la asesoría revise la privacidad y esté configurado el correo (PLAN_BANDEJA_MENSAJES, «Para encenderlo»).

- **Vistas:** «Por responder» (el cliente espera; por defecto), «Esperando al cliente» (ya contestada), «Asignadas a mí», «Resueltas», «Spam» y «Todas». «Fuera de plazo» marca las que llevan más de 24 horas sin respuesta; el inicio del panel las cuenta en «Mensajes por responder».
- **Responder:** en la ficha, escribir la respuesta (o elegir una plantilla, que rellena el texto y se puede cambiar) y «Enviar respuesta». Sale por email en el idioma de la conversación, con la firma de la tienda y el último mensaje del cliente citado debajo; no hace falta despedirse con la firma. La conversación pasa a «Esperando al cliente» y la ficha dice si el correo salió. Si el correo no está configurado, la respuesta se guarda y sale cuando lo esté.
- **Cuando el cliente contesta** a ese correo, su contestación aparece en la misma conversación y vuelve a «Por responder» (con el subdominio de respuestas configurado; si no, llega al email de la tienda). Si contesta desde otra dirección, se abre una conversación nueva. Los adjuntos no se guardan: la ficha dice cuántos traía; si hacen falta, pedirlos por otra vía.
- **Nota interna:** la ve solo el personal (para dejar dicho qué se ha hecho o qué falta). No cambia el estado ni el plazo.
- **Gestión:** «Marcar como resuelta», «Es spam» y «Reabrir»; asignar a una persona del personal que pueda responder; enlazar el pedido por su número (el formulario lo enlaza solo si el email es el del pedido). «Borrar conversación» (con `customers.manage`) la borra entera, con sus datos: para spam o cuando el cliente pide que borremos sus datos.
- **Plantillas** (Mensajes → Plantillas): título, idioma y texto de las respuestas frecuentes (envíos, devoluciones de perfumes precintados, disponibilidad). Una apagada no aparece al responder.
- **Permisos:** el encargado ve las conversaciones y los mensajes, pero no el nombre ni el email del cliente, ni puede responder. Responder, anotar, asignar y las plantillas exigen `messages.reply` con MFA. Si otra persona cambió la conversación a la vez, el panel pide recargar.

## Suscriptores a promociones

Web → Suscriptores muestra las altas de la sección «Club L’Atelier» de la tienda (con `customers.view`), su idioma, fecha y estado: pendiente, en Sender o baja. «Exportar CSV» descarga la lista para importarla en Sender o abrirla en Excel. Con `customers.manage` (MFA) se puede dar de baja o borrar (derecho de supresión); si Sender está conectado, el cambio se hace también allí.

Para conectar Sender: crear en Sender un token de API (Settings → API access tokens) y, si se quiere, un grupo «Web»; en Vercel, solo servidor, `SENDER_API_TOKEN` y `SENDER_GROUP_ID` (el id del grupo). Desde entonces cada alta se envía a Sender al momento; las que fallen quedan pendientes y se envían con «Enviar pendientes a Sender». Las campañas se preparan y envían en Sender; los códigos de descuento que llevan se crean en [Códigos de descuento](#códigos-de-descuento). Las bajas que la gente haga desde el enlace de los correos quedan en Sender. No pegar el token en el chat.

## Códigos de descuento

Web → Códigos de descuento (administradores, `promotions.manage` con MFA). Sirven para dar descuentos exclusivos en las campañas del club de Sender:

1. **Nuevo código:** el texto (letras, números y guiones; «Sugerir uno» propone uno difícil de adivinar, como `CLUB-7K3Q9M`), una nota interna, el descuento (porcentaje del 1 al 90 % o importe fijo de 1 € a 1.000 €) y, si se quieren, compra mínima, fechas (hora de Madrid), usos máximos, «Un uso por email» (marcado por defecto) y «No aplicar a perfumes rebajados».
2. **En Sender:** escribe el código en la campaña con sus condiciones (descuento, hasta cuándo, compra mínima y si es de un uso por persona). Es lo que exigen las condiciones de venta.
3. **En la tienda:** el cliente lo escribe en «Finalizar compra» → «Aplicar» y ve el descuento en el resumen antes de pagar. El banco cobra el total con descuento. La ficha del pedido enseña el código y lo descontado.

Reglas: un código por pedido; el descuento es sobre los artículos, nunca sobre el envío; el envío gratis «desde» se calcula con el descuento ya aplicado; un importe fijo exige un pedido de más de ese importe. Cuentan como usos los pedidos pendientes de pago y los cobrados; un pedido que caduca sin pagar, se cancela o se devuelve entero devuelve su uso. La lista enseña los usos, los pedidos cobrados y lo descontado en ellos.

El texto de un código no cambia una vez creado (los pedidos lo guardan): para otra campaña, crea otro. Para retirarlo, desmarca «Activo»; los pedidos ya hechos no cambian. Un código compartido vale para cualquiera que lo tenga: si no debe circular, limita los usos o las fechas.

**Devolver un artículo de un pedido con código:** con «Devolver una parte», devuelve el precio del artículo menos la parte proporcional del descuento (por ejemplo, con un 10 %, de un perfume de 49,90 € se devuelven 44,91 €). Así lo dicen las condiciones de venta.

## Consola del titular (control del negocio y del proyecto)

Solo para el titular: permiso `business.control` con MFA y estar en la lista de titulares (`internal.control_owners`, solo por SQL). Cualquier otra cuenta, también otro administrador del sistema, recibe 404. «Control del negocio», en el pie del menú del panel, abre `/admin/control`; «Panel de la tienda» vuelve al panel. Es una consola oscura **solo para ordenador** (desde 1280 px de ancho): en una pantalla más estrecha, la misma dirección muestra un aviso.

- **Resumen:** primero las alertas (perfumes en rotura o con menos de 14 días de cobertura, tareas y entregas vencidas, copia atrasada o fallida, migraciones sin aplicar, variables sin configurar e incidencias graves de datos), después el negocio del mes con 12 meses de evolución, lo que sube y baja, lo más visto en 7 días, el proyecto, lo urgente y las próximas entregas.
- **Ventas y beneficio:** mes a mes (6, 12 o 24 meses) unidades, ventas con y sin IVA, coste de lo vendido, margen, costes del negocio, beneficio y compras recibidas, y lo más vendido. Lo estimado con el PVP y las unidades sin coste se señalan: registra los costes que falten en Catálogo o al recibir un pedido.
- **Productos:** cada perfume con movimientos en las últimas 26 semanas, con buscador, filtros (marca, tendencia, clase ABC, existencias) y orden por cualquier columna: disponible, unidades de 4 y 12 semanas con su minigráfico, tendencia, ritmo por semana (solo cuenta los días con existencias, así una rotura no lo baja), previsión a 28 días con su intervalo, cobertura en días, ventas sin IVA, margen y visitas de 30 días. Las cifras de arriba llevan a los perfumes en rotura y con poca cobertura.
- **Ficha de un producto:** por 12, 26 o 52 semanas o por días (90): unidades, existencias al cierre, cobrado y visitas por tramo; tendencia, patrón de demanda, variabilidad, unidades perdidas por roturas, margen realizado y descuento medio; cada formato por separado; y los cambios de PVP y coste con lo que se vendió antes y después.
- **Atención:** visitas a la ficha y a la ficha olfativa y aperturas de la animación 3D por perfume (7, 30 o 90 días, con el cambio frente al periodo anterior), conversión y «Mucho interés, pocas ventas». Mientras la web no esté indexada, hay pocas visitas y parte son del equipo. Los carritos abandonados llegarán con el checkout.
- **Costes:** gastos fijos o puntuales sin IVA, del negocio (alquiler, asesoría, suministros…: restan del beneficio) o del proyecto (dominio, alojamiento, servicios…). Mensual, anual (se carga cada año en el mes de inicio) o puntual. Cuando un coste deja de pagarse, ponle fecha de fin en vez de borrarlo, para que siga contando en los meses pasados.
- **Tareas:** con área, estado, prioridad, responsable (yo, cliente u otra persona) y fecha límite. «Hecha» la cierra desde la lista; las hechas se ven en «Hechas».
- **Entregas:** cada entrega al cliente con su estado, fechas, referencia (PR o enlace), importe sin IVA y facturación (por facturar, facturada, cobrada, no se factura o sin decidir).
- **Estado:** entorno, región y commit; tamaño de la base frente a los 500 MB del plan Free; migraciones del código sin aplicar; variables de entorno (solo si están, nunca su valor); tablas más grandes, cuentas, archivos, informe diario, suscriptores y visitas.
- **Copias:** la copia diaria se guarda cada noche en un bucket privado durante 30 días; «Descargar copia ahora» baja una al momento. Cada copia lleva su tamaño, filas, tablas y huella SHA-256, y se descarga desde el registro. Con `SUPABASE_BACKUPS_TOKEN` en Vercel se ven también las copias de la plataforma Supabase. La pantalla explica qué no cubre (fotos, cuentas) y cómo probar una restauración en local con `scripts/restore-backup.ts --dry-run`.
- **Asistente:** llamadas, tokens y coste estimado en dólares por día, persona, uso y modelo (7, 30 o 90 días), y el límite diario por persona.
- **Calidad de datos:** formatos sin PVP, perfumes sin imagen, existencias que no cuadran con los movimientos, formatos sin coste, traducciones que faltan, borradores con existencias, EAN repetidos, imágenes provisionales, perfiles olfativos vacíos, formatos sin SKU y procedencia por revisar, por gravedad y con enlace a la ficha. Se completa siempre con su fuente.

## Moverse por el panel

En escritorio, el menú lateral agrupa las secciones (Tienda, Web, Análisis y Administración) y tiene su propio desplazamiento si no cabe en alto. En tablet vertical y móvil, «Menú» abre un panel con las mismas secciones, la vista previa y la tienda pública; se cierra con la ×, con Esc o tocando fuera.

Las acciones de inventario (Movimiento, Recuento y Alerta) se abren en un panel lateral con el perfume, el formato y las unidades actuales. Al guardar, el panel se cierra y aparece un aviso abajo con el resultado; si algo falla, el error queda en el formulario. Catálogo e inventario filtran mientras se escribe en el buscador. La ficha de un perfume tiene una barra fija para saltar a Formatos y PVP, Stock, Datos, Imágenes y Textos.

## Asistente e informe diario

Panel → Asistente muestra el informe del día: qué hay que hacer (cada línea enlaza a su pantalla), la actividad (entradas, ventas, devoluciones, mermas, ajustes y traslados en unidades), los agotados y el stock bajo según el vigilante, y los pedidos de compra abiertos o con la entrega vencida. «Hoy» se calcula en directo; cada mañana la tarea programada guarda el del día anterior con un resumen redactado por el asistente, que también aparece en Inicio. El informe no lleva costes, importes ni nombres de proveedor, y cada persona solo ve las tareas de las pantallas a las que tiene acceso. Los administradores pueden guardarlo a mano («Guardar informe» o «Guardar con resumen», hasta 10 al día por persona).

«Pregunta al asistente» responde con los datos reales del panel: stock, movimientos, reposición, ventas en unidades de un periodo y pendientes del catálogo, según los permisos de quien pregunta. Solo consulta: no registra movimientos, no cambia precios ni crea pedidos; indica en qué pantalla hacerlo. Si no tiene un dato, lo dice. Cada persona tiene un tope de consultas al día (40 por defecto) y cada consulta queda registrada con sus tokens.

Para activarlo hacen falta, solo en el servidor de Vercel: `ANTHROPIC_API_KEY` (clave de la cuenta de Anthropic del negocio), `CRON_SECRET` (valor aleatorio largo; Vercel lo envía a la tarea programada) y `SUPABASE_SECRET_KEY`. Sin la clave de Anthropic el informe funciona igual, sin resumen, y el chat aparece como «no activado». Las claves se configuran en Vercel, nunca en el chat ni en el repositorio.

## Equipo

Solo `system_admin` gestiona el equipo. «Invitar a una persona» envía un enlace para fijar contraseña y configurar MFA. Elegir el rol mínimo necesario. «Dar acceso a una cuenta existente» requiere una cuenta ya creada y confirmada. Para reenviar, introducir los mismos datos tras un minuto; también se aplican los límites del servicio de correo.

Cancelar la invitación pendiente elimina la asignación futura de rol. El enlace puede confirmar la cuenta de Auth, pero no le concede acceso al panel. Desactivar personal impide su siguiente operación aun con sesión previa. La base impide dejar el sistema sin administrador activo.

`store_admin` gestiona la operación y la portada; no Equipo ni configuración general. `viewer` no edita ni recibe costes.
