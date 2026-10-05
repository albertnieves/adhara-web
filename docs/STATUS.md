# Estado real — 04/10/2026

**Tienda visual (es/ca/en) y panel de administración operativos sobre `adhara-dev`, desplegados en Vercel, que sigue siendo privado (Vercel Authentication). `main` incluye las fases R y S (PR #9), la entrega de acceso y edición de Codex (PR #10) y el panel con el asistente (PR #11); sus 17 migraciones están aplicadas en `adhara-dev` (comprobado el 02/10). La tienda muestra 50 perfumes publicados con PVP. La Fase 1 está cerrada (PR #12): sus 19 criterios están cumplidos o con una excepción escrita ([informe](phases/FASE_1_REPORT.md)). La Fase 2 (sistema de diseño) está terminada a falta de la revisión visual del usuario ([informe](phases/FASE_2_REPORT.md)): 12 de 13 criterios cumplidos. Siguiente: checkout con pago con tarjeta, que espera los datos del TPV virtual (ver «Pendiente del usuario»).**

## Fase 2: cierre técnico (04/10), a falta de la revisión visual

Plan del sistema de diseño en [phases/FASE_2_PLAN.md](phases/FASE_2_PLAN.md), aprobado (PR #13) con las decisiones D1–D6 recomendadas (DECISIONS §92).

**DS-01 hecha (red de seguridad):**

- auditoría de diseño en E2E sobre 35 pantallas a 4 anchuras, sin incidencias;
- línea base de axe: 2 reglas incumplidas, contraste en 32 pantallas y un indicador de carga sin rol;
- capturas y axe como artefacto de cada ejecución de `e2e.yml`.

**DS-02 hecha (tokens):**

- paleta y tokens semánticos con tonos oscuros;
- pruebas de contraste AA en los cinco tonos;
- guardas de colores y tipografía;
- **axe sin infracciones en las 35 pantallas**, frente a 304 elementos con contraste insuficiente.

**DS-03 hecha (página de referencia):**

- `/admin/diseno`, para todo el personal con sesión, enlazada desde el pie del menú del panel;
- todos los tokens con el valor que aplica el navegador y el contraste calculado en los cinco tonos (todas las combinaciones cumplen);
- una prueba exige que la página y `globals.css` tengan los mismos tokens.

**DS-04 hecha (tipografía):**

- componentes `Heading`, `Text` y `Eyebrow` en `src/components/ui`, la primera pieza de la biblioteca común;
- escala cerrada: sin tamaños ni espaciados arbitrarios y ningún texto por debajo de 11 px, comprobado por prueba unitaria y por la auditoría E2E.

**DS-05 hecha (iconos y marca):**

- `Icon` con el juego propio de 12 iconos de trazo fino, y la estrella como viñeta, separador y cargador;
- reglas del logotipo (tamaño mínimo, margen y fondos) en `/admin/diseno`, con el mínimo garantizado por el componente.

**DS-06 hecha (acciones):**

- `Button`, `TextLink` y `SubmitButton` con todos sus estados, comprobados con teclado;
- los botones de envío del panel ya usan el del sistema.

**DS-07 hecha (formularios):**

- `Field`, `Fieldset`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio` y `SearchField` con foco, error, deshabilitado y solo lectura, comprobados con teclado y axe;
- el buscador del panel ya usa el del sistema.

**DS-08 hecha (superposiciones y avisos):**

- `Dialog`, `Sheet`, `useConfirm` y `Toast` con foco atrapado, Esc y foco devuelto, comprobados con teclado;
- el menú móvil, los paneles de inventario y los avisos del panel ya usan los del sistema.

**DS-09 hecha (datos y comercio):**

- `Badge`, `Tag`, `Price`, `Card`, `Table`, `EmptyState` y `Skeleton`, con `Price` probado en es, ca y en con y sin rebaja;
- los estados de publicación del panel ya usan `Badge`.

**DS-10 hecha (tienda):**

- toda la tienda usa la biblioteca y los colores semánticos, sin clases sueltas;
- auditoría de maquetación y axe sin fallos en las rutas públicas de los tres idiomas.

**DS-11 hecha (panel):**

- todo el panel usa la biblioteca (`Input`, `Select`, `Checkbox`, `Field`, `SubmitButton`, `buttonClass`, `Card`, `Table`, `Eyebrow`, `Skeleton`) y los colores semánticos;
- sin `.btn`, `.panel-btn`, `.input`, `.panel-card`, `.field` ni `.eyebrow`, y sin colores de paleta: lo vigila una prueba unitaria;
- controles del panel de 44 px, comprobado por la auditoría con sesión, y axe sin infracciones en las 24 pantallas del panel y en la tienda, ahora como prueba que falla.

**DS-12 hecha (cierre):** guía [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), informe [phases/FASE_2_REPORT.md](phases/FASE_2_REPORT.md) y decisiones §106–107. **Falta tu revisión visual en la Preview** (criterio 13): `/admin/diseno`, los tonos de colección (D3) y las capturas del artefacto `auditoria-visual`. Se aprueba por escrito en la PR de cierre.

- **Objetivos:**
  - tokens en dos capas;
  - contraste AA garantizado por una prueba;
  - una biblioteca de primitivas para la tienda y el panel;
  - página de referencia `/admin/diseno`;
  - accesibilidad comprobada con axe y teclado;
  - migración sin regresiones;
  - revisión visual del usuario.
- **Criterios:** 13 criterios de cierre.
- **Decisiones D1–D6:** cada una lleva recomendación; si no se dice nada, se sigue la recomendación.
- **Tareas:** DS-00 a DS-12, cada una una PR.
- **Problemas ya medidos:**
  - texto en niebla sobre marfil, 2,3:1;
  - dorado sobre marfil, 3,1:1;
  - bordes de campos, 1,3:1;
  - dos sistemas de botones;
  - tamaños y espaciados de letra arbitrarios.

## Cierre de la Fase 1 (02/10, PR #12, fusionada)

A petición del usuario. Criterio por criterio, con evidencia, en [phases/FASE_1_REPORT.md](phases/FASE_1_REPORT.md); excepciones en DECISIONS §83–90.

- **CI en tres workflows**, en verde en la PR: `ci.yml` (secretos, formato, lint, tipos, unitarias y build), `db.yml` (`db reset`, pgTAP, tipos, `db lint` y concurrencia) y `e2e.yml` (Supabase local con un coste centinela, tienda a 390×844 y 1440×900 y recorridos autenticados).
- **Garantías nuevas probadas:**
  - pgTAP `07`: RLS en todas las tablas públicas, `anon` sin funciones `admin_*` ni escritura, PVP sin permiso, publicación y UPDATE/DELETE en las tablas de solo inserción;
  - un coste centinela (987654) que no aparece en ninguna respuesta pública;
  - una sesión sin ficha de personal recibe 404.
- **Documentación de la fase:** `CLAUDE.md`, [ARCHITECTURE](ARCHITECTURE.md), [DATABASE](DATABASE.md), [SECURITY](SECURITY.md), [I18N](I18N.md), [PRICING](PRICING.md), [PRODUCT_RESEARCH](PRODUCT_RESEARCH.md) (borrador) y [ROADMAP](ROADMAP.md). Registro de ADR en DECISIONS, con ADR-010 (tres idiomas con prefijo) sustituyendo a ADR-008.
- **Excepciones escritas:**
  - `db reset` no se ejecuta en `adhara-dev` (datos reales); se comprueba la paridad de migraciones, 17/17;
  - partes del esquema del plan se difieren a su fase (taxonomía, research, `media_assets`, `tax_rates`, `locales`);
  - el owner se creó por preasignación y no con `bootstrap-owner`;
  - el criterio 18 queda superado por decisión del usuario.
- **Siguiente fase:** Fase 2 (Design System), en preparación, con la preparación de la Fase 3 (importar el CSV del catálogo).

## Panel más cómodo y asistente de inventario (01–02/10, PR #11, fusionada)

A petición del usuario, antes de cerrar la Fase 1. Decisiones §74–82; guía en [ADMIN_OPERATIONS.md](ADMIN_OPERATIONS.md).

- **Solapes corregidos.** Con poca altura de ventana el menú lateral saltaba a una segunda columna y se pintaba sobre el contenido; ahora tiene desplazamiento propio y secciones agrupadas. En tablet vertical y móvil, menú en panel deslizante.
- **Más cómodo e interactivo.** Movimiento, recuento y aviso de stock en un panel lateral (antes se abrían dentro de la fila y quedaban cortados), avisos con el resultado, búsqueda al escribir en catálogo e inventario, tablas en fichas en el móvil, barra de secciones en la ficha de perfume y botones de 44 px.
- **Informe diario.** Actividad del día, agotados y stock bajo según el vigilante, pedidos abiertos y vencidos y tareas del catálogo, con enlace a su pantalla y filtradas por rol. En unidades, sin costes ni proveedores. Se ve en directo en Panel → Asistente y en el inicio; cada mañana una tarea programada guarda el del día anterior con un resumen redactado por Claude.
- **Asistente (primera versión).** Chat en el panel que responde con datos reales (stock, movimientos, reposición, ventas en unidades y pendientes del catálogo) con herramientas de solo lectura y los permisos de quien pregunta. No cambia stock, precios ni pedidos.
- **Migración aplicada** en `adhara-dev` el 02/10 (`20261002044249_assistant_daily_reports`, con autorización del usuario; asesor de seguridad sin avisos nuevos). **Falta configurar** en Vercel (solo servidor) `ANTHROPIC_API_KEY`, `CRON_SECRET` y `SUPABASE_SECRET_KEY`. Sin la clave de Claude, el informe funciona sin resumen y el chat aparece como «no activado».

## Entrega complementaria de administración (01/10, PR #10)

Edición de portada y configuración, invitación y recuperación, MFA en escrituras SQL, revisiones de precios, control de versiones e idempotencia de stock. Dirección confirmada: Carrer de Pompeu Fabra 1. Evidencia en [DELIVERY_REPORT.md](DELIVERY_REPORT.md); guía en [ADMIN_OPERATIONS.md](ADMIN_OPERATIONS.md). Fusionada en `main` y con sus migraciones en `adhara-dev`. Activación de MFA por los titulares y correo real siguen pendientes.

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

### Fase R: tienda física y reposición (PR #9, fusionada)

Plan en [PLAN_TIENDA_REPOSICION.md](PLAN_TIENDA_REPOSICION.md). Validado con Supabase local; su migración ya está en `adhara-dev`.

- **Mostrador** (tablet): buscar por nombre, marca, SKU o EAN (un lector de códigos teclea el código y Enter), varias líneas con −/+, venta o devolución todo o nada con el nº de ticket del TPV. No emite tickets ni guarda importes (DECISIONS §59). Una línea sin stock bloquea el botón; un doble toque registra una sola venta. Últimas operaciones de la tienda debajo.
- **Reposición**: el vigilante revisa el stock al abrir la página (agotados, por debajo del punto de pedido, cobertura que no llega a la próxima entrega, inmovilizado y niveles que no cuadran con sus movimientos), explica cada hallazgo con sus datos y propone cantidades solo cuando hay datos. Quien gestiona compras crea borradores de pedido por proveedor desde las propuestas. Parámetros visibles y editables por el administrador del sistema.
- **Compras**: pedidos a proveedor (borrador → pedido → recibido en parte → recibido, o cancelado / cerrado con faltas), líneas con coste neto (solo con permiso de costes), recepción parcial con albarán que suma stock y, opcionalmente, actualiza el coste vigente, historial de recepciones e impresión del pedido. Revisión optimista: un cambio sobre una versión antigua no se aplica.
- **Proveedores**: ficha (contacto, plazo habitual), condiciones por formato (referencia, múltiplo de compra, plazo, preferente) y asignación de todos los formatos de una marca de una vez.

### Fase S: informes y control (PR #9, fusionada)

Plan en [PLAN_INFORMES.md](PLAN_INFORMES.md). Validado con Supabase local; su migración (solo funciones de lectura) ya está en `adhara-dev`.

- **Existencias y cierre mensual**: iniciales, entradas, ventas, mermas, ajustes y finales de cada mes, por marca y con valor a coste (con permiso de costes). CSV para la gestoría con una fila por formato y el total.
- **Rotación e inmovilizado**: más vendidos (rotación y días de cobertura) y lo que no se ha vendido en 30, 90, 180 o 365 días, con su valor a coste.
- **Márgenes**: margen teórico por marca, formatos por debajo del mínimo y formatos con PVP sin coste.
- **Compras por proveedor**: pedidos, unidades y valor recibidos, y plazo real frente al declarado.
- **Auditoría** (administrador del sistema): quién hizo qué y cuándo, con filtros.

### Base de datos (`adhara-dev`, Frankfurt)

Diecisiete migraciones en `supabase/migrations/` (detalle en supabase/README.md): personal y permisos (PR #5), catálogo, inventario, gestión del personal, borrado de niveles con su formato, roles preasignados, costes y registro de costes por lotes; las de la entrega de Codex y las fases R y S, y la del asistente. Las 17 están aplicadas en `adhara-dev` (la del asistente, el 02/10, como `20261002044249`). RLS en todas las tablas públicas; costes fuera de la API (`internal`), solo accesibles con permiso de costes y MFA; historial de PVP, de costes, movimientos y auditoría de solo inserción.

Datos cargados: los 4 perfumes del piloto como **borradores sin PVP** (`supabase/data/20260929_pilot_products.sql`), con marca, concentración y formato solo cuando constan en la caja o la ficha oficial (Khamrah sin formato), e imágenes oficiales de marca marcadas como provisionales. Ubicación: Tienda de Castelldefels. Cuentas del personal creadas por el usuario el 30/09 y con su rol aplicado automáticamente (administrador del sistema y administrador de la tienda). El administrador del sistema tiene la verificación en dos pasos activa desde el 01/10; el de la tienda aún no (lectura del 02/10).

Catálogo real: el PDF «CATALOGO 2026» (56 páginas, 429 etiquetas) está convertido en un CSV fuera del repositorio (contiene costes del proveedor): 424 perfumes de 25 marcas con su coste (versión 2, contrastada con las webs oficiales de las marcas). Por decisión del usuario, los precios del PDF son **coste interno** y las marcas que el catálogo no indica (pp. 2–26) se deducen de la foto y se marcan «por revisar» en la procedencia; 6 quedan como «Marca por identificar» (DECISIONS §54).

Perfumes del catálogo cargados el 30/09 (`supabase/data/20260930_catalogo_2026.sql`): 23 marcas nuevas y 420 perfumes nuevos, todos en **borrador**, sin formato, PVP ni coste, con la página del catálogo y el origen de la marca en `source_ref`. Con los 4 del piloto suman 25 marcas y 424 perfumes. Los formatos y los costes se añaden al importar el CSV desde el panel.

Fotos del catálogo: **subidas** al bucket `product-media` (647 imágenes WebP, 33,7 MB) y enlazadas en `product_media`. Los 420 perfumes nuevos tienen foto principal:

Publicados el 30/09, a petición del usuario:

- **Piloto** (`supabase/data/20260930_piloto_publicado.sql`): Asad, Yara, Khamrah (formato de 100 ml confirmado por el usuario) y Club de Nuit Intense Man LE, con su escena 3D. PVP de Yara: 29,99 €, de la tienda del distribuidor oficial en España (orientfragance.com). Los otros tres no se venden allí; por decisión del usuario, su PVP es el de la web oficial de la marca en EE. UU. pasado a euros con el cambio del BCE del 30/09: Asad 39,62 €, Khamrah 44,02 € y Club de Nuit Intense Man LE 66,05 €.
- **Compra a Orient Fragance** (`supabase/data/20260930_compra_orient_fragance.sql`). Parte de la lista de compra del 30/09: 50 líneas, 20 uds cada una.
  - 12 perfumes ya estaban en el catálogo y 34 son nuevos, de 5 marcas nuevas: Assaf, Laverne, Bharara, Jo Milano y Reef.
  - Cada perfume tiene un único formato con el PVP de orientfragance.com.
  - Los Yara de 20 ml son «aceite concentrado» y van como perfumes aparte, igual que en la tienda oficial.
  - La línea «Odyssey Revolution» es la Ultra Edition que ya estaba en el catálogo, según la foto de la tienda oficial.
  - Stock: recepción de 20 uds por formato en la Tienda de Castelldefels (46 recepciones, 920 uds), registrada como carga sin actor con la referencia `compra-orient-fragance-2026-09-30`.
  - Publicados: los 46. La tienda oficial no vende tres de ellos: Yara Aceite Concentrado (Yara Rosa 20 ml), Pharaoh Ramesses II (solo vende el I) y Game of Spades Blind Bid. Su PVP es de 49,50 €, fijado por el usuario.
  - Los 4 lotes de la lista (Esencial, Premium, Otoño Invierno y Mixt & Gourmand) no se cargaron: falta saber qué contienen.
  - Fotos: 47 fotos oficiales de marca para 28 de estos perfumes, comprobadas contra la foto de la tienda oficial, subidas al bucket y enlazadas como provisionales (701 imágenes en total, ninguna sin archivo ni archivo sin fila). La subida se hizo con la cuenta temporal de pruebas, por autorización expresa del usuario, y la cuenta se retiró después: sin rol, bloqueada, sin sesiones ni MFA y con contraseña aleatoria. Seis perfumes publicados no tienen foto oficial que coincida y muestran la imagen de reserva: Voux Turquoise, Yara Moi y Yara Tous aceite, Miss Sakura, Game of Spades Queen y Reef 33 White.

- 288 con fotos oficiales de la marca (515 imágenes), comprobadas una a una contra la foto del PDF;
- 132 con un recorte del propio catálogo, sin texto ni precios, para marcas sin web oficial accesible.

Todas son provisionales (`provisional = true`) y guardan su procedencia: `origin` y la página de origen en `source`. La subida se hizo con la cuenta temporal de prueba, por autorización expresa del usuario, que después se volvió a retirar (DECISIONS §55). Verificado: 654 filas en `product_media` (7 del piloto), ningún perfume sin foto principal ni con dos, ninguna fila sin archivo ni archivo sin fila, URL públicas con respuesta 200 y servidas por el optimizador de imágenes de Next.

### Despliegue

Vercel `adhara-web` (equipo SOAPBRXND, Hobby), funciones en París (cdg1), todos los despliegues protegidos con Vercel Authentication. Variables públicas de Supabase (`adhara-dev`) configuradas para Preview, Production y Development. Production está en `06aacb1` (PR #11, READY); la PR #12 tiene su Preview en READY.

## Validación ejecutada (29/09–02/10/2026)

| Comprobación                                          | Resultado                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, typecheck, formato                              | Correctos                                                                                                                                                                                                                                                                                                                                                              |
| Vitest                                                | 147 tests correctos (20 archivos): paridad SQL/TS, aislamiento de costes, vista previa, importación (con costes), cambio masivo de PVP, `buildAlternates`, escaneo de secretos, CSV, filtros de movimientos y paginación                                                                                                                                               |
| Escaneo de secretos                                   | `pnpm scan:secrets`: sin secretos en los archivos versionados (también en CI)                                                                                                                                                                                                                                                                                          |
| Build de producción (Webpack)                         | Correcto                                                                                                                                                                                                                                                                                                                                                               |
| Playwright (repo)                                     | 74/74 escritorio y móvil con el Chromium del contenedor, incluidos `cost-leak.spec.ts`, `preview.spec.ts`, cabeceras de seguridad y canonical/hreflang                                                                                                                                                                                                                 |
| pgTAP en `adhara-dev`                                 | `02_catalog_inventory` 33/33 y `03_costs` 33/33 (con el registro de costes por lotes), en transacción revertida (`tap_remote.py`)                                                                                                                                                                                                                                      |
| CI GitHub Actions (Quality)                           | Verde en todos los commits del PR #6                                                                                                                                                                                                                                                                                                                                   |
| Previews de Vercel                                    | READY en todos los commits del PR #6                                                                                                                                                                                                                                                                                                                                   |
| Recorrido completo del panel con navegador (ver nota) | Acceso, alta de MFA, catálogo, PVP, Ómnibus, publicar, tienda, imágenes, inventario, equipo                                                                                                                                                                                                                                                                            |
| Revisión visual con datos del piloto                  | Home, colección y fichas con escena 3D en escritorio y móvil                                                                                                                                                                                                                                                                                                           |
| Revisión visual de coste y margen                     | Página local temporal con datos ficticios (sin escribir en la base), 1280 y 390 px                                                                                                                                                                                                                                                                                     |
| Etiquetas de precio                                   | Página local temporal con datos ficticios: pantalla, móvil y PDF A4 (21 por hoja, 3 × 7)                                                                                                                                                                                                                                                                               |
| Vista previa de la tienda                             | Con sesión real de personal (cuenta temporal): el público no ve borradores y la vista previa sí (7), con la escena 3D; «Salir» vuelve al estado público y la caché pública no se contamina. Cookie falsa: sin efecto                                                                                                                                                   |
| Importador                                            | Con la cuenta temporal (rol de tienda, MFA): CSV ficticio con alias de columnas, errores y fila repetida; 1 marca, 2 perfumes, 3 formatos y 2 PVP en borrador; segunda pasada sin cambios y con el conflicto de PVP sin aplicar; móvil sin desbordamiento. Datos de prueba borrados                                                                                    |
| Páginas del panel con sesión real (solo lectura)      | Inicio, catálogo, inventario, etiquetas, importar, ficha con «Stock en tienda», historial filtrado por perfume, tipo y fechas, y exportación CSV (BOM, «;»): todas 200 y sin errores                                                                                                                                                                                   |
| CSV del catálogo real                                 | Leído y planificado con el código del importador: 0 errores. Contra el catálogo cargado (mismas marcas, slugs y nombres que en `adhara-dev`, comprobado por checksum): 0 marcas y 0 perfumes nuevos y 424 costes; tras la publicación del 30/09, 16 perfumes ya tienen su único formato, así que quedan 408 formatos nuevos (comprobado en la base)                    |
| Cambio masivo de PVP                                  | Con la cuenta temporal y datos ficticios («Marca QA Precios»): −30 % exacto; 2 de 4 formatos aplicables (excluidos el de rebaja y el sin PVP); botón bloqueado hasta confirmar; solo se aplicó la fila confirmada y quedó en el historial. La prueba encontró y corrigió un bucle de renders. Datos borrados                                                           |
| Fase R: pgTAP en Supabase local                       | `04_purchasing_counter` 54/54 y las tres anteriores: 142/142 (CLI 2.119.0, Postgres 17)                                                                                                                                                                                                                                                                                |
| Fase R: concurrencia                                  | 24 sesiones paralelas: una sola venta de la última unidad, una sola venta por clave de petición, nunca más recibido que lo pedido, nivel igual a la suma de movimientos (`supabase/tests/concurrency/`)                                                                                                                                                                |
| Fase R: recorrido real del panel                      | Supabase local con los datos de `supabase/data/` y cuentas ficticias con MFA: proveedor, asignación por marca, venta y devolución en mostrador, propuesta → borrador → pedido → recepción parcial y total, parámetros; encargado sin Compras ni Mostrador ni nombres de proveedor; 1024, 768 y 390 px sin desbordamiento                                               |
| Fase S: pgTAP en Supabase local                       | `05_reports` 22/22; las cinco pruebas, 164/164                                                                                                                                                                                                                                                                                                                         |
| Fase S: recorrido real de informes                    | Con los datos de la fase R: existencias de hoy = suma de niveles, CSV con BOM, fila TOTAL y euros con coma, rotación, márgenes, plazo real del proveedor, auditoría filtrada; store_admin sin auditoría, encargado sin informes; 1024, 768 y 390 px                                                                                                                    |
| Panel y asistente: comprobaciones                     | `pnpm check` (lint, tipos, 212 unitarias con 13 nuevas, build), formato y escaneo de secretos                                                                                                                                                                                                                                                                          |
| Panel y asistente: E2E                                | 108/108 en escritorio y móvil (6 nuevas: asistente y consulta sin sesión, tarea programada sin secreto)                                                                                                                                                                                                                                                                |
| Panel y asistente: pgTAP y tipos                      | Supabase local desde una base vacía (17 migraciones): `06_assistant` 24/24 y las siete pruebas 235/235; tipos generados sin diferencias; concurrencia correcta                                                                                                                                                                                                         |
| Panel y asistente: recorridos autenticados            | 8/8 (3 nuevos): barra lateral dentro de su columna a 1280×640, menú móvil que navega y se cierra, movimiento en panel lateral con aviso y Esc, informe según el rol (el encargado no ve tareas del catálogo ni puede guardar) y chat «no activado» sin clave                                                                                                           |
| Panel y asistente: auditoría visual                   | Las 23 pantallas del panel a 390, 768 y 1280 px con los datos de `supabase/data` en local: sin solapes de cajas, texto desbordado ni scroll horizontal (quedan falsos positivos revisados: texto que salta de línea, etiqueta «Principal» sobre la foto y URL truncada)                                                                                                |
| Asistente con API simulada                            | Imitación local de la API de mensajes, sin coste: la tarea programada da 401 sin secreto o con uno erróneo y 200 con el correcto, y guarda el informe y el resumen; el chat del encargado usa `buscar_stock` con su sesión y recibe la respuesta en streaming; el uso queda registrado. Petición con `claude-opus-5-5`, `effort: medium`, respaldo en servidor y caché |
| Cierre de la Fase 1: CI                               | `ci.yml`, `db.yml` y `e2e.yml` en verde en la PR #12 (`a15fdda`)                                                                                                                                                                                                                                                                                                       |
| Cierre de la Fase 1: pgTAP                            | 263/263 en 8 archivos desde una base vacía (`07_phase1_guarantees` 28/28); tipos sin diferencias; `db lint` sin errores salvo 3 falsos positivos conocidos; concurrencia correcta                                                                                                                                                                                      |
| Cierre de la Fase 1: E2E                              | Tienda pública contra Supabase local con el coste centinela: 134/134 (26 nuevas); recorridos autenticados 9/9 (sesión sin ficha → 404, nuevo)                                                                                                                                                                                                                          |
| Cierre de la Fase 1: `adhara-dev` (solo lectura)      | 17/17 migraciones iguales al repositorio; `internal` y `private` responden `PGRST106` con la clave publicable; `anon` no ejecuta `admin_variant_costs` (42501) ni ve borradores; administrador del sistema con TOTP verificado                                                                                                                                         |

Nota sobre el recorrido del panel: se hizo con una **cuenta temporal** (`prueba-e2e@adhara.invalid`, rol system_admin) y un perfume de prueba que se publicó, se vio en la tienda en es y ca, se retiró y se borró. La cuenta no se puede borrar de Auth porque la auditoría es de solo inserción (DECISIONS §39): quedó **sin rol, bloqueada y sin sesiones**. Quedan como rastro 8 entradas de auditoría y 2 filas del historial de PVP del formato de prueba borrado; no hubo movimientos de stock. La prueba encontró y corrigió un fallo real (un recuento que cuadra impedía borrar un borrador).

El 30/09 la misma cuenta se reactivó temporalmente (rol de tienda) para validar el importador y la vista previa con sesión real, con datos ficticios («Marca QA Importación») que después se borraron; la cuenta volvió a quedar sin rol, bloqueada, sin sesiones ni MFA y con contraseña aleatoria. Se reactivó una vez más, solo para leer, y comprobar las páginas del panel con sesión real (sin movimientos ni cambios). Después se usó para probar el cambio masivo de PVP con datos ficticios, también borrados. Por último, con autorización expresa del usuario, se reactivó (rol de tienda, con `media.edit`) solo para subir las 647 fotos del catálogo; al terminar volvió a quedar sin rol, bloqueada, sin sesiones ni MFA y con contraseña aleatoria. Esa cuenta figura como propietaria de los archivos en Storage, lo que no da acceso a nada: la lectura es pública y la escritura exige `media.edit`. Rastro total de las pruebas: 25 entradas de auditoría (sobre todo altas de MFA) y 10 filas del historial de PVP de formatos ya borrados (tablas de solo inserción); ningún movimiento de stock.

La revisión visual con perfumes se hizo en local con un Supabase simulado que devolvía los 4 perfumes del piloto como publicados y **sin precio**; no se modificó la base de datos.

## Pendiente del usuario

1. Configurar la verificación en dos pasos del administrador de la tienda (la pide el primer acceso; la del administrador del sistema ya está activa) y proteger `main` en GitHub: PR obligatoria y `CI`, `Database` y `E2E` en verde.
2. Importar el CSV del catálogo desde Panel → Catálogo → Importar, indicando si los precios del PDF llevan IVA. Los perfumes ya existen y 16 ya tienen su único formato, así que la revisión debe mostrar 0 perfumes nuevos, 408 formatos y 424 costes. Revisar después las marcas «por revisar», los 6 perfumes sin marca y las fotos (Panel → Catálogo, o la vista previa de la tienda).
3. Decidir cuándo abrir la web a Agustín: con Vercel Authentication para todo, solo entra quien tiene cuenta en el equipo de Vercel (en Hobby, solo el titular).
4. Asistente: configurar en Vercel, solo servidor y para Production y Preview, `ANTHROPIC_API_KEY` (de la cuenta de Anthropic del negocio), `CRON_SECRET` (valor aleatorio largo) y `SUPABASE_SECRET_KEY`; opcional `ASSISTANT_DAILY_LIMIT`. No pegar ninguna clave en el chat. La migración ya está aplicada.
5. Dar de alta los proveedores reales (Compras → Proveedores) para que Reposición proponga cantidades.
6. **Pago con tarjeta (Visa) en la web.** El datáfono de la tienda no sirve para cobrar online: hace falta un **TPV virtual** de comercio electrónico del banco (en España casi todos usan Redsys). Pedir al banco y guardar, sin pegarlo en el chat:
   - número de comercio (FUC, 9 dígitos) y número de terminal;
   - clave de firma SHA-256 de pruebas y la real (se ponen como variables de servidor en Vercel);
   - integración **por redirección** (la tarjeta se teclea en la página del banco, nunca en la nuestra), con EMV 3DS, moneda EUR, Visa y Mastercard, notificación online por HTTP y devoluciones activadas; Bizum, Apple Pay o Google Pay si se quieren;
   - acceso al portal de Redsys (Canales) para ver operaciones y devolver.
     Alternativa si el banco tarda: Stripe (cuenta verificada con el IBAN del negocio). Decisiones para el checkout: solo recogida en tienda al principio o también envíos (zonas, tarifas, envío gratis, transportista); qué hacer si llega un pago sin stock (devolución automática o manual); y quién emite las facturas.
7. **Correo transaccional** para confirmaciones de pedido y avisos (recomendado Resend), con acceso al DNS del dominio para SPF y DKIM y el remitente (p. ej. `pedidos@…`).
8. **Datos legales para vender online** (LSSI y consumo): titular (razón social o autónomo), NIF, domicilio, teléfono y email de contacto y datos registrales; con ellos se redactan aviso legal, privacidad, cookies, condiciones de venta y envíos y devoluciones (desistimiento de 14 días), a revisar por la asesoría.
9. **Producción:** dominio con acceso a su DNS; plan Pro de Vercel (Hobby no admite uso comercial); proyecto `adhara-prod` en Supabase (plan con copias diarias); derechos de las fotos oficiales o fotos propias; y la MFA del administrador de la tienda.
10. Decisiones de la fase R: proveedores, plazos y múltiplos; si hay TPV; parámetros del vigilante; si el coste del pedido debe pasar a ser el vigente al recibir (PLAN_TIENDA_REPOSICION.md).
11. Decisiones de la fase S: criterio de valoración que pide la gestoría para el cierre de existencias y margen mínimo (PLAN_INFORMES.md).
12. **Revisión visual de la Fase 2** (criterio 13) en la Preview de la PR de cierre: `/admin/diseno` (incluidos los tonos de colección, D3), la tienda y el panel; y decidir si los filtros de la colección (36 px) deben pasar a 44 px. Aprobarla por escrito en la PR cierra la fase.

## Pendiente técnico

- Activar en Supabase Auth la protección de contraseñas filtradas (aviso del asesor de seguridad; puede requerir plan de pago).

- Tras la importación: fijar PVP (con el cambio masivo o por ficha), revisar marcas y nombres marcados y publicar.
- Compra a Orient Fragance: contenido y precio de los 4 lotes; fotos propias de los seis perfumes sin foto oficial.
- Configuración de Auth en Supabase (Site URL y Redirect URLs con la URL del despliegue; plantillas con `token_hash`) para invitaciones y recuperación por email.
- Fase 1: cerrada con la PR #12, con excepciones escritas (DECISIONS §83–90). Queda diferido a su fase: taxonomía, research y claims, `media_assets`, `tax_rates`, `locales`, `adhara-prod` y el despliegue automático de migraciones.
- Panel: precio del PDF como referencia (A2); compras y proveedores (A3). Confirmar con la asesoría qué debe llevar la etiqueta de estante (precio por unidad de medida, etc.).
- Fotos propias y derechos de las imágenes oficiales antes de abrir al público.
- Escenas 3D para el resto del catálogo (hoy solo las 4 del piloto); medidas reales del kit de tienda.
- Checkout, pedidos, clientes y mensajes (fases A5–A7 del panel; F10–F14).

## Historial

- 28/09: arranque técnico verificado (lint, typecheck, build, 12 E2E; detalle en el historial de Git de este archivo).
- 29/09: despliegue en Vercel verificado; producción privada y en París. Sesión del PR #5: reglas de dominio del panel (A0), `adhara-dev`, personal, permisos, auditoría y acceso con MFA (A1), 22/22 pgTAP y 22 E2E.
- 29–30/09: esta sesión (PR #6): sistema visual, tienda animada con 3D, catálogo, precios, inventario y equipo en el panel.
- 30/09–01/10: fase R (rama `claude/wonderful-babbage-4ojhui`): mostrador, compras a proveedor y reposición, en paralelo al bloque E01–E07 de Codex.
- 01/10: fase S en la misma rama: informes (existencias y cierre mensual, rotación, márgenes, compras por proveedor) y visor de auditoría. Fusionadas las PR #9 y #10.
- 01–02/10: panel sin solapes y más cómodo, informe diario programado y asistente de inventario (PR #11, fusionada; migración aplicada en `adhara-dev`).
- 02/10: cierre de la Fase 1 (PR #12, fusionada): CI en tres workflows, garantías probadas, documentación e informe.
- 02/10: plan de la Fase 2 (sistema de diseño) con objetivos, criterios y tareas.
- 02/10: Fase 2, DS-01 a DS-03: red de seguridad (PR #14), tokens y contraste AA (PR #15) y página de referencia `/admin/diseno`.
- 02/10: Fase 2, DS-04: tipografía con `Heading`, `Text` y `Eyebrow` y escala cerrada.
- 02/10: Fase 2, DS-05: iconos propios, motivos de la estrella y reglas del logotipo.
- 03/10: Fase 2, DS-06: botones, enlaces y envío de formularios con estados y teclado.
- 03/10: Fase 2, DS-07: campos de formulario con etiqueta, ayuda y error accesibles.
- 03/10: preguntas frecuentes plegadas al final de la portada, enlazadas desde el pie (sin reseñas inventadas).
- 03/10: Fase 2, DS-08: diálogos, paneles laterales, confirmaciones y avisos accesibles.
- 03/10: Fase 2, DS-09: estados, etiquetas, precio, tarjetas, tablas, vacíos y carga.
- 03/10: Fase 2, DS-10: la tienda pasa a la biblioteca y a los colores semánticos.
- 04/10: Fase 2, DS-11 y DS-12: el panel pasa a la biblioteca, axe y objetivos de 44 px bloquean, guía e informe de la fase; falta la revisión visual del usuario.

Ver docs/DEVELOPMENT.md para continuar y docs/DECISIONS.md para las decisiones.
