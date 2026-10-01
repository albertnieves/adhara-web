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

## Equipo

Solo `system_admin` gestiona el equipo. «Invitar a una persona» envía un enlace para fijar contraseña y configurar MFA. Elegir el rol mínimo necesario. «Dar acceso a una cuenta existente» requiere una cuenta ya creada y confirmada. Para reenviar, introducir los mismos datos tras un minuto; también se aplican los límites del servicio de correo.

Cancelar la invitación pendiente elimina la asignación futura de rol. El enlace puede confirmar la cuenta de Auth, pero no le concede acceso al panel. Desactivar personal impide su siguiente operación aun con sesión previa. La base impide dejar el sistema sin administrador activo.

`store_admin` gestiona la operación y la portada; no Equipo ni configuración general. `viewer` no edita ni recibe costes.
