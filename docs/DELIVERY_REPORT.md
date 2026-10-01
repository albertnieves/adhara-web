# Entrega de acceso y edición de tienda — 01/10/2026

## Alcance y base

Rama `codex/admin-delivery-foundation`, sobre `f95c370` de la PR #9 (`claude/wonderful-babbage-4ojhui`). Conserva Mostrador, Compras, Reposición e Informes de Claude. El checkout original y sus cambios sin commit se preservan. La copia de seguridad anterior a integrar PR #9 permanece en el stash identificado «admin delivery before integration with Claude PR9».

Esta entrega cierra la implementación local de administración. **No da por cerrada la Fase 1 ni el acceso operativo de los titulares:** la activación de MFA, configuración de correo y prueba remota necesitan su paso final. No se ha fusionado ni desplegado a producción y no se han enviado correos reales.

## Cambios

- Toda escritura administrativa exige rol activo y MFA también por API/SQL. Las lecturas operativas sin coste conservan los permisos explícitos; ubicaciones sigue `inventory.view`, compatible con los informes R/S. Desactivar personal revoca la siguiente operación. SQL protege el último administrador activo.
- Recuperación con respuesta genérica y enlace de un solo uso, conservando MFA. Equipo permite preparar, enviar y cancelar invitaciones; el rol se asigna al confirmar Auth. Reenvío limitado por SQL y por el proveedor. Clave privilegiada solo en servidor tras autorizar `staff.manage`.
- Revisiones de PVP almacenadas, ligadas al usuario, versión y coste, caducidad de quince minutos, confirmaciones, aplicación atómica y reintento idempotente. Los lotes informan éxitos y fallos por fila. La ficha usa comparación de versión. Imagen principal atómica y única por producto.
- Recepciones y recuentos del panel llevan clave de operación: repetir el mismo formulario no duplica el movimiento. Auditoría de catálogo y publicación en la transacción del cambio.
- Portada es/ca/en y configuración de tienda con borrador, vista previa, publicación e historial. Restaurar crea una revisión nueva. Los borradores y sus archivos editoriales permanecen privados; solo la revisión publicada es pública. Dirección: Carrer de Pompeu Fabra 1, Castelldefels. Contactos y horarios sin confirmar quedan vacíos.
- Inicio enlaza a tareas pendientes de catálogo/precio/imagen/traducciones/coste y a las acciones habituales. Acceso a tienda y vista previa también en tablet/móvil.
- Docker/CLI local, plantillas de correo, tipos generados, pgTAP, concurrencia con conexiones reales y recorridos autenticados en navegador integrados en CI. [Comandos](ADMIN_LOCAL_VALIDATION.md) y [guía del panel](ADMIN_OPERATIONS.md).

## Evidencia local

Validación final ejecutada sobre el conjunto con PR #9 (`f95c370`), antes del commit.

- Esquema desde cero: dieciséis migraciones, sin datos comerciales como seed.
- pgTAP: **211 comprobaciones correctas**, seis archivos, incluidos los de Claude.
- Concurrencia real: precio (solo una revisión del mismo estado aplica), imagen (una principal), recepción (un solo incremento) y último administrador (siempre queda uno activo).
- Tipos: comparación del archivo generado con el versionado, correcta.
- `pnpm check`: lint, TypeScript, **199 tests unitarios** y build correctos.
- `pnpm test:e2e`: **102 pruebas** correctas de escritorio y móvil, incluidas rutas R/S.
- `pnpm build:local` y `pnpm test:e2e:local`: build y **5 recorridos autenticados** correctos: publicación aislada, roles, invitación y recuperación real mediante Mailpit, enlace de un solo uso y reintento tras TOTP erróneo. Anchuras de 768 y 390 px sin desbordamiento en Configuración.
- Formato, diferencias de Git y escaneo de secretos comprobados antes del commit. La ejecución remota de CI/Preview se consulta después de crear la PR; no se equipara con el resultado local.
- Los escenarios de Auth usan cuentas y correo locales. No se guardan trazas ni capturas de secretos TOTP.

## Pendientes operativos y de aceptación

E01, E02, E04, E05 y E06 tienen implementación y validación local; E03 y E07 conservan la parte operativa pendiente. La consulta real de solo lectura del 01/10 confirma `adhara-dev` saludable, diez migraciones anteriores, un `system_admin` y un `store_admin` activos, ambos sin MFA verificado. No hay productos con dos imágenes principales en ese entorno.

1. Revisar y fusionar PR #9 y después esta PR complementaria en el orden acordado. No fusionarlas automáticamente como parte del commit.
2. Configurar un entorno de Preview de la cuenta SOAPBRXND compatible con las migraciones. La Preview conectada al esquema anterior no permite validar esta versión: no tiene `store_content` ni los nuevos RPC. No confundir la protección de Vercel con el login del panel.
3. Configurar Site URL/allowlist y las plantillas de invitación/recuperación para `/auth/confirm?token_hash=…`. Configurar `SUPABASE_SECRET_KEY` solo en servidor para invitaciones. Validar el correo real sin exponer credenciales por chat.
4. Cada titular configura su propio TOTP y comprueba entrada/salida/recuperación desde su dispositivo. No duplicar cuentas ni reactivar usuarios históricos de pruebas. La pérdida de factor requiere verificación humana y un ensayo operativo separado.
5. Confirmar teléfono, correo público y horarios cuando estén disponibles. Pueden mantenerse vacíos y editarse desde Configuración.

## Aplicación y reversión

Antes de tocar un entorno con datos comerciales: comprobar qué migraciones están aplicadas, respaldo disponible y ausencia de principales duplicadas (`product_media`, rol `hero`). Nunca ejecutar `db reset` contra ese entorno. Las cuatro migraciones de esta entrega llevan prefijo `20260930220818/20/22/24`; las dos de PR #9 son posteriores. Aplicar las pendientes en orden y volver a generar/comparar tipos. Si R/S ya se aplicaron, revisar expresamente las migraciones intercaladas antes de sincronizar el historial; no reescribir las ya ejecutadas.

La migración de contenido publica únicamente los textos vigentes y la dirección confirmada. La de MFA cambia controles de acceso; las cuentas activas pueden completar el alta TOTP leyendo su propia ficha. La de precios crea tablas privadas y el índice de principal única; no modifica precios ni stock. La de invitaciones no envía correos.

El código anterior sigue usando las tablas existentes. Volver al build anterior no revierte las migraciones ni debe retirar sus controles de seguridad. El contenido se revierte restaurando y publicando una revisión. Precios mediante nueva revisión, stock con movimiento compensatorio: no borrar historiales. No eliminar el bucket editorial ni sus objetos mientras existan revisiones que los referencien. Los archivos subidos cuya operación de guardado falle pueden quedar privados sin referencia; su limpieza es una operación de mantenimiento posterior, no una eliminación automática del historial.

Límites conocidos: las revisiones de PVP y claves de inventario se conservan para auditoría/idempotencia; no hay aún política automática de purga. Los lotes usan una operación por fila y tienen el límite existente del panel. Las URLs firmadas editoriales caducan a los diez minutos. Sin checkout/pedidos online, ni métricas de ventas inventadas.
