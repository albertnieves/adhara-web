# Siguiente entrega — Administración autónoma de la tienda v1

Fecha: 30/09/2026. Estado: **plan preparado; implementación pendiente**.

Base comprobada: `main` en `effd7091f43417f0910ae8d93587e35711c5fdbf`.
La copia local está en `7b1b000`, rama `codex/phase-1-foundations`, con cambios sin confirmar. Este documento es la única incorporación de esta tarea; no acredita cambios funcionales ni configura servicios.

## 1. Resultado que debe entregar

Albert y Agustín pueden acceder con sus propias cuentas y gestionar catálogo, precios, imágenes, inventario y contenido editorial sin editar código ni entrar habitualmente en Supabase. Cada cambio sensible tiene permisos, confirmación cuando corresponde y un registro verificable. Una edición simultánea no sobrescribe silenciosamente otra.

Demostración final: Agustín entra con MFA, modifica un producto, revisa un cambio de PVP, registra una recepción y publica un cambio de portada. Albert puede gestionar el acceso del personal. Un usuario de consulta no puede escribir ni consultar costes. Un visitante ve únicamente el contenido publicado.

Esta entrega avanza A1, A2, A3 y una parte acotada de A8. **No declara completada toda la Fase 1**: su cierre exige comprobar separadamente cada criterio de `docs/source/FASE_1_PLAN.md` y registrar las excepciones aprobadas en decisiones.

## 2. Qué aprovechamos y qué mejora

| Área          | Base existente en el remoto                                   | Mejora de esta entrega                                                                |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Acceso        | Login, alta/verificación TOTP, roles y guardas                | Incorporación real, recuperación y flujo de invitación desde Equipo                   |
| Autorización  | Guardas de servidor y RLS; MFA SQL solo en ciertos permisos   | MFA para las operaciones administrativas de escritura, también por API directa        |
| Catálogo      | Productos, variantes, textos es/ca/en, imágenes y publicación | Pendientes por producto, conflictos de edición y cambio de imagen principal atómico   |
| Precios       | Costes, margen, PVP individual y cambios masivos              | Aplicar exactamente la revisión aprobada; detectar cambios concurrentes y reintentos  |
| Inventario    | Recepciones, ventas en tienda, ajustes e historial            | Validar el recorrido diario y la respuesta a doble envío, sin construir un TPV nuevo  |
| Contenido web | Portada y textos generales ligados al código                  | Editor acotado de portada y datos de tienda, con borrador, vista previa y publicación |
| Calidad       | CI general y pruebas manuales autenticadas documentadas       | Base local reproducible, pgTAP en CI y recorridos autenticados automáticos            |

Se mantienen Next.js, Supabase, next-intl, pnpm, Node de `.nvmrc`, las versiones fijadas y la separación de módulos. No hace falta incorporar un CMS externo ni un constructor visual para cumplir el alcance.

## 3. Alcance y límites de la entrega

Incluido:

- Acceso en `/admin/acceso`, MFA, recuperación y gestión de invitaciones.
- Roles existentes: `system_admin`, `store_admin` y `viewer`.
- Correcciones de permisos, concurrencia y trazabilidad necesarias para operar.
- Portada: título, subtítulo, texto introductorio, llamada a la acción y una imagen editorial opcional, en es/ca/en; reutilizar el diseño actual.
- Datos de tienda: contacto, dirección, horarios y enlaces sociales. Separar los campos públicos de cualquier configuración interna.
- Selección y orden de productos destacados reutilizando el catálogo existente.
- Borrador, vista previa, publicación explícita e historial de revisiones de contenido.
- Comprobación de escritorio y tablet, estados vacíos, errores y mensajes de resultado.

Fuera de esta entrega: checkout, cobros, pedidos, clientes, WhatsApp, agente de IA, proveedores/compras completos, integración TPV, nuevas escenas 3D y rediseño visual integral. Tampoco incluye abrir producción al público. El contenido nuevo se incorpora desde textos e imágenes reales aprobados.

## 4. Secuencia de ejecución

`E01 → E02 → E03 → E04 → E05 → E06 → E07`

Las pruebas se añaden junto a cada bloque. E07 reúne la evidencia de entrega, no pospone la verificación hasta el final. Cada bloque se desarrolla en una rama `codex/` desde la base actualizada y deja un PR de alcance revisable. Si E05 o E06 requieren más de un PR, separar modelo/servidor e interfaz sin publicar una pantalla incompleta como funcional.

### E01 — Base actualizada y entorno reproducible

