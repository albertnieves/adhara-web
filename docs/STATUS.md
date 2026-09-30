# Estado real — 30/09/2026

**Tienda visual (es/ca/en) y panel de administración operativos sobre `adhara-dev`, verificados en local y fusionados en `main` el 30/09 (PR #6) y desplegados en Vercel, que sigue siendo privado (Vercel Authentication). La Fase 1 completa sigue pendiente: los 424 perfumes del catálogo real ya están cargados como borradores con foto, pero falta importar sus formatos y costes (el CSV ya está preparado), la verificación en dos pasos de las cuentas del personal y los criterios de la Fase 1 que se listan al final.**

## Qué funciona

### Tienda

- Home con hero animado (cielo, estrella del emblema con parallax, titular por palabras), destacados, sección «La experiencia», casas en bucle y la tienda de Castelldefels.
- Colección con búsqueda sin tildes, filtros por casa y público, orden (destacados, precio, nombre) y rejilla animada.
- Ficha de perfume con la **escena 3D de unboxing** del piloto para Asad, Yara, Khamrah y Club de Nuit Intense Man LE (caja que se abre, frasco que sube y gira, giro libre al final); galería de imágenes para el resto; formato, PVP con IVA, disponibilidad (disponible / últimas unidades / agotado, nunca unidades) y compra online marcada como próxima.
- Con `prefers-reduced-motion` las animaciones se sustituyen por el estado final; sin WebGL se muestra la imagen.
- **Vista previa con borradores** para el personal: desde el panel («Ver tienda con borradores» en Catálogo, en la ficha de cada perfume o en el menú lateral) se ve la tienda completa con los borradores y un aviso fijo con «Salir». El público y la caché no cambian.
- Textos en es/ca/en con prueba de claves completas. Sin desbordamiento horizontal a 360, 390, 768 y 1024 px.
- Identidad **definitiva** desde el 30/09: nombre **L’Atelier du Désert** y logotipo del usuario, vectorizado del original (`docs/brand/logo-original.png` → `public/brand/logo.svg`). Emblema y nombre en una línea en la cabecera y el panel; composición completa con «Haute Parfumerie Orientale» en el pie y el acceso; icono de pestaña y de iOS con el emblema. La estrella decorativa es la del emblema.

### Panel (`/admin`, solo personal con verificación en dos pasos)

- Inicio con indicadores (publicados, borradores, sin PVP completo, stock bajo; con permiso de costes, formatos sin coste y valor del stock a coste) y últimos movimientos.
- Catálogo: listado con filtros, alta (marca nueva o existente), edición, formatos, **PVP con revisión Ómnibus** y confirmación de cambios grandes, **coste neto interno y margen** por formato (solo con permiso de costes y MFA; margen en vivo al escribir el PVP y aviso si queda por debajo del coste), imágenes con procedencia (bucket `product-media`, hasta 4 MB), textos es/ca/en, publicar / retirar / archivar / borrar borradores y **vista previa** de la ficha (también de borradores, con la escena 3D).
- **Etiquetas de precio** para la tienda: hoja A4 de 3 × 7 (63,5 × 38,1 mm), una por formato activo con PVP, filtrables por marca o perfume; en rebaja muestran el precio anterior validado con Ómnibus. Se imprimen desde el navegador, con o sin líneas de corte.
- **Importar catálogo** (CSV pegado o subido, también el de Excel en Windows-1252): revisión fila a fila antes de aplicar (marcas, perfumes y formatos nuevos o existentes, PVP a fijar, **costes a registrar**, conflictos y errores con su línea). Todo lo nuevo se crea en borrador con su procedencia; de lo existente solo se completan campos vacíos y un PVP distinto nunca se sobrescribe. La columna «coste» (neto o con IVA del 21 %, que se pasa a neto) se registra en el historial interno de costes solo con permiso de costes.
- **Cambiar precios** en bloque (por marca o todo el catálogo, borradores y publicados o solo publicados): porcentaje o importe fijo con redondeo a ,95, a euro entero o exacto; revisión por formato con las mismas reglas que un cambio individual (cambio grande, por debajo del coste), confirmación por fila y solo se aplica si el PVP no ha cambiado entretanto. Los formatos en rebaja se cambian desde su ficha.
- Inventario de la tienda de Castelldefels: recepción, venta en tienda, devoluciones, ajustes con motivo, mermas, probadores, traslados, recuento y punto de pedido según el permiso de cada rol; historial de movimientos de solo lectura con filtros (perfume, tipo, fechas) y **exportación CSV** para Excel.
- **Stock en la ficha de cada perfume**: niveles por formato, las mismas acciones de inventario y sus últimos movimientos, con enlace al historial filtrado.
- Equipo: listar personal y dar o retirar acceso por email a cuentas ya creadas en Supabase Auth.
- Pantallas de acceso, alta y verificación de MFA y contraseña con el nuevo diseño.

### Base de datos (`adhara-dev`, Frankfurt)

Diez migraciones en `supabase/migrations/` (detalle en supabase/README.md): personal y permisos (PR #5), catálogo, inventario, gestión del personal, borrado de niveles con su formato, roles preasignados, costes y registro de costes por lotes. RLS en todas las tablas públicas; costes fuera de la API (`internal`), solo accesibles con permiso de costes y MFA; historial de PVP, de costes, movimientos y auditoría de solo inserción.

Datos cargados: los 4 perfumes del piloto como **borradores sin PVP** (`supabase/data/20260929_pilot_products.sql`), con marca, concentración y formato solo cuando constan en la caja o la ficha oficial (Khamrah sin formato), e imágenes oficiales de marca marcadas como provisionales. Ubicación: Tienda de Castelldefels. Cuentas del personal creadas por el usuario el 30/09 y con su rol aplicado automáticamente (administrador del sistema y administrador de la tienda); aún sin verificación en dos pasos configurada.

Catálogo real: el PDF «CATALOGO 2026» (56 páginas, 429 etiquetas) está convertido en un CSV fuera del repositorio (contiene costes del proveedor): 424 perfumes de 25 marcas con su coste (versión 2, contrastada con las webs oficiales de las marcas). Por decisión del usuario, los precios del PDF son **coste interno** y las marcas que el catálogo no indica (pp. 2–26) se deducen de la foto y se marcan «por revisar» en la procedencia; 6 quedan como «Marca por identificar» (DECISIONS §54).

Perfumes del catálogo cargados el 30/09 (`supabase/data/20260930_catalogo_2026.sql`): 23 marcas nuevas y 420 perfumes nuevos, todos en **borrador**, sin formato, PVP ni coste, con la página del catálogo y el origen de la marca en `source_ref`. Con los 4 del piloto suman 25 marcas y 424 perfumes. Los formatos y los costes se añaden al importar el CSV desde el panel.

Fotos del catálogo: **subidas** al bucket `product-media` (647 imágenes WebP, 33,7 MB) y enlazadas en `product_media`. Los 420 perfumes nuevos tienen foto principal:

- 288 con fotos oficiales de la marca (515 imágenes), comprobadas una a una contra la foto del PDF;
- 132 con un recorte del propio catálogo, sin texto ni precios, para marcas sin web oficial accesible.

Todas son provisionales (`provisional = true`) y guardan su procedencia: `origin` y la página de origen en `source`. La subida se hizo con la cuenta temporal de prueba, por autorización expresa del usuario, que después se volvió a retirar (DECISIONS §55). Verificado: 654 filas en `product_media` (7 del piloto), ningún perfume sin foto principal ni con dos, ninguna fila sin archivo ni archivo sin fila, URL públicas con respuesta 200 y servidas por el optimizador de imágenes de Next.

### Despliegue

Vercel `adhara-web` (equipo SOAPBRXND, Hobby), funciones en París (cdg1), todos los despliegues protegidos con Vercel Authentication. Variables públicas de Supabase (`adhara-dev`) configuradas para Preview, Production y Development. `main` (producción) sigue en el commit 5a444ce: el trabajo nuevo está en la Preview del PR #6 hasta que se fusione.

## Validación ejecutada (29–30/09/2026)

| Comprobación                                          | Resultado                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lint, typecheck, formato                              | Correctos                                                                                                                                                                                                                                                                                                    |
| Vitest                                                | 147 tests correctos (20 archivos): paridad SQL/TS, aislamiento de costes, vista previa, importación (con costes), cambio masivo de PVP, `buildAlternates`, escaneo de secretos, CSV, filtros de movimientos y paginación                                                                                     |
| Escaneo de secretos                                   | `pnpm scan:secrets`: sin secretos en los archivos versionados (también en CI)                                                                                                                                                                                                                                |
| Build de producción (Webpack)                         | Correcto                                                                                                                                                                                                                                                                                                     |
| Playwright (repo)                                     | 74/74 escritorio y móvil con el Chromium del contenedor, incluidos `cost-leak.spec.ts`, `preview.spec.ts`, cabeceras de seguridad y canonical/hreflang                                                                                                                                                       |
| pgTAP en `adhara-dev`                                 | `02_catalog_inventory` 33/33 y `03_costs` 33/33 (con el registro de costes por lotes), en transacción revertida (`tap_remote.py`)                                                                                                                                                                            |
| CI GitHub Actions (Quality)                           | Verde en todos los commits del PR #6                                                                                                                                                                                                                                                                         |
| Previews de Vercel                                    | READY en todos los commits del PR #6                                                                                                                                                                                                                                                                         |
| Recorrido completo del panel con navegador (ver nota) | Acceso, alta de MFA, catálogo, PVP, Ómnibus, publicar, tienda, imágenes, inventario, equipo                                                                                                                                                                                                                  |
| Revisión visual con datos del piloto                  | Home, colección y fichas con escena 3D en escritorio y móvil                                                                                                                                                                                                                                                 |
| Revisión visual de coste y margen                     | Página local temporal con datos ficticios (sin escribir en la base), 1280 y 390 px                                                                                                                                                                                                                           |
| Etiquetas de precio                                   | Página local temporal con datos ficticios: pantalla, móvil y PDF A4 (21 por hoja, 3 × 7)                                                                                                                                                                                                                     |
| Vista previa de la tienda                             | Con sesión real de personal (cuenta temporal): el público no ve borradores y la vista previa sí (7), con la escena 3D; «Salir» vuelve al estado público y la caché pública no se contamina. Cookie falsa: sin efecto                                                                                         |
| Importador                                            | Con la cuenta temporal (rol de tienda, MFA): CSV ficticio con alias de columnas, errores y fila repetida; 1 marca, 2 perfumes, 3 formatos y 2 PVP en borrador; segunda pasada sin cambios y con el conflicto de PVP sin aplicar; móvil sin desbordamiento. Datos de prueba borrados                          |
| Páginas del panel con sesión real (solo lectura)      | Inicio, catálogo, inventario, etiquetas, importar, ficha con «Stock en tienda», historial filtrado por perfume, tipo y fechas, y exportación CSV (BOM, «;»): todas 200 y sin errores                                                                                                                         |
| CSV del catálogo real                                 | Leído y planificado con el código del importador: 0 errores. Contra el catálogo cargado (mismas marcas, slugs y nombres que en `adhara-dev`, comprobado por checksum): 0 marcas y 0 perfumes nuevos, 421 formatos y 424 costes                                                                               |
| Cambio masivo de PVP                                  | Con la cuenta temporal y datos ficticios («Marca QA Precios»): −30 % exacto; 2 de 4 formatos aplicables (excluidos el de rebaja y el sin PVP); botón bloqueado hasta confirmar; solo se aplicó la fila confirmada y quedó en el historial. La prueba encontró y corrigió un bucle de renders. Datos borrados |

Nota sobre el recorrido del panel: se hizo con una **cuenta temporal** (`prueba-e2e@adhara.invalid`, rol system_admin) y un perfume de prueba que se publicó, se vio en la tienda en es y ca, se retiró y se borró. La cuenta no se puede borrar de Auth porque la auditoría es de solo inserción (DECISIONS §39): quedó **sin rol, bloqueada y sin sesiones**. Quedan como rastro 8 entradas de auditoría y 2 filas del historial de PVP del formato de prueba borrado; no hubo movimientos de stock. La prueba encontró y corrigió un fallo real (un recuento que cuadra impedía borrar un borrador).

El 30/09 la misma cuenta se reactivó temporalmente (rol de tienda) para validar el importador y la vista previa con sesión real, con datos ficticios («Marca QA Importación») que después se borraron; la cuenta volvió a quedar sin rol, bloqueada, sin sesiones ni MFA y con contraseña aleatoria. Se reactivó una vez más, solo para leer, y comprobar las páginas del panel con sesión real (sin movimientos ni cambios). Después se usó para probar el cambio masivo de PVP con datos ficticios, también borrados. Por último, con autorización expresa del usuario, se reactivó (rol de tienda, con `media.edit`) solo para subir las 647 fotos del catálogo; al terminar volvió a quedar sin rol, bloqueada, sin sesiones ni MFA y con contraseña aleatoria. Esa cuenta figura como propietaria de los archivos en Storage, lo que no da acceso a nada: la lectura es pública y la escritura exige `media.edit`. Rastro total de las pruebas: 25 entradas de auditoría (sobre todo altas de MFA) y 10 filas del historial de PVP de formatos ya borrados (tablas de solo inserción); ningún movimiento de stock.

La revisión visual con perfumes se hizo en local con un Supabase simulado que devolvía los 4 perfumes del piloto como publicados y **sin precio**; no se modificó la base de datos.

## Pendiente del usuario

1. Entrar en el panel con las cuentas ya creadas y configurar la verificación en dos pasos (la pide el primer acceso).
2. Importar el CSV del catálogo desde Panel → Catálogo → Importar, indicando si los precios del PDF llevan IVA. Los perfumes ya existen, así que la revisión debe mostrar 0 perfumes nuevos, 421 formatos y 424 costes. Revisar después las marcas «por revisar», los 6 perfumes sin marca y las fotos (Panel → Catálogo, o la vista previa de la tienda).
3. Decidir cuándo abrir la web a Agustín: con Vercel Authentication para todo, solo entra quien tiene cuenta en el equipo de Vercel (en Hobby, solo el titular).
4. Revisar y fusionar el PR #6 (incluye el PR #5) para llevarlo a producción.

## Pendiente técnico

- Activar en Supabase Auth la protección de contraseñas filtradas (aviso del asesor de seguridad; puede requerir plan de pago).

- Tras la importación: fijar PVP (con el cambio masivo o por ficha), revisar marcas y nombres marcados y publicar.
- Configuración de Auth en Supabase (Site URL y Redirect URLs con la URL del despliegue; plantillas con `token_hash`) para invitaciones y recuperación por email.
- Fase 1 sin cerrar. Ya cumplidos o cubiertos (docs/source/FASE_1_PLAN.md §16): 1 (lint, typecheck, tests y build), 3 (Preview de Vercel), 4–6 (i18n), 7 (`buildAlternates` con los 4 casos, en uso en home, colección y fichas), 10 (`internal` no está expuesto: la API responde «Only the following schemas are exposed: public, graphql_public»), 11 (`cost-leak.spec.ts`), 13 (`pnpm scan:secrets` en CI), 14 y 16 (acceso al panel y cabeceras de seguridad en E2E). Pendientes: 2 (tres workflows; hoy hay uno), 8, 9 y 12 (Supabase local, pgTAP en CI y diff de tipos: sin Docker en la sesión; pgTAP se ejecuta contra `adhara-dev`), 15 (cuenta real del administrador con MFA), 17 y 19 (docs y REPORT), además de proveedores (`internal`), taxonomía de notas y familias, procedencia del research, proyecto `adhara-prod` y protección de `main`. El criterio 18 (sin datos de producto) queda superado por decisión del usuario: se cargaron los perfumes del piloto.
- Panel: precio del PDF como referencia (A2); compras y proveedores (A3). Confirmar con la asesoría qué debe llevar la etiqueta de estante (precio por unidad de medida, etc.).
- Fotos propias y derechos de las imágenes oficiales antes de abrir al público.
- Escenas 3D para el resto del catálogo (hoy solo las 4 del piloto); medidas reales del kit de tienda.
- Checkout, pedidos, clientes y mensajes (fases A5–A7 del panel; F10–F14).

## Historial

- 28/09: arranque técnico verificado (lint, typecheck, build, 12 E2E; detalle en el historial de Git de este archivo).
- 29/09: despliegue en Vercel verificado; producción privada y en París. Sesión del PR #5: reglas de dominio del panel (A0), `adhara-dev`, personal, permisos, auditoría y acceso con MFA (A1), 22/22 pgTAP y 22 E2E.
- 29–30/09: esta sesión (PR #6): sistema visual, tienda animada con 3D, catálogo, precios, inventario y equipo en el panel.

Ver docs/DEVELOPMENT.md para continuar y docs/DECISIONS.md para las decisiones.
