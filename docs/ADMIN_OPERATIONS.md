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

## Suscriptores a promociones

Web → Suscriptores muestra las altas de la sección «Club L’Atelier» de la tienda (con `customers.view`), su idioma, fecha y estado: pendiente, en Sender o baja. «Exportar CSV» descarga la lista para importarla en Sender o abrirla en Excel. Con `customers.manage` (MFA) se puede dar de baja o borrar (derecho de supresión); si Sender está conectado, el cambio se hace también allí.

Para conectar Sender: crear en Sender un token de API (Settings → API access tokens) y, si se quiere, un grupo «Web»; en Vercel, solo servidor, `SENDER_API_TOKEN` y `SENDER_GROUP_ID` (el id del grupo). Desde entonces cada alta se envía a Sender al momento; las que fallen quedan pendientes y se envían con «Enviar pendientes a Sender». Las campañas y los descuentos se preparan y envían en Sender. Las bajas que la gente haga desde el enlace de los correos quedan en Sender. No pegar el token en el chat.

## Control del negocio y del proyecto

Solo para el administrador del sistema con MFA (permiso `business.control`): «Control del negocio», en el pie del menú del panel, abre `/admin/control`, una sección aparte con su propio menú. «Panel de la tienda» vuelve al panel.

- **Resumen:** ventas sin IVA, margen bruto, costes y beneficio del mes con su evolución en 12 meses; tareas abiertas, vencidas y que esperan al cliente; lo pendiente de cobrar y el balance del proyecto; lo urgente y las próximas entregas.
- **Ventas y beneficio:** mes a mes (6, 12 o 24 meses) unidades, ventas con y sin IVA, coste de lo vendido, margen, costes del negocio, beneficio y compras recibidas, y lo más vendido. Lo estimado con el PVP y las unidades sin coste se señalan: registra los costes que falten en Catálogo o al recibir un pedido.
- **Costes:** gastos fijos o puntuales sin IVA, del negocio (alquiler, asesoría, suministros…: restan del beneficio) o del proyecto (dominio, alojamiento, servicios…). Mensual, anual (se carga cada año en el mes de inicio) o puntual. Cuando un coste deja de pagarse, ponle fecha de fin en vez de borrarlo, para que siga contando en los meses pasados.
- **Tareas:** con área, estado, prioridad, responsable (yo, cliente u otra persona) y fecha límite. «Hecha» la cierra desde la lista; las hechas se ven en «Hechas».
- **Entregas:** cada entrega al cliente con su estado, fechas, referencia (PR o enlace), importe sin IVA y facturación (por facturar, facturada, cobrada, no se factura o sin decidir).

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