Prioridad: P0. Tamaño relativo: S. Dependencias: ninguna. Rama propuesta: `codex/admin-delivery-foundation`.

- [ ] Inspeccionar los worktrees adjuntos y reutilizar uno libre adecuado; si no existe, crear uno gestionado desde el último `origin/main`.
- [ ] Preservar los cambios locales existentes. No hacer reset, limpieza ni aplicar automáticamente las once migraciones locales antiguas sobre el esquema remoto.
- [ ] Comparar las migraciones locales con las diez del remoto y documentar qué trabajo ya fue sustituido. Trasladar solo lo que siga siendo necesario.
- [ ] Incorporar este plan a la base actualizada y corregir las referencias obsoletas de README, STATUS, DEVELOPMENT y ADMIN_PLAN.
- [ ] Comprobar Node/pnpm, instalación con lockfile, Docker y Supabase local. La CLI de Docker existe en esta máquina; su daemon no se pudo consultar desde el entorno restringido de la revisión.
- [ ] Preparar configuración local compatible con las migraciones vigentes, tipos y datos de referencia mínimos. Las cargas comerciales de `supabase/data` no se ejecutan como fixtures.
- [ ] Ejecutar las comprobaciones base y anotar los fallos previos, si los hay.

Aceptación: checkout actual aislado, cambios del usuario preservados, migraciones aplicables desde cero y comandos de desarrollo documentados. Si Docker no está disponible, resolverlo antes de validar cambios SQL; nunca presentar una lectura estática como prueba ejecutada.

Archivos orientativos: `supabase/config.toml`, scripts de package.json si son necesarios, documentación y configuración de CI. No copiar sin revisión el config.toml local antiguo.

### E02 — Permisos y MFA coherentes en aplicación y base de datos

Prioridad: P0. Tamaño: M. Depende de E01. Rama: `codex/admin-mfa-enforcement`.

- [ ] Definir y probar la regla: toda escritura administrativa requiere personal activo y sesión `aal2`.
- [ ] Revisar RLS y RPC de catálogo, contenido, imágenes, Storage e inventario, además de las de precios y equipo ya protegidas.
- [ ] Permitir con `aal1` únicamente la información mínima y acciones necesarias para completar el acceso; revisar por separado las lecturas internas y conservar las lecturas públicas legítimas.
- [ ] Mantener alineadas la matriz TypeScript, los permisos SQL y sus pruebas. Introducir migraciones nuevas; no reescribir las ya aplicadas.
- [ ] Comprobar que desactivar personal impide la siguiente operación aun con un token anterior válido.
- [ ] Revisar las funciones privilegiadas, el aislamiento de costes y el uso de la clave de servidor; las operaciones ordinarias usan la sesión del usuario.

Aceptación: peticiones directas a la API con sesión `aal1` no modifican productos, media ni stock; `viewer` no escribe ni ve costes; los administradores con `aal2` conservan sus permisos. El alta de MFA sigue funcionando sin bloqueos circulares.

Archivos principales: `src/modules/auth/domain/permissions.ts`, `src/modules/auth/server/session.ts`, migraciones nuevas y `supabase/tests/database/`.

### E03 — Acceso completo para Albert y Agustín

Prioridad: P0. Tamaño: M. Depende de E02. Rama: `codex/admin-access-lifecycle`.

- [ ] Verificar las cuentas y roles existentes antes de crear o invitar a nadie. No duplicar usuarios ni volver a ejecutar bootstrap sobre cuentas ya preparadas.
- [ ] Comprobar el acceso al despliegue: Vercel Authentication y el login propio son controles diferentes. Preparar una vía de acceso del colaborador compatible con la cuenta del usuario; no abrir la web como efecto secundario.
- [ ] Configurar Site URL, Redirect URLs y las plantillas de invitación/recuperación para `/auth/confirm` con `token_hash`, sobre el entorno elegido.
- [ ] Añadir «He olvidado mi contraseña» y el envío de recuperación con respuesta genérica y límites de frecuencia. Comprobar enlaces usados, caducados y destinos permitidos.
- [ ] Completar Equipo: invitar, reenviar con límites, mostrar estado pendiente y desactivar acceso. Solo `system_admin` con MFA puede actuar; el secreto de Auth queda en servidor y fuera de las respuestas.
- [ ] Mantener el control para no dejar el sistema sin administrador activo; verificar que el control exista también en SQL.
- [ ] Añadir guía breve para configurar TOTP y un procedimiento verificado de recuperación ante pérdida del segundo factor. No implementar un botón que quite MFA sin verificar identidad.
- [ ] Completar el alta de MFA de las cuentas reales con cada titular y comprobar el acceso desde su dispositivo.

Aceptación: Albert y Agustín entran, salen y recuperan contraseña; una cuenta sin rol no accede; las invitaciones son verificables y no elevan permisos por parámetros manipulados. La pérdida de MFA tiene un procedimiento operativo documentado.

La implementación y los tests del envío se realizan con correo local. No enviar invitaciones reales ni mensajes a terceros como parte de la preparación del plan: los envíos se ejecutan cuando se haya pedido expresamente invitar a sus destinatarios o desde la acción del administrador.

Archivos: `src/app/admin/acceso/`, nueva ruta de recuperación, `src/app/auth/confirm/route.ts`, `src/modules/auth/server/`, pantalla Equipo y tests de Auth.

### E04 — Ediciones y precios fiables

Prioridad: P0. Tamaño: L. Depende de E02; se entrega después de E03. Rama: `codex/admin-safe-edits`.

- [ ] Conservar en servidor una revisión de precios ligada al usuario, variantes, valores/versiones originales, propuesta, advertencias y caducidad.
- [ ] Al aplicar, volver a autorizar y validar. Si cambió el precio, el coste que justifica la revisión o cualquier dato relevante, exigir una nueva revisión; no recalcular silenciosamente una propuesta distinta.
- [ ] Aplicar comparación y actualización en una operación atómica. Definir un resultado por fila para los lotes: aplicada, omitida o en conflicto, sin informar éxito global cuando hubo fallos.
- [ ] Evitar que reintentar la misma operación vuelva a incrementar el precio. Añadir identificación de operación y estado consumido de la revisión.
- [ ] Llevar el control de versión también al PVP individual y a la edición de la ficha para evitar sobrescrituras silenciosas.
- [ ] Registrar el cambio y su auditoría en la misma transacción cuando ambos están en la base. Preservar el historial de PVP y las reglas actuales de precio anterior.
- [ ] Hacer atómico el cambio de imagen principal y validar que pertenece al producto. Una operación fallida no deja el producto sin imagen principal.
- [ ] Revisar dobles envíos en recepciones y ajustes. Comprobar que la operación de inventario no se duplica al repetir la misma petición.
- [ ] Mostrar mensajes accionables: qué se guardó, qué entró en conflicto y cómo volver a revisar.

Aceptación de concurrencia: una revisión de 50 € → 55 € no aplica 66 € si otra sesión cambió antes el precio a 60 €. Repetir el envío no cambia el precio otra vez ni duplica stock. Dos cambios simultáneos de imagen no producen dos principales.

Archivos: `src/modules/catalog/server/actions.ts`, `bulk-pricing.ts`, interfaces de edición y de revisión, `src/modules/inventory/server/`, migraciones y pruebas de integración.

### E05 — Editor de portada y datos de tienda

Prioridad: P1, obligatorio para el valor de esta entrega. Tamaño: L. Depende de E02 y E04. Rama: `codex/admin-store-content`.

- [ ] Crear `modules/content` con API pública separada para servidor y cliente; `app/` compone rutas e interfaces.
- [ ] Modelar contenido por idioma y revisiones. El público solo lee la revisión publicada; el borrador y la auditoría no se serializan en respuestas públicas.
- [ ] Crear `/admin/contenido` para portada y textos y `/admin/configuracion` para datos generales de tienda, respetando los roles existentes.
- [ ] `store_admin` puede editar/publicar contenido editorial mediante permisos explícitos. `settings.manage` continúa reservado a `system_admin`; no ampliar ese permiso para simplificar la interfaz.
- [ ] Cargar como primera revisión los textos reales vigentes, preservando es/ca/en. Los estados vacíos no generan contenido comercial ficticio.
- [ ] Ofrecer Guardar borrador, Vista previa y Publicar. Avisar al salir con cambios pendientes y mostrar quién modificó y cuándo.
- [ ] Reutilizar el Draft Mode existente, con autorización en servidor y caché privada. Añadir vista previa accesible desde tablet.
- [ ] Conectar home y footer a la lectura pública del contenido publicado. Invalidar únicamente las páginas afectadas después de publicar.
- [ ] Mantener las nuevas imágenes editoriales en almacenamiento privado mientras sean borradores. Exigir procedencia y texto alternativo antes de publicarlas.
- [ ] Permitir restaurar una revisión anterior como un borrador nuevo que se revisa y publica; conservar el historial.

Aceptación: cambiar el título español de portada y guardar no altera la web pública; la vista previa sí lo muestra; publicar lo hace visible sin desplegar código. Catalán e inglés conservan su contenido. Un visitante no obtiene borradores con cookies o parámetros manipulados.

Modelo y migraciones deben seguir las habilidades pertinentes de Supabase, con RLS y pgTAP desde el primer cambio. No admitir HTML arbitrario ni configuración técnica del servidor en estos formularios.

### E06 — Inicio del panel orientado al trabajo pendiente

Prioridad: P1. Tamaño: M. Depende de E04 y E05. Rama: `codex/admin-daily-work`.

- [ ] Mostrar tareas obtenidas de datos reales: formatos sin PVP, costes pendientes solo para quien pueda verlos, productos sin imagen, traducciones pendientes, borradores y stock bajo.
- [ ] Cada indicador enlaza al filtro o ficha correspondiente. Distinguir datos ausentes de un error de lectura del servicio.
- [ ] Añadir accesos directos a editar catálogo, revisar precios, recibir mercancía y editar portada.
- [ ] Hacer visibles «Ver tienda» y «Vista previa» también en tablet; actualmente esos accesos del lateral se ocultan en tamaños pequeños.
- [ ] Verificar navegación por teclado, foco, errores por campo y operación en una anchura de tablet de 768 px y móvil de 390 px.
- [ ] Crear una guía operativa breve: entrar, recuperar acceso, editar un perfume, revisar PVP, recibir stock, publicar contenido y retirar acceso.

Aceptación: desde Inicio, el usuario llega a cada tarea principal en un máximo de dos navegaciones; los indicadores respetan permisos y coinciden con consultas de control. No incluir métricas de ventas hasta que existan datos y definición verificables.

### E07 — Evidencia, validación real y entrega

Prioridad: P0. Tamaño: M. Depende de todos los anteriores. Rama: `codex/admin-delivery-validation`.

- [ ] Ejecutar migraciones en una base local vacía y pgTAP en CI; verificar diferencias de tipos generados.
- [ ] Automatizar login, MFA, recuperación y edición con usuarios de prueba locales; no reactivar cuentas históricas ni cargar datos ficticios en la tienda real para facilitar las pruebas.
- [ ] Ejecutar el recorrido por rol y las pruebas de concurrencia descritas abajo.
- [ ] Validar una Preview de la cuenta del usuario, sin conectarla por accidente a una futura base de producción.
- [ ] Revisar el recorrido final con las cuentas reales. Las modificaciones de negocio de esta demostración se eligen expresamente; el resto de pruebas queda en el entorno aislado.
- [ ] Adjuntar al PR evidencias, migraciones, comandos ejecutados, limitaciones y procedimiento de reversión.
- [ ] Actualizar STATUS y ADMIN_PLAN con lo implementado y probado. Crear un informe de cierre de esta entrega, manteniendo la lista de criterios aún abiertos de Fase 1.

Aceptación: toda la lista obligatoria está comprobada. Si falta la validación con titulares de las cuentas o la de un servicio, registrar ese punto como pendiente; no sustituirlo por una afirmación basada en mocks.

## 5. Matriz mínima de pruebas

| Escenario                                                 | Resultado esperado                                        |
| --------------------------------------------------------- | --------------------------------------------------------- |
| Visitante abre `/admin`                                   | Redirección al acceso; no recibe datos internos           |
| Usuario autenticado sin personal o personal inactivo      | No accede ni ejecuta acciones                             |
| Personal con `aal1` intenta escribir por API              | Denegación por SQL, incluidos media y stock               |
| Personal completa TOTP                                    | Accede con su rol; no se bloquea el proceso de alta       |
| `viewer` manipula formularios o llama RPC                 | No cambia datos ni obtiene costes                         |
| `store_admin` gestiona Equipo o configuración restringida | Denegación en servidor y base                             |
| `system_admin` desactiva a un usuario conectado           | La siguiente operación del usuario desactivado se rechaza |
| Invitación/recuperación usada, inválida o caducada        | No crea una sesión válida; mensaje recuperable            |
| Cambio de PVP después de la revisión                      | Conflicto explícito; no se aplica otra cifra              |
| Reintento de una operación ya aplicada                    | No duplica el cambio de precio ni el movimiento           |
| Dos ediciones simultáneas de ficha o imagen principal     | Sin sobrescritura silenciosa ni estado parcial            |
| Guardar contenido en borrador                             | El público conserva la versión publicada                  |
| Vista previa autenticada y petición pública posterior     | Sin contaminación de caché ni fuga del borrador           |
| Publicar contenido es                                     | Se actualiza es; ca/en se conservan; queda revisión       |
| Restaurar contenido anterior                              | Nueva revisión auditable; no se borra el historial        |
| HTML, RSC y endpoints públicos                            | Sin costes, proveedores, secretos o borradores            |
| Error de conexión a Supabase                              | Se distingue de una colección legítimamente vacía         |

Comandos base: `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm check`, `pnpm test:e2e` después del build y el escaneo de secretos ya existente. Incorporar `supabase test db` mediante la CLI versionada y una verificación reproducible de tipos. No cambiar dependencias para resolver asuntos ajenos a esta entrega.

## 6. Dependencias humanas y operativas

| Dependencia                                                     | Momento                   | Trabajo que puede continuar antes                                   |
| --------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| Disponibilidad de Docker y acceso al daemon                     | E01, antes de pruebas SQL | Comparación del repositorio y documentación                         |
| Acceso a configuración del proyecto Supabase/Vercel del usuario | E03 y E07                 | Implementación y tests locales                                      |
| Albert y Agustín configuran su propio segundo factor            | E03/E07                   | Flujos automáticos con usuarios locales                             |
| Canal de correo de Auth válido para destinatarios reales        | E03                       | Desarrollo con buzón local; no contratar proveedor por anticipación |
| Confirmación de textos, contacto y horarios                     | E05, antes de publicación | Editor y migración de textos ya existentes                          |
| Cuenta del usuario para la Preview y política de acceso externo | E07                       | Código, CI y pruebas aisladas                                       |

Las credenciales se configuran en el entorno o en el proveedor, nunca en el chat o el repositorio. Una dependencia pendiente bloquea su validación concreta, no el trabajo independiente.

## 7. Salida y reversión

La entrega queda lista cuando los dos administradores pueden usarla, las pruebas requeridas están en verde y la demostración reproduce cambios desde el panel hasta la tienda. La apertura pública y el paso a `adhara-prod` son hitos posteriores separados.

Usar migraciones aditivas y compatibles con el código anterior cuando sea posible. Un rollback de código no revierte automáticamente la base: documentar el procedimiento por migración. Los precios se corrigen con nuevos cambios auditados; el inventario con movimientos compensatorios, nunca borrando el historial. El contenido vuelve a una revisión anterior mediante una nueva publicación. Preparar recuperación de datos antes de aplicar migraciones a entornos con datos reales.

## 8. Primer encargo listo para empezar

> Ejecuta E01 de docs/NEXT_DELIVERY_PLAN.md. Inspecciona los worktrees adjuntos y prepara un checkout actualizado desde el último main, preservando la rama y los cambios locales existentes. Compara las migraciones locales antiguas con las vigentes sin aplicar ambas series. Lee README, DEVELOPMENT, STATUS, DECISIONS y ADMIN_PLAN de la versión actual. Usa Node de .nvmrc y pnpm con lockfile. Prepara y verifica Supabase local, ejecuta los checks base y deja un PR codex/admin-delivery-foundation con la documentación actualizada, evidencia y bloqueos concretos. No cambies cuentas, datos comerciales ni producción.

Orden de inicio: E01 primero; E02 es el primer cambio funcional. La implementación no depende de redefinir todo el roadmap ni de diseñar checkout.

## 9. Referencias de la revisión

- [Versión base](https://github.com/albertnieves/adhara-web/tree/effd7091f43417f0910ae8d93587e35711c5fdbf).
- [Estado remoto](https://github.com/albertnieves/adhara-web/blob/effd7091f43417f0910ae8d93587e35711c5fdbf/docs/STATUS.md).
- [Plan de administración existente](https://github.com/albertnieves/adhara-web/blob/effd7091f43417f0910ae8d93587e35711c5fdbf/docs/ADMIN_PLAN.md).
- [CI de la versión base](https://github.com/albertnieves/adhara-web/actions/runs/36780478225).

Este plan deriva de la revisión del código remoto, las migraciones, la documentación y el estado de CI. Las cuentas y la configuración efectiva de los servicios requieren verificación durante E03; la revisión previa no fue una auditoría dinámica del sistema desplegado.

## 10. Ejecución

Los bloques se implementan en el worktree `admin-store-delivery`, rama `codex/admin-delivery-foundation`, apoyada en la PR #9 de Claude (`f95c370`) para conservar las fases R/S. Las ramas sugeridas eran unidades de planificación. El estado verificable y los criterios todavía pendientes se registran en `DELIVERY_REPORT.md`; la existencia del código no cierra automáticamente las casillas originales.
