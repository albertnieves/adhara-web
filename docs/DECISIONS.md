# Decisiones del arranque — 28/09/2026

1. Repositorio: adhara-web, privado. Cuenta conectada observada: albertnieves. El usuario lo creó durante la sesión; posteriormente se verificó el acceso del conector y se cambió a privado.
2. Se conserva Git existente; no se crea otro repositorio anidado.
3. Se prepara una base ejecutable, no toda la Fase 1. No se crean cuentas, servicios de pago ni producción como consecuencia de los documentos adjuntos.
4. FASE_0_ARQUITECTURA.md recibido no es la «rev. 2» citada por FASE_1_PLAN.md: propone español sin prefijo y contiene costes en variantes. FASE_1 propone es/ca/en y costes internos separados. Se sigue el plan posterior para el arranque; consolidar el resto antes de migraciones. No inventar ADR-010 a ADR-016 ausentes del documento recibido.
5. Es/ca/en preparados; solo home y catálogo técnicos. Mapa completo de rutas y SEO por estado editorial pendientes.
6. Node 24.16.0 y pnpm 11.19.0, disponibles en esta máquina. Dependencias exactas en package.json y pnpm-lock.yaml.
7. ESLint 9 se mantiene temporalmente por incompatibilidad declarada de los plugins de Next con ESLint 10. Existe aviso de fin de soporte: revisar cuando los plugins admitan 10. TypeScript 6.0 se elige por compatibilidad con typescript-eslint (<6.1); no forzar TypeScript 7.
8. No se exige Supabase durante este arranque. Al implementar conexión se añadirá validación de entorno y se exigirán variables en build y ejecución según su ámbito.
9. No se crea un admin ficticiamente protegido: /admin devuelve 404 hasta implementar auth, roles, MFA y RLS juntos.
10. Sin fuentes externas, datos de producto ni media. La apariencia actual es únicamente técnica.

11. Se usan `next dev --webpack` y `next build --webpack`: Turbopack no puede abrir el puerto de su proceso CSS en este entorno, incluso al solicitar ejecución ampliada. Webpack compiló correctamente. Revisar Turbopack cuando cambie el entorno.

12. Los servidores locales se ligan a localhost para mantener el mismo origen que las reescrituras de Next.js. La prueba con 127.0.0.1 producía bucles en rutas traducidas; con localhost pasan las 12 pruebas. Incidencia similar documentada en https://github.com/vercel/next.js/issues/94342. Verificar por separado el despliegue real. Verificado en Vercel el 29/09/2026: las rutas traducidas responden 200 sin bucles.

## Panel de administración — 29/09/2026

13. El panel se planifica en fases A0–A8 (docs/ADMIN_PLAN.md), enlazadas con el roadmap original. Se empieza por A0: reglas de dominio puras y probadas, sin servicios, dependencias nuevas ni pantallas. /admin sigue en 404 (decisión 9).
14. Roles del personal confirmados por el usuario: `system_admin` (administrador del sistema, todo), `store_admin` (administrador de la tienda in situ, toda la operación incluidos costes y reembolsos, sin usuarios ni configuración) y `viewer` (encargado, solo lectura sin clientes ni costes). Sustituyen a owner/manager/store_staff/content_editor de la Fase 0 §11. Los clientes no son rol de personal: acceso a sus propios datos por RLS.
15. Agente de inventario en dos capas: vigilante determinista (`watchStock`) y asistente conversacional. Solo lee y propone; una persona con permiso aprueba y la propuesta se ejecuta por el caso de uso normal. Para el asistente se propone Claude API con el tool runner del SDK de TypeScript en nuestro servidor; `@anthropic-ai/sdk` no se instala hasta A4.2.
16. El precio anterior tachado se valida con el criterio Ómnibus: no puede superar el PVP más bajo de los 30 días previos. Las excepciones legales (rebajas progresivas) quedan pendientes de asesoría.
17. Esta sesión de Claude Code trabaja en la rama `claude/wizardly-ride-5ul3ai`, asignada por el entorno, en lugar del prefijo `codex/` de AGENTS.md. El cambio se revisa igualmente mediante PR.
18. Vitest resuelve el alias `@/` para que los módulos se importen entre sí por su `index.ts`, igual que en Next.js.
19. Proyecto `adhara-dev` creado el 29/09/2026 en la organización del usuario, región `eu-central-1`, a petición explícita. Migraciones aplicadas con el conector de Supabase y guardadas con la misma versión en `supabase/migrations/`.
20. `public.record_audit_event` es `SECURITY DEFINER` ejecutable por `authenticated` de forma intencionada (aviso 0029 del asesor): es la única vía de escritura en `audit_log`, rechaza a quien no sea personal activo y fija el actor a `auth.uid()`.
21. Sin Docker en la sesión, las pruebas pgTAP se validaron en un Postgres 16 local con una emulación mínima de `auth` y, además, contra `adhara-dev` dentro de una transacción revertida (22/22, sin restos). La emulación no se versiona.
22. Sustituye a la decisión 9: con sesión, roles, MFA y RLS implementados juntos, `/admin` sin sesión redirige a `/admin/acceso`; con sesión pero sin ficha de personal activa responde 404; sin MFA lleva a `/admin/mfa`. La decisión se toma en servidor con `getUser()` (validado contra Supabase Auth), no solo con la cookie.
23. Los textos del panel están en español dentro de sus componentes, fuera de next-intl: el panel no se traduce y así los mensajes públicos mantienen las mismas claves en es/ca/en.
24. Sin variables de Supabase el panel queda cerrado (se comporta como sin sesión). Las variables `NEXT_PUBLIC_*` se incrustan en el build: deben existir también al compilar en Vercel.
25. Invitaciones y recuperación usan `/auth/confirm` con `token_hash` (flujo de servidor). Requiere cambiar las plantillas de email de Supabase (supabase/README.md).

## Tienda visual, catálogo e inventario — 29–30/09/2026 (PR #6)

26. Esta sesión trabaja en la rama asignada `claude/magical-brahmagupta-1hjjko` (PR #6) e incorpora el PR #5 por fusión; el PR #5 queda cubierto por el #6.
27. El usuario pidió el 29/09 una fase avanzada, visual y animada. Se instalan ya three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9 y motion 13.4.4 (versiones exactas). Deja de ser «por anticipación» (AGENTS.md). motion se fija en 13.4.4 porque 13.4.6 no cumplía la antigüedad mínima de pnpm; no se añaden excepciones a esa política.
28. Respuestas del usuario (29/09): los precios del PDF «CATALOGO global 2026» son **PVP**; mientras no haya fotos propias se pueden usar las del PDF y las oficiales de marca en la web privada, **marcadas como provisionales** (`product_media.provisional`) y con su procedencia; la web sigue privada hasta revisarla.
29. Logotipo **provisional**: wordmark tipográfico «ADHARA» con una estrella de cuatro puntas (Adhara es ε Canis Majoris). Paleta marfil / tinta / dorado, Cormorant Garamond + Manrope (next/font/google, autoalojadas en el build).
30. Esquema de catálogo simplificado respecto a las migraciones 0004–0009 del plan: marcas, perfumes, formatos, textos por idioma e imágenes. Sin taxonomía de notas y familias ni tablas de research: la procedencia se guarda en `products.source_ref` y en `product_media.origin/source`. Se ampliará con la importación del catálogo.
31. Publicar exige `catalog.publish` y al menos un formato activo con PVP (trigger). Cambiar PVP o precio anterior exige `pricing.edit_retail` (aal2), comprobado también en un trigger; cada cambio queda en `internal.price_change_log` (solo inserción). La regla Ómnibus se aplica en servidor con ese historial.
32. Política de precios **provisional** hasta que la fije el negocio: sin costes el margen es desconocido; un cambio de PVP del 20 % o más pide confirmación; IVA general 21 % (pendiente de asesoría).
33. Stock: solo cambia mediante `admin_record_inventory_movement` y `admin_record_stocktake` (SECURITY DEFINER, bloqueo de fila, auditoría). Tipos, efectos, permisos y motivos obligatorios están en SQL y en `modules/inventory`; `tests/unit/inventory-sql.test.ts` falla si divergen. Ventas online y reservas no se registran a mano (fase A5).
34. La tienda nunca ve unidades: `storefront_availability` devuelve disponible, últimas unidades (≤ 3, umbral provisional) o agotado.
35. Avisos del asesor de Supabase por funciones SECURITY DEFINER ejecutables (`admin_*`, `storefront_availability`): intencionados como en §20; cada función comprueba el permiso o solo devuelve datos públicos.
36. La tienda lee con un cliente anónimo sin cookies para poder generar páginas estáticas (ISR de 5 min); el panel revalida la tienda al guardar.
37. Página 404: la ruta comodín `[locale]/[...rest]` provocaba un bucle de prefetch en las rutas traducidas (`/ca/cataleg`, `/en/catalog`), el mismo problema que §12. Se elimina: las URL desconocidas usan el 404 por defecto de Next y los perfumes inexistentes el 404 con diseño.
38. Formularios del panel con `useAdminAction`: evita el reinicio automático de React 19 al terminar una acción, que borraba lo escrito al mostrar un error o pedir una confirmación de precio.
39. El personal con historial no se borra de Auth: la auditoría y los movimientos son de solo inserción y su clave `on delete set null` lo impide. Se desactiva desde Equipo (y, si hace falta, se bloquea la cuenta). Así se hizo con la cuenta temporal de la prueba de extremo a extremo.
40. `inventory_levels` se borra en cascada con su formato (migración 20260929230737); los movimientos siguen con `restrict`, así que un formato con historial no se puede borrar.
41. Imágenes subidas desde el panel: hasta 4 MB (Vercel limita el cuerpo de la petición a 4,5 MB). Las fotos de estudio con fondo gris claro se funden con el fondo mediante brillo +4 % y `multiply`.
42. La escena de unboxing se porta del piloto a `src/modules/unboxing` e importa las texturas desde `pilot/` con alias (sin duplicarlas). Para las imágenes de producto se copian 7 fotos oficiales a `public/media/pilot/` (1,1 MB) con su procedencia.
43. Vercel: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de `adhara-dev` en Preview, Production y Development hasta que exista `adhara-prod`. Son valores públicos; no hay claves secretas en Vercel ni en el repositorio.
44. Roles preasignados por email (`private.pending_staff_grants` y trigger en `auth.users`): al crear y confirmar la cuenta recibe su rol, sin SQL ni clave secreta. Los emails del personal se guardan solo en la base de datos, no en el repositorio. Probado en transacción revertida (alta confirmada, invitación confirmada después y cuenta sin preasignación).
45. Costes internos: el coste de compra es **neto (sin IVA)** por formato y se guarda en `internal.variant_cost_records`, de solo inserción (el vigente es el último registro) y sin clave foránea, como el historial de PVP. Solo se lee con `admin_variant_costs` (`pricing.view_cost`) y se escribe con `admin_record_variant_cost` (`pricing.edit_cost`), ambos con MFA. La auditoría guarda quién y cuándo, no el importe. El margen se calcula sobre el PVP sin IVA y solo quien ve costes recibe los avisos «por debajo del coste» al cambiar el PVP (el aviso ya revela el coste). Pruebas: pgTAP `03_costs`, `tests/unit/cost-isolation.test.ts` (la tienda no referencia costes; solo el panel los pide) y `tests/e2e/cost-leak.spec.ts` (ninguna respuesta pública, HTML ni RSC, los contiene).
46. Etiquetas de precio: se imprimen desde el navegador (sin librerías) en hojas A4 de 3 × 7 de 63,5 × 38,1 mm, con medidas en mm y pt y `@page` propio. Incluyen marca, nombre, concentración, formato, PVP con IVA, precio por 100 ml y SKU; en rebaja, «Antes» con el precio anterior, que ya está validado con Ómnibus. Se generan para borradores y publicados (en la tienda física se vende también lo que aún no está online). No se ha verificado con la asesoría el contenido obligatorio de la etiqueta.
47. Vista previa de la tienda para el personal con Draft Mode de Next: se entra con una Server Action del panel que exige `catalog.edit` con MFA. En ese modo la tienda lee con la sesión del usuario y pide borradores y publicados; RLS decide qué devuelve, así que una cookie de vista previa sin sesión de personal solo muestra lo publicado. Next no guarda estas páginas en la caché ISR (`Cache-Control: private, no-store`). El proxy refresca la sesión de Supabase solo en las peticiones con la cookie de vista previa. Se sale con un POST a `/api/vista-previa/salir` que responde 303: con una Server Action la redirección se renderizaba aún con la cookie y seguía mostrando borradores. Las funciones de lectura pasan a llamarse `listStorefrontProducts` y `getStorefrontProduct`.
48. Importación de catálogo por CSV (`modules/catalog/domain/import.ts`, puro y probado): columnas en español con alias, separador «;» o «,», precios «49,90» o «1.299,00». Se reconoce lo existente por marca + nombre normalizado y, en formatos, por SKU o por ml + etiqueta. Todo lo nuevo se crea en borrador con su procedencia (`source_ref`); de un perfume existente solo se completan campos vacíos; un PVP distinto del actual queda como conflicto y no se aplica (se cambia en la ficha, con Ómnibus). Sin `pricing.edit_retail` los formatos se crean sin PVP. La acción vuelve a leer y planificar en servidor antes de aplicar y es idempotente; se audita como `catalog.imported`. Pensado para el PDF «CATALOGO global 2026»: se pasará a CSV y se revisará antes de importar.
49. SEO de idiomas: `buildAlternates` (`modules/i18n/seo.ts`, pura) da canonical, hreflang de los idiomas publicados con `x-default` → español y `noindex` si el idioma actual no está publicado. Las páginas fijas (home, colección) están publicadas en los tres idiomas; en una ficha, el español es la base (nombre, marca, precio) y ca/en cuentan cuando tienen texto propio. Nunca activa la indexación: mientras la web sea privada, el layout mantiene `noindex` para todo. Las URL absolutas salen de `NEXT_PUBLIC_SITE_URL` o, sin dominio definitivo, de la URL de Vercel del entorno.
50. Escaneo de secretos propio (`scripts/scan-secrets.ts`, `pnpm scan:secrets`, paso de CI): patrones de claves de Supabase (secretas, JWT), claves privadas, Stripe, AWS, GitHub, Anthropic, OpenAI, Resend y URL de Postgres con contraseña, sobre los archivos versionados. Nunca imprime el valor encontrado. Las claves publicables no cuentan. Cubre el criterio 13 de la Fase 1 sin añadir dependencias; activar también el secret scanning de GitHub cuando el plan lo permita.
51. Listados sin tope de 1000 filas: PostgREST de Supabase devuelve como mucho 1000 filas por petición, así que catálogo del panel, stock, marcas, etiquetas, tienda, importación y movimientos piden por tramos con orden estable (`lib/supabase/paginate.ts`); los costes se piden en tramos de 500 formatos. Se hace antes de importar el catálogo real, cuyo tamaño aún no se conoce.
52. Exportación de movimientos en CSV para Excel en español (`;`, BOM, CRLF), con los mismos filtros que el historial (días de la tienda, Europe/Madrid) y hasta 20 000 filas. Los textos que empiezan por `= + - @` se prefijan con `'` para evitar inyección de fórmulas (motivos y referencias los escribe el personal).
53. Cambio masivo de PVP (`modules/pricing/domain/bulk.ts`, puro y probado): hasta 300 formatos por cambio, revisados con `reviewPriceChange` como un cambio individual (con coste solo si se tiene permiso). Se excluyen los formatos en rebaja, porque su precio anterior depende de Ómnibus. La acción vuelve a calcular en servidor, aplica solo las filas marcadas y con todas sus confirmaciones, y actualiza con la condición de que el PVP siga siendo el revisado (si cambió entretanto, no se toca). Se audita un resumen (`pricing.bulk_changed`); el trigger guarda cada cambio en el historial de PVP.
54. Catálogo real y costes en la importación. El usuario decidió el 30/09 que los precios del PDF «CATALOGO 2026» son **coste interno**, no PVP (sustituye lo dicho en §28), y que las marcas que el catálogo no indica (pp. 2–26) se deduzcan y se marquen como pendientes de revisión. El importador acepta una columna «coste» (alias coste, precio compra, mayorista…), neta o con IVA del 21 % que se pasa a neto (redondeo bancario); se registra con `admin_record_variant_costs` en lotes de 500 (todo o nada por lote, `pricing.edit_cost` con MFA) solo si el usuario también ve costes, para no repetir un coste igual al vigente. Una fila sin ml, etiqueta ni SKU se asigna al único formato del perfume si ya tiene uno (así el coste del catálogo cae en el formato del piloto). El CSV y el PDF quedan fuera del repositorio porque contienen costes del proveedor. En el campo «origen» de cada fila consta la página, cómo se dedujo la marca (caja de la foto, línea de producto, emblema del tapón o sección del catálogo), la etiqueta original si el nombre cambia y las incidencias; nunca importes. Cuando la foto no corresponde a la etiqueta y la etiqueta repite otra del catálogo, se usa el nombre de la caja; los duplicados con el mismo precio se fusionan.
55. Fotos del catálogo real (30/09, a petición del usuario: «busca fotos óptimas de internet»). Se usan primero las **fotos oficiales de la marca**, sacadas del catálogo público de su web (lattafa-usa.com, lattafa.com, armaf.com, frenchavenue.com, emperperfumes.com, swissarabian.com, lefalcone.com, beautyandperfumeintl.com para Amaran, Camara y Le Falcone, myperfumes.ae para Arabiyat Sugar y mamlakataloud.ae). Cada emparejamiento se comprobó a ojo contra la foto del PDF; se descartaron los que no coincidían (p. ej., Bint Hooran, cuya web solo tiene la versión rosa). Cuando la marca no tiene web accesible (Maison Alhambra, submarcas de Emper, Orientica, Al Haramain…), se recorta la foto del propio catálogo, sin texto ni precios. `product_media.origin` distingue `brand_official` (con la página del producto en `source`) de `catalog_pdf` (con la página del catálogo). Todas son provisionales hasta tener fotos propias y confirmar los derechos antes de abrir al público. El cruce con las webs oficiales corrigió marcas y nombres del CSV (versión 2): por ejemplo, Sehr y Afeef son de Lattafa, Kings & Queens de Amaran y hay dos Fanoos distintos. La subida al bucket `product-media` necesita una sesión de personal con `media.edit`; no se añadió ninguna vía de subida que evite esa autorización. El usuario autorizó expresamente usar la cuenta temporal de prueba: se reactivó solo con el rol de tienda, subió las 647 imágenes y se retiró de nuevo (sin rol, bloqueada, sin sesiones ni MFA y con contraseña aleatoria). Para que las fotos tengan a qué enlazarse, los 420 perfumes nuevos se crearon como **borradores sin formatos, PVP ni costes** (`supabase/data/20260930_catalogo_2026.sql`, con la misma marca, nombre y slug que produce el importador). Los formatos y costes siguen entrando por el CSV desde el panel con MFA, que reconoce esos perfumes y no crea duplicados.

## Identidad de marca — 30/09/2026

56. El usuario definió el nombre, **L’Atelier du Désert**, y el logotipo: emblema ovalado con luna, estrella y dunas, el nombre en dos líneas y «Haute Parfumerie Orientale». Sustituye al nombre y logotipo provisionales ADHARA (§29).
    - El original está en `docs/brand/logo-original.png`.
    - Se vectorizó con potrace sobre el PNG ampliado ×4, sin redibujar nada. Comparado con el original, todas las diferencias caen en el borde de 1 píxel del contorno.
    - Los trazos están en el sprite `public/brand/logo.svg`, con tres símbolos:
      - `emblem`;
      - `wordmark`: nombre en una línea; «du Désert» se iguala en altura de x con «L’Atelier», que en el original va un 7,5 % mayor;
      - `lockup`: composición original completa.
    - Se usan con `<use>` y `currentColor`: un archivo en caché, que no infla el HTML y hereda el color (marfil sobre fondo oscuro, tinta sobre claro).
    - `BRAND_NAME` y `BRAND_TAGLINE` en `modules/brand` alimentan los títulos, el panel y el nombre del factor TOTP que ven las apps de autenticación.
    - Los textos descriptivos («Perfumería árabe…») y la paleta y tipografías de la web no cambian.
    - Los identificadores internos (repositorio, paquete, `adhara-dev`) conservan `adhara` para no romper integraciones. El proyecto de Vercel se renombró a `altier-web` el 05/10 (§112).

## Publicación y compra — 30/09/2026

57. PVP y publicación, por decisión del usuario («establece los que tiene la tienda oficial en su web»).
    - La tienda oficial es **orientfragance.com**, distribuidor oficial en España y Portugal y proveedor de la compra (su lista lleva su membrete). El PVP de cada perfume es el de su ficha allí, en euros con IVA, y su URL queda en `products.source_ref`.
    - Tres perfumes del piloto no se venden allí: Asad, Khamrah y Club de Nuit Intense Man LE. El usuario eligió el precio de la web oficial de la marca en EE. UU. (lattafa-usa.com y armaf.com), pasado a euros con el cambio de referencia del BCE del día y redondeado al céntimo. Los precios de EE. UU. no incluyen impuestos.
    - Sin PVP en la tienda oficial ni otra decisión, un perfume queda en borrador: no se inventan precios. Para los tres de la compra que la tienda oficial no vende, el usuario fijó 49,50 €.
    - Cada perfume comprado tiene un único formato. Así las filas sin tamaño del CSV del catálogo se asignan a ese formato y no crean otro. Los aceites concentrados de 20 ml son perfumes aparte, como en la tienda oficial.
    - El stock inicial de la compra (20 uds por formato, confirmado por el usuario) se registró por SQL como carga de datos, con las mismas escrituras que `admin_record_inventory_movement` (nivel, movimiento `PURCHASE_RECEIPT` y auditoría), sin actor y con la referencia `compra-orient-fragance-2026-09-30`. La función exige una sesión de personal y no se usó ninguna cuenta para suplantarla.
    - Fotos de los perfumes nuevos: solo oficiales de marca (armaf.com, frenchavenue.com, lattafa-usa.com, 3saf.com, laverne.co, bhararabeauty.com, jomilanoparis.com y reefperfumes.com), comprobadas una a una contra la foto de la tienda oficial. Se descartan las que no coinciden (Miss Sakura), los logos y los carteles. Sin foto oficial, la tienda muestra la imagen de reserva hasta que haya foto propia.

## Tienda física y reposición — 30/09–01/10/2026 (fase R)

Plan y criterios en [PLAN_TIENDA_REPOSICION.md](PLAN_TIENDA_REPOSICION.md). Si al fusionar con el bloque E01–E07 de Codex coincide la numeración de estas decisiones, se renumeran las de esta sección.

58. La fase R se desarrolla en paralelo a E01–E07, en la rama asignada por el entorno `claude/wonderful-babbage-4ojhui` (como §17). Para no pisar ese trabajo solo añade tablas, funciones y pantallas: no cambia la matriz de permisos, ni `admin_record_inventory_movement`, ni tablas existentes, ni el inicio del panel (E06). Las funciones nuevas llaman a la de movimientos con argumentos por nombre, así que sus reglas, bloqueo de fila y auditoría se aplican igual.
59. **El mostrador no es un TPV.** Descuenta unidades (`SALE_STORE`) o las devuelve (`RETURN`) y guarda el nº de ticket del TPV o de la caja, pero no emite tickets ni guarda importes: un sistema que expida tickets o facturas tendría que cumplir el reglamento de sistemas de facturación (Veri\*factu), y eso se decide con la asesoría y según el TPV que haya. La venta es todo o nada (`admin_record_store_sale`, en orden de formato para evitar bloqueos cruzados) y una línea sin unidades detiene todo e indica el formato. Una clave de petición generada en la tablet hace que un doble toque o un reintento tras un corte de red registren una sola venta; cambia en cuanto cambia el ticket. Aunque `inventory.sell_in_store` no exige MFA por sí mismo, la función la exige (línea de E02). En pantalla, una línea con más unidades que las disponibles bloquea el botón: si el perfume está en la mano, el stock está mal y se corrige con un recuento.
60. **Proveedores y pedidos en `internal`**, fuera de la API: solo se leen con funciones que exigen `purchasing.manage` (con MFA) y el coste unitario de las líneas llega vacío sin `pricing.view_cost`. Los pedidos se numeran `PC-AAAA-NNNN` (secuencia única, año de Madrid). Estados: borrador → pedido → recibido en parte → recibido, o cancelado y cerrado con faltas; las transiciones manuales están en SQL y en `modules/purchasing` y `tests/unit/purchasing-sql.test.ts` falla si divergen. Cada cambio indica la revisión que vio la persona (`stale_revision` si otra lo cambió entretanto). Solo los borradores se borran.
61. **Recepción.** `admin_receive_purchase_order` bloquea el pedido, no deja recibir más de lo pedido, suma stock con `PURCHASE_RECEIPT` (referencia: número del pedido y albarán) y guarda la recepción y sus líneas (solo inserción). Repetir la clave de petición devuelve la recepción ya registrada. Opcionalmente, con `pricing.edit_cost`, el coste del pedido pasa a ser el vigente cuando difiere; la auditoría guarda cuántos, no los importes (como §45). Recibir más de lo pedido no se admite: el exceso entra como recepción normal desde Inventario.
62. **Proveedor de reposición** de un formato: el preferente activo o, si no hay, el único activo. Con varios y ninguno preferente no se elige y la propuesta queda «sin proveedor de reposición». Se pueden asignar todos los formatos de una marca (o del catálogo) de una vez; solo se marcan como preferentes donde no había otro.
63. **Vigilante (A4.1) sin tarea programada.** Se calcula al abrir Reposición con la sesión de quien mira: no hace falta clave secreta ni cron (que llegará con el proveedor de email, cuando haya a quién avisar). `admin_stock_watch_facts` da ventas de la ventana, primera entrada, suma de movimientos, plazo y múltiplo del proveedor de reposición y lo pendiente de recibir, sin nombres de proveedor ni costes, así que el encargado también lo ve. Parámetros provisionales en `stock_watch_settings` (30 días de ventas, 30 de cobertura, 7 de colchón y 120 sin ventas para inmovilizado), visibles para quien tiene `inventory.view` y editables con `settings.manage`. Los borradores que nunca tuvieron stock no se tratan como agotados. Si el nivel no coincide con la suma de sus movimientos sale como urgente (en `adhara-dev` cuadran los 46 niveles, comprobado el 30/09 con una consulta de solo lectura). Las propuestas se convierten en borradores de pedido por proveedor solo por acción de una persona con permiso de compras.
64. **Validación sin tocar `adhara-dev`.** Docker funciona en este contenedor: se levantó Supabase local con la CLI 2.119.0 fuera del repositorio (el `config.toml` es de E01), con las migraciones del repo, los datos de `supabase/data/` y cuentas locales ficticias con MFA. En `adhara-dev` solo se hicieron dos consultas de solo lectura. La migración se aplicará cuando se fusione, después de las de Codex si van antes, renombrando el archivo con la versión real como las anteriores.
65. Observación para E07: con sesión de personal sin el permiso de una página, el panel muestra «no encontrado» pero responde 200, no 404, porque `loading.tsx` ya ha empezado a enviar la respuesta cuando la página llama a `notFound()`. No se filtra ningún dato. Pasa igual en las pantallas existentes (Catálogo, Equipo) y en las nuevas.

## Informes y control — 01/10/2026 (fase S)

Plan y criterios en [PLAN_INFORMES.md](PLAN_INFORMES.md). Misma rama y PR que la fase R, sobre la que se apoya (usa compras, recepciones y ventas de mostrador).

66. La fase S se adelanta a A6.1 (mensajes) y A5 (pedidos online) porque esas fases esperan decisiones del negocio: proveedor de email, textos legales del formulario de contacto, cuenta de Stripe y envíos. Los informes solo necesitan datos que ya existen. Se hacen los informes y el visor de auditoría de A8; el dashboard (E06) y la configuración de la tienda (E05) siguen siendo de Codex.
67. **Solo lectura, sin tablas nuevas.** `admin_report_inventory_period` (con `reports.view`) devuelve por formato las existencias iniciales, entradas, ventas, devoluciones, mermas y probadores, ajustes, traslados y existencias finales de un periodo, sumando movimientos. Como todo cambio de unidades es un movimiento, iniciales + movimientos = finales. Las categorías de cada tipo están en SQL y en `modules/reports`, y `tests/unit/reports-sql.test.ts` falla si divergen. `admin_report_purchases` exige `purchasing.manage`, porque muestra proveedores.
68. **Valoración a coste:** último coste neto registrado antes de la fecha. Si un formato no tenía coste a esa fecha, se usa el primero registrado después y se marca. Sin ningún coste, sus unidades no suman y se cuentan aparte: nunca valen 0. Sin `pricing.view_cost` (con MFA), los informes van en unidades. No es FIFO ni precio medio ponderado; confirmar con la asesoría qué pide la gestoría.
69. Las ventas se cuentan en unidades. El mostrador no guarda importes (§59) y no se estiman ingresos con el PVP actual, que pudo cambiar o tener descuentos.
70. Rotación = vendidas ÷ stock medio del periodo, aproximado como la media de iniciales y finales. Cobertura = existencias de hoy ÷ ritmo de venta del periodo. Periodos en días y meses de la tienda (Europe/Madrid), también en los cambios de hora.
71. Margen teórico = PVP sin IVA (IVA general del 21 %, §32) menos el coste vigente, sobre el PVP sin IVA. No incluye descuentos, envíos ni comisiones. Margen mínimo provisional del 0 %.
72. Plazo real de un pedido = de su marcado como pedido a su primera recepción, en el periodo de esa recepción. Si difiere del declarado en más de un día, el informe lo señala, porque el vigilante de Reposición propone cantidades con el declarado.
73. **Auditoría:** visor con `staff.manage` (la RLS ya existía), filtros por área (prefijo de la acción), persona y fechas, y 50 entradas por página. Muestra solo las claves que cambian. Las entradas sin persona son cargas de datos. Los cambios de coste siguen anotándose sin importes (§45).

## Panel más cómodo y asistente de inventario — 01/10/2026

A petición del usuario («mejorar el panel, que sea más interactivo y cómodo; muchas cosas se solapan» y «empezar a integrar el bot que nos dará reportes diarios y automatizará el trabajo»), antes de cerrar la Fase 1. Rama `codex/panel-asistente`.

74. **Causa de los solapes del panel.** El lateral era `flex-wrap` también en escritorio: con poca altura de ventana (portátil o tablet en horizontal, por debajo de unos 900 px) el menú saltaba a una segunda columna y se pintaba sobre el contenido. Ahora el lateral no envuelve, tiene desplazamiento propio y agrupa las secciones (Tienda, Web, Análisis, Administración, Próximamente). En tablet vertical y móvil el menú es un panel deslizante (`<dialog>` nativo: foco atrapado, Esc y toque fuera para cerrar) que incluye la vista previa y la tienda pública. Se encontró con una auditoría automática en navegador (solapes de cajas, texto que se sale de su caja y desbordes) a 390, 768, 1024 y 1280 px, repetida tras los cambios sobre las 23 pantallas.
75. **Acciones en panel lateral (`Sheet`) y avisos (`toast`).** Movimiento, recuento y aviso de stock se abrían dentro de la fila de la tabla, la estiraban y quedaban cortados (en el móvil, fuera de la pantalla). Ahora se abren en un panel lateral con el perfume, el formato y las cifras actuales; al guardar se cierra y queda un aviso con el resultado. Los errores siguen en el formulario. Sin dependencias nuevas: `<dialog>` y CSS (`@starting-style`).
76. **Tablas en el móvil y búsqueda al escribir.** Inventario, ficha de perfume, catálogo, movimientos y compras pasan a fichas apiladas por debajo de 768 px (`stack-table` con `data-label`) en lugar de desplazarse en horizontal; los informes con muchas columnas numéricas conservan el desplazamiento. Catálogo e inventario filtran mientras se escribe (la URL se actualiza; con Intro y sin JS sigue funcionando). La ficha de perfume tiene una barra fija para saltar entre secciones. Botones del panel con 44 px de alto (`panel-btn`), casillas de 20 px y el inicio con accesos con aspecto de botón y cifras en dos columnas en el móvil.
77. **Informe diario (A4.1 con tarea programada).** Se calcula en TypeScript (`modules/assistant/domain/daily-report.ts`, puro y probado) a partir de lecturas que ya existían: movimientos del día (categorías de `MOVEMENT_REPORT_BUCKET`, las mismas que el cierre mensual), stock, hallazgos del vigilante (agotados y bajo mínimo salen de `watchStock`, así un borrador que nunca tuvo stock no cuenta como agotado), pedidos abiertos y pendientes del catálogo. Guarda **unidades y estados, sin costes, importes ni nombres de proveedor**, para que lo lea también el encargado. Cada tarea lleva el permiso de su pantalla y solo se muestra a quien puede abrirla. Se guarda en `public.daily_reports` (uno por ubicación y día de la tienda), que el personal con `agent.use` lee y **nadie escribe por la API**: solo el servidor con la clave privilegiada.
78. **Tarea programada.** Vercel Cron llama cada mañana a `/api/cron/informe-diario` (`vercel.json`, 05:15 UTC; en Hobby puede ejecutarse en cualquier momento de esa hora) con `CRON_SECRET`, comparado en tiempo constante; sin él configurado, responde 503 y no hace nada. Guarda el informe del día anterior con `SUPABASE_SECRET_KEY` (cliente `createJobClient`, solo para esto). Para leer el vigilante y los pedidos sin sesión de personal, `admin_stock_watch_facts` y la nueva `admin_open_purchase_orders` aceptan también `service_role` (`private.is_service_role()`, sobre el JWT que valida la API). Desde el panel, «Guardar informe» lo hace bajo demanda quien tiene `reports.view` con MFA (administradores), hasta 10 al día por persona: cada resumen es una llamada a Claude.
79. **Asistente conversacional (A4.2, primera versión).** Claude con el SDK oficial de TypeScript (`@anthropic-ai/sdk` 0.130.0 fijada; la 0.131.0 no cumplía la antigüedad mínima de pnpm y no se añadió excepción) y el _tool runner_ con herramientas zod. Modelo `claude-opus-5-5` (§ADMIN_PLAN A4.2), `effort: medium`, pensamiento adaptativo por defecto, respaldo en servidor ante rechazos (`fallbacks: "default"`), caché automática de prompts y respuesta en streaming (una línea JSON por evento) desde `/admin/asistente/consulta`. Herramientas **solo de lectura**, con la sesión de quien pregunta (RLS y permisos de su rol): `buscar_stock`, `movimientos`, `reposicion` e `informe_diario` (`inventory.view`), `ventas_por_periodo` (`reports.view`) y `pendientes_catalogo` (`catalog.edit`). Sin costes, márgenes ni datos personales; los nombres de perfume se tratan como datos. No hay herramientas de propuesta todavía: el asistente indica la pantalla donde se actúa (por ejemplo, Reposición → borradores de pedido). `tests/unit/assistant.test.ts` falla si una herramienta escribe, llama a una función de escritura o usa la clave privilegiada.
80. **Coste y control.** `public.assistant_usage` registra cada consulta (persona, modelo, tokens, herramientas); es de solo inserción, cada persona inserta y ve lo suyo con MFA y `staff.manage` lo ve todo. Tope de consultas por persona y día con `ASSISTANT_DAILY_LIMIT` (40 por defecto), hasta 8 vueltas de herramientas por pregunta y 60 s por petición (`maxDuration`). Sin `ANTHROPIC_API_KEY` el chat se muestra como «no activado» y el informe diario funciona igual, sin resumen redactado. Preguntar está abierto a los tres roles (`agent.use`, como preveía el plan); guardar informes, solo a administradores.
81. **Pruebas sin coste.** El bucle completo (herramienta con la sesión real, resultado devuelto al modelo, streaming, registro de uso) y la tarea programada se validaron contra una imitación local de la API de mensajes (`ANTHROPIC_BASE_URL`), sin llamadas reales ni clave del usuario. La primera llamada real se hará cuando el usuario configure su clave.
82. **Pagos.** El usuario indicó el 01/10 que cobrará con tarjeta de crédito y débito (Visa) mediante un TPV y que le faltan sus datos; también falta elegir el proveedor de correo. El proveedor de pago del checkout (la Fase 0 suponía Stripe) queda pendiente de esos datos, y no se instala nada de pagos por anticipación.

## Cierre de la Fase 1 — 02/10/2026

A petición del usuario («cierra las siguientes fases»; alcance elegido: la Fase 1 completa). Rama `codex/cierre-fase-1`. Informe en [phases/FASE_1_REPORT.md](phases/FASE_1_REPORT.md).

83. **Registro de ADR.** El plan de la Fase 1 pide ADR-001 a ADR-016 con ADR-008 sustituida por ADR-010. La Fase 0 recibida enumera nueve ADR iniciales (§16) y el plan de la Fase 1 define el contenido de ADR-010 (§2 y §6). Se registran esos diez en la sección siguiente con el formato de la Fase 0. ADR-011 a ADR-016 no constan en ningún documento recibido y no se inventan (§4). Las decisiones numeradas de este archivo siguen siendo el registro detallado.
84. **CI en tres workflows** (`.github/workflows/`): `ci.yml` (secretos, formato, lint, tipos, unitarias y build), `db.yml` (`supabase start`, `db reset`, pgTAP, tipos, `db lint` y concurrencia) y `e2e.yml` (Supabase local, tienda pública a 390×844 y 1440×900 con el coste centinela y recorridos autenticados). Diferencias con el plan §13:
    - `db.yml` se ejecuta en todas las PR, no solo en las que tocan `supabase/`: la protección de `main` exige los tres workflows y un filtro por rutas dejaría la comprobación pendiente en las demás.
    - `e2e.yml` usa Supabase local con `tests/fixtures/test-db.sql` (perfume ficticio publicado con coste de 987654 céntimos, proveedor y referencia con ese número) y añade los recorridos autenticados.
    - `supabase db lint` (plpgsql_check) falla con cualquier error salvo tres falsos positivos conocidos: tablas temporales que la propia función crea al ejecutarse (`scripts/check-db-lint.ts`). Dos avisos de nivel `warning` (una conversión en `parse_quantity_items` y `admin_get_content` marcada `STABLE`) no bloquean.
    - No se crea el workflow de despliegue de migraciones: se siguen aplicando en `adhara-dev` con el conector y la misma versión (§19). Automatizarlo exige secretos de Supabase en GitHub y el proyecto `adhara-prod`; se hará con él.
85. **Criterio 8** («`db reset` aplica las 11 migraciones y el seed en local y en `adhara-dev`»). Hoy son 17 migraciones y no hay seed: los datos de referencia viven en las migraciones. `db.yml` ejecuta `supabase db reset` desde una base vacía en cada PR y en `main`. En `adhara-dev` no se ejecuta: borraría datos reales (458 perfumes, stock, imágenes y cuentas del personal). Se sustituye por paridad de versiones: las 17 registradas en `adhara-dev` son las de `supabase/migrations/` (lista de migraciones del 02/10). Excepción aceptada.
86. **Esquema del plan (§8) diferido a su fase.** No se migraron en la Fase 1:
    - `locales`: los tres idiomas están en código y en restricciones `check`; se añadirá si hace falta activarlos sin desplegar;
    - taxonomía (`product_lines`, `categories`, `olfactory_families`, `fragrance_notes`, `accords`) y research (`catalog_imports`, `catalog_raw_items`, `sources`, `product_claims`, `product_conflicts`, `product_field_provenance`): F3 y F4, sin sembrar familias ni notas;
    - `media_assets`, `product_3d_assets` y `visual_briefs`: F7 y F8 (hoy `product_media` con origen, fuente y marca de provisional);
    - `tax_rates`: con el checkout (F10); hoy IVA del 21 % en código;
    - `collections` y `slug_redirects`: F5 y F15;
    - buckets `catalog-source`, `product-media-drafts`, `models-3d`, `brand-media` y `references`: con su fase (hoy existen `product-media` y `editorial`);
    - `can_publish` completo (traducción publicada, imagen aprobada no PDF, sin conflictos críticos): hoy publicar exige `catalog.publish` y un formato activo con PVP (§31); el resto llega con F4 y F7.
87. **Criterio 15** («primer owner real creado con `bootstrap-owner` y con MFA»). El owner es `system_admin` (§14). La cuenta la creó el usuario el 30/09 y recibió el rol por preasignación (§44), no con `scripts/bootstrap-owner.ts`, que queda para entornos nuevos. Tiene TOTP verificado desde el 01/10 (lectura del 02/10). Cumplido; la diferencia de método queda escrita. La cuenta del administrador de la tienda aún no tiene MFA.
88. **Criterio 18** («ningún dato de producto en dev ni en prod»). Superado por decisión del usuario: pidió una fase visual con los perfumes del piloto (§27–28) y después la carga del catálogo y de la compra (§54–57). `adhara-dev` tiene 30 marcas y 458 perfumes (50 publicados), todos con su procedencia. No existe `adhara-prod`.
89. **Acciones del usuario** que esta sesión no puede hacer: protección de `main` en GitHub (PR obligatoria y `CI`, `Database` y `E2E` en verde), crear `adhara-prod` y separar Production antes del lanzamiento, MFA del administrador de la tienda y claves del asistente en Vercel. Las pruebas que el plan §14 nombra se cubren con otros archivos; la correspondencia está en el informe.
90. Con §83–89, los 19 criterios del §16 quedan cumplidos o con una excepción escrita. La Fase 1 se cierra al fusionar la PR del cierre con los tres workflows en verde. Siguiente fase recomendada: Fase 2 (Design System) en paralelo con la preparación de la Fase 3. La prioridad de negocio, el checkout con TPV, sigue esperando los datos del TPV.

## Registro de ADR

Formato de la Fase 0 §16: fecha · contexto · decisión · alternativas descartadas · consecuencias · estado. Nunca se borra un ADR: se sustituye. Fecha de origen: Fase 0 y plan de la Fase 1, 28/09/2026; registrados el 02/10/2026.

- **ADR-001 · Monolito Next.js con módulos de dominio.** Contexto: tienda y panel de un solo negocio con un equipo pequeño. Decisión: una aplicación Next.js App Router en Vercel; la lógica en `src/modules/<dominio>` y `app/` solo enruta. Alternativas descartadas: no constan en la Fase 0 recibida, que sí descarta estado global de cliente, Algolia, CMS externo y librerías de formularios (§2). Consecuencias: un solo despliegue; los límites entre módulos son convención (`index.ts` / `server.ts`) y revisión. Estado: aceptada e implementada.
- **ADR-002 · Producto y variante, con precio y stock en la variante.** Contexto: un perfume se vende en varios formatos. Decisión: `products` y `product_variants`; PVP en la variante y stock por variante y ubicación. Consecuencias: etiquetas, mostrador y compras trabajan por formato; un perfume sin formato con PVP no se publica; el coste no está en la variante, sino en `internal` (§45). Estado: aceptada e implementada.
- **ADR-003 · Procedencia mediante claims.** Decisión: cada dato es una afirmación con origen, fuente y evidencia (Fase 0 §7). Consecuencias: hoy, procedencia simplificada en `source_ref` y en la media (§30). Estado: aceptada como diseño; aplazada a la F4 (§86).
- **ADR-004 · Estados de publicación, research y media separados.** Estado: aceptada en parte: `products.status` (borrador, publicado, archivado) y `product_media.provisional`; el estado del research llega con la F4.
- **ADR-005 · Reserva de stock atómica en Postgres.** Decisión: el stock solo cambia en funciones con bloqueo de fila. Consecuencias: movimientos, recuentos, mostrador y recepciones con claves de petición, probados con 24 sesiones concurrentes. Estado: aceptada; las reservas del checkout llegan con la F10.
- **ADR-006 · El precio siempre se calcula en el servidor.** Estado: aceptada e implementada ([PRICING.md](PRICING.md)).
- **ADR-007 · 3D solo en la ficha y bajo demanda.** Estado: aceptada: la escena se carga con `next/dynamic` en la ficha (y en la vista previa del panel) y detecta WebGL.
- **ADR-008 · Solo español en el lanzamiento, sin prefijo `/es`** (Fase 0 §4). Estado: **sustituida por ADR-010**.
- **ADR-009 · Roadmap reordenado** (backend e importación antes que las páginas). Estado: aceptada; [ROADMAP.md](ROADMAP.md) muestra el estado. El usuario adelantó la parte visual (§27) y la operativa (fases R y S).
- **ADR-010 · Español, catalán e inglés con prefijo.** Contexto: el plan de la Fase 1 implementa «§4.1 de la Fase 0 (ADR-010)» con tres idiomas, y la decisión §4 sigue el plan posterior. Decisión: next-intl con `es`, `ca` y `en`, español por defecto, `localePrefix: 'always'`, rutas traducidas, negociación en `/` (cookie > `Accept-Language` > español, 307) y `buildAlternates` para canonical y hreflang. Alternativas descartadas: ADR-008, que obligaba a migrar las rutas con redirecciones al añadir idiomas. Consecuencias: todas las URL públicas llevan prefijo; los mensajes tienen las mismas claves en los tres idiomas (prueba); los textos del catálogo van por idioma; el panel queda en español (§23). Estado: aceptada e implementada ([I18N.md](I18N.md)). **Sustituye a ADR-008.**
- **ADR-011 a ADR-016.** Citadas por el plan de la Fase 1 («Base: … ADR-001 a ADR-016») sin contenido en los documentos recibidos. No se registran (§4, §83); se añadirán si llega la Fase 0 rev. 2.

## Plan de la Fase 2 — 02/10/2026

91. **Plan de la Fase 2 (sistema de diseño)** en [phases/FASE_2_PLAN.md](phases/FASE_2_PLAN.md), a petición del usuario («prepara el sistema de diseño de la fase dos, deja marcadas las tareas y establece los objetivos»).
    - **Contenido:** 7 objetivos, 13 criterios de cierre, 6 decisiones con recomendación (D1–D6) y 13 tareas (DS-00 a DS-12), cada una con rama, dependencias y criterio de hecho.
    - **Estado:** pendiente de aprobación. Al aprobarlo se registran aquí las decisiones D1–D6.
    - **Dependencias:** ninguna hasta DS-01. La única prevista en toda la fase es `@axe-core/playwright`, de desarrollo, porque los criterios exigen axe.
92. **Decisiones D1–D6 de la Fase 2.** El usuario aprobó el plan el 02/10 («fusiónalo y empieza») sin cambiar ninguna decisión, así que se aplican las recomendaciones:
    - D1: Cormorant Garamond y Manrope;
    - D2: tonos oscuros solo como momentos, sin tema oscuro global;
    - D3: tokens de los oscuros de colección, que se aprueban en la página de referencia y se usan a partir de la F5;
    - D4: dorado solo como acento, con un tono oscuro para el texto y el botón principal a tinta al pasar el ratón;
    - D5: juego propio de iconos, sin librería;
    - D6: página de referencia en `/admin/diseno`.
93. **Red de seguridad (DS-01).**
    - `@axe-core/playwright` 4.13.0, versión exacta, de desarrollo. Publicada el 11/08, cumple la antigüedad mínima de pnpm.
    - La auditoría de diseño no espera a `networkidle`: a partir de cierto ancho la página mantiene peticiones abiertas unos 30 s. Espera a la carga, a las fuentes y a las imágenes, y comprueba que no hubo redirección. Así, una sesión perdida no audita la pantalla de acceso en lugar del panel.
    - Se audita con movimiento reducido, para medir el diseño final.
    - Bloquean: desplazamiento horizontal, solapes de cajas de contenido, texto fuera de su caja y controles de menos de 24 px.
    - Se excluyen las capas superpuestas a propósito (`absolute`, `fixed` y `aria-hidden`).
    - axe solo guarda la línea base (plan §9) hasta que las tareas siguientes la lleven a cero.
    - Capturas en JPEG como artefacto de la CI (14 días), sin versionar.
94. **Tokens (DS-02).** En `src/app/globals.css`, en dos capas.
    - **Paleta de marca:** los colores de antes y siete nuevos.
      - `paper` (`#fdfcf9`, campos y tarjetas);
      - `ink-soft` (`#2e2925`);
      - `gold-deep` (`#7a5d33`);
      - `line-strong` (`#8a8073`) y sus variantes oscuras;
      - los oscuros de colección `oud`, `indigo-night` y `forest` (D3).
    - **Semánticos:** `surface`, `surface-raised`, `surface-sunken`, `fg`, `fg-muted`, `fg-inverse`, `border`, `border-strong`, `accent`, `accent-fg`, `focus`, y `danger`, `success` y `warning` con su `-soft`.
      - Se llaman `fg` y no `text` para que la clase sea `text-fg` y no `text-text`.
    - **Tonos:** `data-tone="dark"` (y `oud`, `indigo` y `forest`) redefine los semánticos dentro de su contenedor.
      - Se añadió a los fondos oscuros que ya existían: pie, portada, menú móvil, banner de vista previa, menú del panel, informe del inicio y resumen del asistente.
      - El panel lateral (`Sheet`) ya lo usaba.
    - **Contraste:** `tests/unit/design-tokens.test.ts` comprueba la matriz en los cinco tonos.
      - Texto, 4,5:1. Bordes de controles y foco, 3:1.
      - El dorado de acento marca estados solo sobre la superficie y la elevada; sobre arena o el fondo de la ficha es adorno (2,7–2,9:1).
      - La niebla deja de ser color de texto sobre fondos claros (2,3:1): es el texto atenuado del tono oscuro y un adorno.
    - **Cambios visibles, aprobados como parte del plan (D4):**
      - el texto atenuado pasa de niebla a humo;
      - los bordes de los campos se oscurecen (de 1,3:1 a 3,4:1);
      - el botón principal pasa a tinta suave al pasar el ratón, no a dorado;
      - el foco tiene 2 px en dorado oscuro;
      - la marquesina de marcas pasa a humo;
      - las etiquetas del menú lateral del panel pasan de 9 a 11 px y son legibles;
      - el personal inactivo se muestra en texto atenuado, no con opacidad.
    - **Escalas:**
      - `text-2xs` (11 px, el mínimo);
      - `tracking-caps-sm`, `tracking-caps` y `tracking-caps-lg`;
      - `max-w-page` y `rounded-hairline`.
      - Tailwind 4 no tiene espacio de nombres para duraciones ni capas, así que `--duration-*`, `--z-*` y `--section-y` son variables CSS.
      - `@theme static` publica todos los tokens. Sin `static`, Tailwind descarta los que aún no usa ningún componente, como los fondos suaves de estado, y la página de referencia no podría leerlos.
    - **Guardas (criterios 1 y 3):** `tests/unit/design-guard.test.ts`, con excepciones exactas en `design-guard-exceptions.ts`, que solo pueden bajar.
      - La única permanente es el fondo de la escena 3D, porque three.js no lee variables CSS.
      - Los tamaños y espaciados arbitrarios bajan a cero en DS-04.
    - **Accesibilidad:** el indicador «Cargando» del panel lleva `role="status"`.
    - **Auditoría:** ahora espera al contenido en streaming, recorre la página y espera a las animaciones con fin.
    - **Resultado:** axe da 0 infracciones en las 35 pantallas.
95. **Página de referencia (DS-03).** `/admin/diseno`, con `requireStaff`: la ve todo el personal con sesión (D6), sin permiso propio.
    - **Enlace:** «Sistema de diseño» en el pie del menú del panel, junto a «Tienda pública», fuera de las secciones de trabajo. Sale en el menú lateral y en el móvil.
    - **Valores leídos, no copiados:** la página lee cada variable en el navegador (`getComputedStyle`) dentro de su tono, así que enseña lo que se aplica de verdad. El contraste se calcula con la misma función y la misma matriz que `tests/unit/design-tokens.test.ts`, que viven en `src/modules/design`.
    - **Catálogo:** `src/modules/design/domain/tokens.ts` guarda el nombre y el uso de cada token, sin valores. La prueba exige que tenga exactamente las variables que declara `globals.css`: un token nuevo no puede quedarse fuera de la página.
    - **Tipografía:** los tamaños de Tailwind en uso salen como inventario; la escala se cierra en DS-04.
    - **Guardas:** los accesos del pie del menú comparten una clase, así que los espaciados arbitrarios de `layout.tsx` bajan de 3 a 2 sin cambio visual.
    - **Para revisar (D3, criterio 13):** los tonos de colección solo cambian la superficie; la elevada y la hundida siguen siendo las del tono oscuro. Se ve en la página y se decide al revisarla, antes de usarlos en la F5.
    - **Pruebas:** sin sesión redirige al acceso. Con sesión de encargado (el rol con menos permisos): 200, todos los tokens con valor, todas las combinaciones cumplen en los cinco tonos, la demostración de movimiento con teclado, el enlace en el menú móvil y axe sin infracciones a 390 y 1440 px. La auditoría de diseño del panel suma la página.
96. **Tipografía (DS-04).** La escala queda cerrada (criterio 3) y nace la biblioteca común en `src/components/ui`.
    - **Componentes:** `Heading`, `Text` y `Eyebrow`.
      - `Heading` separa el nivel (h1–h4, la estructura) del tamaño (`display`, `h1`–`h4`, el aspecto). Sin nivel es un párrafo con aspecto de titular. Un título de página del panel es un h1 con tamaño h2, como hasta ahora.
      - `Text` tiene tres tamaños (cuerpo, pequeño y nota), tonos semánticos y cifras tabulares.
      - `Eyebrow` son las versalitas de 11 px.
      - Su `className` solo coloca (márgenes): el aspecto lo fija el componente, porque sin una librería de mezcla de clases dos utilidades del mismo tipo no se resuelven por orden.
      - `PageHeader` del panel ya los usa, sin cambio visual. El resto de pantallas los adopta al migrar (DS-10 y DS-11).
    - **Tokens nuevos:** `text-display` (`clamp(2.75rem, 8vw, 7.5rem)` con interlineado 0,95, el titular de la portada) y `tracking-display` (-0,01 em, los titulares).
    - **Espaciados:** tres pasos, 0,12, 0,18 y 0,3 em. Cada valor arbitrario pasa al más cercano:
      - 0,12 y 0,14 a `caps-sm`;
      - 0,15, 0,16, 0,18 y 0,2 a `caps`;
      - de 0,24 a 0,4 a `caps-lg`.
      - `.eyebrow` (0,32), `.btn` (0,28) y `.panel-btn` (0,18) usan ya los tokens.
    - **Cambios visibles, pequeños:**
      - los textos de 10 px pasan a 11 px: insignias de estado del panel, etiquetas del informe diario, el «IVA incluido» junto al precio de la ficha, el aviso de imagen provisional sobre la foto o la escena 3D y el «Desplázate» de la portada;
      - el código de verificación en dos pasos y el «Desplázate» pasan de 0,4 a 0,3 em de espaciado;
      - el logotipo de la cabecera de la tienda y de la pantalla de acceso pasa de 17 a 18 px. El del panel sigue en 14 px.
    - **Excepción permanente:** la etiqueta de estante impresa (`PriceLabelCard`, 63,5 × 38,1 mm) mantiene sus tamaños en pt para coincidir con la hoja. Va escrita con su motivo en `design-guard-exceptions.ts`, y la auditoría la excluye con `data-print-size`.
    - **Guardas:** la prueba cuenta cualquier `text-[…]`, también pt y `clamp()`, que antes no detectaba. No admite ningún `tracking-[…]` y exige tokens en los `letter-spacing` de `globals.css`. La auditoría E2E bloquea cualquier texto visible de menos de 11 px.
97. **Iconos y marca (DS-05).**
    - **`Icon`:** el juego propio de D5, sin librería: cerrar, menú, buscar, flecha, chevron, más, menos, check, alerta, información, carrito y usuario.
      - Retícula de 24 × 24 con trazo de 1,5 px a cualquier tamaño (`vector-effect: non-scaling-stroke`), extremos redondeados y `currentColor`.
      - Tres tamaños (16, 20 y 24 px). Flecha y chevron apuntan a la derecha y giran con `direction`.
      - Sin `label` es decorativo (`aria-hidden`); con `label`, `role="img"` y su nombre.
      - El carrito se dibuja como bolsa, más propia de una perfumería.
    - **Estrella:** `StarList` (viñeta), `StarDivider` (separador con `role="separator"`) y `StarLoader` (titila; `role="status"` con texto para lectores de pantalla y quieta con «reducir movimiento»). Siempre decorativa y en dorado de acento.
    - **Logotipo:**
      - mínimo en línea con el nombre a 14 px (`size="sm"`, el del panel) y en composición completa con 160 px de ancho (`min-w-40`);
      - margen libre de 1 em alrededor;
      - tinta sobre los claros y marfil sobre los oscuros, siempre en un solo color; nunca dorado ni sobre fotos sin velo.
      - `Logo` sustituye el tamaño libre por `size` (`sm` o `md`), así que no puede quedar por debajo del mínimo. Sin cambio visual.
    - **Iconos de la aplicación:** `icon.svg` y `apple-icon.png` (180 px, fondo opaco) llevan el emblema en tinta sobre marfil; revisados y sin cambios.
    - **Verificación:** por indicación del usuario («no hagas comprobaciones irrelevantes, las haremos en la siguiente fase») solo `pnpm check` en local, con 17 pruebas unitarias nuevas. Los E2E y la auditoría los ejecuta la CI.
98. **Idioma de la ruta antes de leer datos.**
    - **Error:** el registro del servidor mostraba «No se pudo leer el contenido de la tienda» en las ejecuciones de E2E.
    - **Causa:** el navegador pide `/favicon.ico` por su cuenta. Esa ruta no pasa por el proxy, porque tiene un punto, y Next la resolvía como `[locale]` = `favicon.ico`. El layout respondía 404, pero la portada se renderiza a la vez, consultaba `store_content` con ese idioma y fallaba.
    - **Arreglo:** `requireLocale` (`src/modules/i18n/server.ts`) responde 404 si el idioma no es es, ca o en y, si lo es, fija el idioma de next-intl. Lo llaman el layout, la portada, la colección, la ficha y los metadatos de la ficha, siempre antes de leer datos.
    - **Comprobado:** con la suite pública completa en paralelo, el error salía 4 veces en `main` y ninguna con el arreglo. `setup.spec` comprueba ahora que `/favicon.ico` da 404.
99. **Acciones (DS-06).**
    - **`Button`:** cinco variantes sobre los tokens semánticos, así que valen en el tono claro y en los oscuros sin variantes propias.
      - Principal: `fg` con texto `fg-inverse`, que se aclara un poco al pasar el ratón (D4: el dorado nunca es fondo de texto).
      - Secundaria (fondo hundido), contorno (`border-strong`, 3:1) y sutil (sin borde).
      - Peligro: de contorno rojo y se llena al pasar el ratón, como los botones destructivos del panel; no compite con el principal.
      - Tamaños: sm de 36 px para tablas y barras compactas, y md y lg de 44 y 48 px (criterio 8).
      - Carga: la estrella titila, el texto pasa a `loadingLabel`, el botón queda deshabilitado y lleva `aria-busy`.
      - Por defecto es `type="button"`: no envía formularios por accidente.
      - Con `href` es un enlace; un enlace «deshabilitado» se muestra apagado con `aria-disabled` y fuera del tabulador.
    - **`TextLink`:** el subrayado de `.link-underline`. Si es externo abre otra pestaña con `noopener` y lo anuncia a los lectores de pantalla con `newTabLabel`, en el idioma de la página.
      - Lleva el icono `external`, que se suma al juego de D5: una flecha dibujada en diagonal. Girar la flecha 45° hacía sobresalir su caja 3 px del enlace, y la auditoría lo detectó en la CI.
    - **`SubmitButton`:** `Button` con el estado de envío del formulario o el de `useAdminAction`. El del panel ya es este, con su misma API (`ghost` pasa a ser el contorno) hasta la migración del panel (DS-11).
      - Cambios visibles en los 36 botones de envío del panel: el contorno es más marcado, el rojo de peligro va entero en el borde y, mientras envía, la estrella acompaña al texto.
    - **Pruebas:** unitarias de `Button` y `TextLink`, y E2E de teclado en `/admin/diseno`:
      - Intro y Espacio activan;
      - el deshabilitado queda fuera del tabulador;
      - el foco tiene 2 px;
      - mientras carga, el botón no responde;
      - el enlace con aspecto de botón se sigue con Intro.
      - Las esperas de la auditoría y de la página ignoran `aria-busy` en botones, porque la página enseña un botón en carga de forma permanente.
100.  **Formularios (DS-07).**
      - **`Field`:** etiqueta, control, ayuda y error. Une la etiqueta con el control (`for`/`id`, con `useId` si el control no trae el suyo) y le añade `aria-describedby` con el error antes que la ayuda, para que el lector de pantalla diga primero qué falla; con error, `aria-invalid`.
        - El control es un único elemento que `Field` clona; así se escribe como hasta ahora (`<Field label><Input /></Field>`) y vale en Server y Client Components.
        - `Fieldset` agrupa radios o casillas con su leyenda, ayuda y error.
      - **Controles de texto:** `Input`, `Textarea`, `Select` y `SearchField` comparten la caja (`CONTROL_CLASSES`):
        - 44 px de alto y letra de 16 px, para que iOS no amplíe la página al enfocar (el `.input` del panel usa 15 px);
        - el foco es el contorno global de 2 px (el `.input` del panel lo anula; se corrige al migrar en DS-11);
        - error con borde rojo, icono y mensaje; deshabilitado con fondo hundido, fuera del tabulador; solo lectura con fondo hundido y borde discontinuo, que se enfoca y se copia;
        - bordes de 3,1:1 sobre el fondo hundido y 3,8:1 sobre el elevado (1.4.11).
        - `Select` es el nativo con el chevron propio: teclado y lista del sistema en el móvil.
        - `SearchField` lleva la lupa, un nombre accesible propio y la estrella mientras llegan resultados. El buscador del panel (catálogo e inventario) ya es este.
      - **`Checkbox` y `Radio`:** dibujados con los semánticos y no con el control nativo, que no sigue los tonos oscuros. Caja de 24 px y la etiqueta entera como objetivo táctil de 44 px.
      - **Pruebas:** unitarias de los ocho componentes y E2E de teclado en `/admin/diseno`, con una prueba de formulario que valida, marca los errores y lleva el foco al primero que falla. axe sin infracciones y auditoría sin fallos a 390, 768, 1280 y 1440 px.
101.  **Preguntas frecuentes en la portada (03/10).** El usuario pidió reseñas de Google escritas por IA antes del pie, para sustituirlas más adelante por reseñas reales. No se hacen: serían reseñas falsas presentadas como de clientes, que prohíben las reglas del proyecto («no inventar … reseñas») y la normativa de consumo de la UE y de España. En su lugar, y a petición del usuario, un bloque de preguntas frecuentes que no cargue la página.
      - **Dónde:** al final de la portada, antes del pie, plegado (`<details name>`: se ve solo la pregunta y se abre una cada vez, sin JavaScript y con teclado). El pie enlaza la sección desde todas las páginas (`/#preguntas-frecuentes`).
      - **Qué dice:** solo lo que ya consta en la tienda:
        - la compra online todavía no está disponible; sus envíos y devoluciones se publicarán con ella;
        - la dirección, el horario y el contacto, desde los datos de la tienda del panel;
        - qué perfumes hay y cómo filtrarlos en la colección;
        - la diferencia entre concentraciones (conocimiento general, no datos de producto);
        - los precios incluyen IVA y «Desde» es el formato más económico.
      - **Pendiente del negocio:** autenticidad y procedencia, envíos, devoluciones y pruebas en tienda, cuando estén decididas. Las reseñas reales, cuando las haya, con su fuente.
102.  **Superposiciones y avisos (DS-08).**
      - **`Dialog` y `Sheet`** sobre `<dialog>` con `showModal()`, en un gancho común (`useModal`):
        - el resto de la página queda inerte; Esc o tocar fuera cierran;
        - Tab y Mayús+Tab dan la vuelta dentro del diálogo: el nativo deja salir el foco a la barra del navegador tras el último control, y el plan pide foco atrapado;
        - al abrir, el foco va a `data-autofocus` si lo hay; al cerrar, vuelve al control que lo abrió.
      - **`Sheet`** pasa de `modules/admin/ui` a la biblioteca, con lado y tono. Los colores salen de `data-tone` (los semánticos), sin variantes propias, y el cierre es el icono de D5. El menú móvil del panel y los movimientos de inventario ya lo usan.
      - **`Dialog`** centrado, con título, descripción, cuerpo y acciones; entra con un leve ascenso.
      - **`useConfirm`** sustituye a `window.confirm`: devuelve una promesa y el diálogo que hay que pintar. El foco empieza en «Cancelar», así que Intro por accidente no destruye nada; la acción destructiva usa el botón de peligro. Cambiar los `window.confirm` del panel queda para su migración (DS-11).
      - **`Toast`** y `Toaster` pasan a la biblioteca:
        - dos regiones vivas presentes desde el inicio, `status` para el éxito y `alert` para los errores, para que el lector de pantalla anuncie cada aviso;
        - el éxito se va solo a los 5 s; los errores se quedan hasta cerrarlos (antes desaparecían a los 8 s);
        - cada aviso tiene botón de cerrar y su icono; el de éxito usa el tono oscuro.
      - **Movimiento:** con «reducir movimiento» las transiciones duran 0,01 ms (regla global), así que nada se desplaza (criterio 9).
      - **Pruebas:** unitarias de los tres y E2E en `/admin/diseno`: foco dentro durante seis Tab, Esc y foco devuelto, confirmación con «Cancelar» de inicio, aviso en la región de estado, panel oscuro, «reducir movimiento» y error que se cierra a mano.
103.  **Datos y comercio (DS-09).**
      - **`Badge`** es un estado (publicación, existencias, pedido) con cinco tonos: borde y texto del mismo semántico, así que cumple AA en el tono claro y en los oscuros, y el color siempre acompaña a una palabra. `StatusBadge` del panel ya lo usa. **`Tag`** es descriptivo (casa, concentración, público): fondo hundido, sin versalitas ni significado de estado.
      - **`Price`:**
        - PVP con `formatEuros` en el formato de cada idioma y cifras tabulares;
        - el precio anterior solo sale si es mayor (rebaja con la regla Ómnibus de docs/PRICING.md); va tachado y con «antes» (`labels.before`) para el lector de pantalla, que no anuncia el tachado, y un espacio real separa los dos importes;
        - «desde» cuando hay varios formatos.
        - Los textos llegan del idioma de la página (la biblioteca no lee mensajes). La ficha y las tarjetas de la tienda pasan a usarlo en DS-10.
      - **`Card`** sustituye a `.panel-card`; `interactive` marca el borde cuando toda la tarjeta es un enlace.
      - **`Table`, `Th` y `Td`** sobre `.data-table` y `.stack-table`: leyenda accesible, cabeceras con `scope`, cifras a la derecha y, en el móvil, filas como fichas (`primary` encabeza y `label` nombra cada celda).
      - **`EmptyState`** con la estrella, qué pasa y la acción siguiente; dice «no hay» o «todavía no», nunca rellena.
      - **`Skeleton`** es decorativo (`aria-hidden`) y deja de latir con «reducir movimiento»; quien lo usa anuncia la carga una vez. Así la página de referencia no tiene un `aria-busy` permanente.
      - **Pruebas:** unitarias de `Price` en es, ca y en, con y sin rebaja, con «desde» y con importes redondos, y de los demás componentes. La página de referencia sigue sin infracciones de axe y sin fallos de maquetación a 390, 768, 1280 y 1440 px.
104.  **Migración de la tienda (DS-10).** Cabecera, pie, portada, colección y filtros, tarjeta, ficha y panel de compra, 404, banner de vista previa y enlace «Saltar al contenido» usan la biblioteca y los semánticos. Sin cambios de contenido ni de rutas.
      - **Colores:** los de paleta pasan a los semánticos:
        - `text-smoke` → `text-fg-muted`, `border-line` → `border-border` y `bg-sand` → `bg-surface-sunken`;
        - el dorado → `accent` (decoración) y `accent-fg` (texto);
        - las zonas oscuras (portada, menú móvil, tienda, pie y banner) usan `bg-surface text-fg` con `data-tone="dark"`;
        - la cabecera transparente sobre la portada se pone `data-tone="dark"`.
        - Solo queda `bg-stage`, el fondo de la escena de producto (también la excepción de `ProductStage` en las guardas).
      - **Componentes:** `Eyebrow` y `Heading` en todos los títulos, con la escala cerrada:
        - portada y colección en `display`; secciones de la portada y ficha en `h1`; relacionados en `h2`.
        - Cambio visible: el nombre del perfume en la ficha y «Castelldefels» pasan de 72 a 60 px.
      - **Enlaces con aspecto de botón:** `buttonClass` sobre el `Link` de next-intl, porque `Button` con `href` usa el de Next y perdería el prefijo del idioma.
      - **Colección:**
        - filtros con `buttonClass` (activo principal, resto de contorno);
        - `SearchField` y `Select` del sistema: caja de 44 px en lugar de la línea inferior;
        - `EmptyState` para la colección vacía y para la búsqueda sin resultados, con «Limpiar filtros» como botón.
      - **Precio y existencias:**
        - `Price` en la tarjeta y en el panel de compra;
        - el mensaje `product.from` pasa de «Desde {price}» a la palabra sola y se añade `product.before` («Antes», «Abans», «Was») para el lector de pantalla;
        - la disponibilidad es un `Badge` («Agotado» en neutro, como era el punto gris; también en la página de referencia);
        - los formatos miden 44 px.
      - **Comprobado:** E2E públicos en local (125), con la auditoría de maquetación y axe sin fallos en `/es`, `/ca`, `/en`, la colección en los tres idiomas, la ficha publicada y la 404, a 390, 768, 1280 y 1440 px; capturas revisadas a 390 y 1440 px.

## Grafo de graphify — 04/10/2026

105. **Grafo de conocimiento del proyecto con graphify 0.9.75** en `graphify-out/`, a petición del usuario («genera un grafo de graphify en el proyecto como PR independiente»).
     - **Contenido:** `graph.json` (2676 nodos, 7435 aristas, 133 comunidades con nombre), `graph.html` (visor interactivo), `GRAPH_REPORT.md` (nodos centrales, conexiones sorprendentes y preguntas), `manifest.json` y `.graphify_labels.json` para `graphify update`, y `cost.json`.
     - **Alcance:** 422 archivos de código por AST (con `graphifyy[sql]` para las migraciones) y 41 documentos por extracción semántica. Las 44 imágenes (fotos de producto y borradores del piloto) no se extrajeron: no aportan estructura y cada una exige su propia llamada de visión.
     - **Fuera de Git:** `graphify-out/cache/` y las rutas locales del intérprete. `graphify-out/` queda fuera de Prettier porque es salida generada.
     - **Datos:** el grafo solo contiene nombres de símbolos, rutas y conceptos de la documentación ya versionada; no añade costes, proveedores ni secretos que no estén en el repositorio. Es una instantánea: se queda desfasado con el código y se regenera con `graphify update .` (código) o `/graphify .` (todo).

## Cierre de la Fase 2 — 04/10/2026

106. **Migración del panel (DS-11).** Todas las pantallas del panel (menú y maqueta, acceso y MFA, catálogo, inventario, mostrador, compras, reposición, informes, contenido, configuración, equipo y asistente) usan la biblioteca y los semánticos. Sin cambios de contenido ni de rutas.
     - **Controles:** las cajas `.input` pasan a `Input`, `Select` y `Textarea`; los tipos nativos que no cubren (`file`, `search`) usan `CONTROL_CLASSES`. Como `cx` no resuelve conflictos de Tailwind, una clase de la pantalla que cambia lo que ya fija el control (ancho, tamaño o familia de letra, `resize`) lleva `!` (`w-24!`, `text-2xl!`). Los selectores del panel ganan el chevron del sistema.
     - **`Field` y `SubmitButton` del panel se retiran:** se usan los del sistema. La etiqueta pasa de envolver el control a `htmlFor`, y la ayuda queda unida con `aria-describedby`. La variante `ghost` pasa a `outline`. En la ficha de perfume, «+ Nueva marca» sale del campo (que admite un único control).
     - **Casillas:** las 14 casillas sueltas pasan a `Checkbox` (caja dibujada de 24 px y la etiqueta entera como objetivo de 44 px). En la tabla del cambio masivo de precios, la etiqueta es `sr-only`.
     - **Tarjetas:** `.panel-card` pasa a `Card`; los enlaces, formularios y `fieldset` con aspecto de tarjeta usan `cardClass`, nuevo, como `buttonClass`. `Card` admite `padding="none"` y `role`/`aria-label`. Las tarjetas que son enlace marcan el borde al pasar el ratón (`interactive`).
     - **Botones:** `.panel-btn`, `.btn` y los botones hechos a mano (`bg-ink text-ivory…`) pasan a `buttonClass`: principal o contorno en `md` (44 px) en el panel y `lg` en las pantallas de acceso. Los filtros de catálogo, inventario, compras, rotación y asistente pasan de 40 a 44 px; las pestañas de acciones de stock siguen en `sm`, dentro del panel lateral.
     - **Tablas:** las 19 `<table className="data-table">` pasan a `Table` con su leyenda (`caption`, para el lector de pantalla); las que ya eran fichas en el móvil siguen apiladas y las anchas, con desplazamiento horizontal (`stacked={false}`).
     - **Antetítulos:** `.eyebrow` pasa a `Eyebrow`, que admite `as="dt"` y `as="legend"`.
     - **Colores:** `text-smoke` → `text-fg-muted`, `border-line` → `border-border`, `text-ink`/`border-ink` → `fg`, `bg-sand` → `bg-surface-sunken` y el dorado → `accent`/`accent-fg`. Las zonas oscuras (menú lateral, pantallas de acceso, informe del inicio y resumen del asistente) usan `bg-surface text-fg` con `data-tone="dark"`. Solo queda `bg-stage`, el fondo de las fotos.
     - **Menú lateral:** enlaces y accesos del pie a 44 px (antes 40 y 36).
     - **Carga:** el esqueleto del panel usa `Skeleton` y `cardClass`.
     - **CSS retirado:** `.eyebrow`, `.btn*`, `.field`, `.input`, `.panel-card`, `.panel-btn*`, la regla de casillas de `.panel-shell` y la propia clase. `.data-table` y `.stack-table` quedan como implementación de `Table`.
     - **Guardas:** `design-guard.test.ts` falla si vuelve a aparecer una clase antigua en un `className` o en `globals.css` (criterio 4) y si un componente usa un color de la paleta en lugar de un semántico (salvo `stage`).
     - **E2E más estrictos:** la auditoría del panel bloquea los controles de menos de 44 px de alto (criterio 8) y axe pasa de línea base a bloquear cualquier infracción, en el panel y en la tienda (criterio 6).
     - **Lo que encontraron las pruebas nuevas:** el porcentaje de margen negativo de la ficha (rojo con `opacity-70`, 3,85:1) pasa a rojo pleno; las pestañas de idioma de la ficha, «Ver en la tienda con borradores» y las pestañas de acciones de stock pasan a 44 px. `sm` queda para controles secundarios de la tienda; en `/admin/diseno` la demostración de tamaños lleva `data-target-demo` y solo se le exigen 24 px.
107. **Cierre de la Fase 2 (DS-12).** A petición del usuario («cerremos la última fase pendiente»). Informe criterio por criterio en [phases/FASE_2_REPORT.md](phases/FASE_2_REPORT.md) y guía en [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
     - **12 de 13 criterios cumplidos con evidencia.** El 13 (revisión visual aprobada por el usuario en la Preview) no lo puede dar nadie más: la fase queda cerrada cuando el usuario la apruebe por escrito en la PR de cierre. Hasta entonces el roadmap la marca «cerrada a falta de la revisión visual».
     - **axe pasa a bloquear** en las rutas públicas y en el panel (criterio 6); hasta DS-10 solo guardaba la línea base en el panel y una anotación en la tienda.
     - **Pendiente de decidir en la revisión:** los tonos de colección (D3) y si los filtros de la colección (36 px) cuentan como controles principales de la tienda.
     - **Siguiente fase:** checkout con pago con tarjeta (F10/A5) en cuanto estén los datos del TPV virtual y el proveedor de correo (§82); después, producción (F17).

## Catálogo olfativo, suscripción a promociones y tienda sin etiquetas provisionales — 09/10/2026

108. **Catálogo olfativo sin compra**, a petición del usuario («una página independiente donde sea única y exclusivamente el catálogo, sin opción a compra, con notas, estación… muy atractiva visualmente; haz research de las notas»).
     - **Rutas:** `/es/catalogo-olfativo`, `/ca/cataleg-olfactiu` y `/en/scent-catalogue`, con ficha propia por perfume (`…/[slug]`). Sin precio, disponibilidad ni botón de compra; la colección (`/catalogo`) sigue siendo la tienda. Enlazado desde la cabecera, el menú móvil y el pie.
     - **Diseño:** cabecera editorial en el tono `oud` (D3) con la explicación de los tres pisos; filtros por familia, estación y momento y búsqueda por perfume, casa o nota (sin tildes, en los tres idiomas). La ficha muestra la pirámide en tres pisos que se ensanchan, la rueda de las cuatro estaciones, día y noche, la «huella olfativa» (cuántas notas de cada grupo, calculada de las notas de la fuente) y «Si te gusta…» por notas y familias en común. Solo tokens semánticos y la biblioteca; símbolos de estación propios con el trazo del juego de iconos.
     - **Datos:** tabla `product_scent_profiles` (una fila por perfume) con las notas como claves de un vocabulario en código (`domain/scent.ts`) que da su nombre en es, ca y en. La base solo comprueba el formato de la clave, las familias, estaciones y momentos conocidos y que haya fuente `https`; la tienda omite claves que no conoce. Lectura pública solo de perfumes publicados; escritura con `catalog.edit` o `research.edit` (MFA).
     - **Vocabulario:** 123 notas, solo las que aparecen en las fuentes de los perfiles cargados (§86: la taxonomía se construye desde el research, no se siembra). Una nota nueva se añade al vocabulario con sus tres nombres antes de usarla.
     - **Research:** 47 de los 50 perfumes publicados, con la fuente de cada uno (ver PRODUCT_RESEARCH). Estación y momento solo cuando la fuente los dice; 3 perfumes sin fuente quedan sin perfil y se muestran sin pirámide.
     - **Procedencia visible sin enlace:** la página dice que los datos vienen de la ficha oficial de la casa o de su distribuidor oficial en España, pero no enlaza a la tienda del distribuidor, que también vende online. La URL exacta queda en la base.
     - **Panel:** sección «Perfil olfativo» en la ficha del perfume para mantenerlos sin SQL; rechaza claves desconocidas y exige la fuente.
109. **Suscripción a promociones antes del pie**, a petición del usuario («guardaremos una base de datos con los correos de los clientes para enviarles correos con descuentos exclusivos a través de Sender»).
     - **Sección «Club L’Atelier»** en todas las páginas de la tienda, entre el contenido y el pie: email y casilla de consentimiento **sin marcar** (RGPD/LSSI: consentimiento expreso para comunicaciones comerciales) y la primera capa de información (responsable, finalidad, Sender como proveedor, baja y derechos, con el correo de la tienda si está configurado). La política de privacidad completa espera los datos legales (pendiente 8).
     - **Lista propia en la base:** `newsletter_subscribers` (email normalizado, idioma, versión del texto aceptado y fecha). El público no la lee ni escribe: solo llama a `newsletter_subscribe`, que no revela si el email ya estaba y frena las altas masivas (60 por minuto). Contra bots, además, un campo trampa invisible. No se guarda IP ni nombre.
     - **Sender (sender.net):** con `SENDER_API_TOKEN` (y opcional `SENDER_GROUP_ID`) en Vercel, solo servidor, cada alta se envía a Sender al momento (`POST /v2/subscribers`, que dispara sus automatizaciones de bienvenida). Si Sender falla, el alta queda guardada y el panel la envía con «Enviar pendientes a Sender». Sin token, la web funciona igual y el panel exporta el CSV para importarlo. La clave privilegiada de Supabase no se usa: el alta pública va con la clave publicable y la función.
     - **Panel «Suscriptores»** (grupo Web): lista, recuentos, CSV (auditado, sin emails en la auditoría), baja y borrado con `customers.manage` y MFA, propagados a Sender (`PATCH … subscriber_status: UNSUBSCRIBED` y `DELETE`). Las bajas desde los correos quedan en Sender.
     - **Doble confirmación (double opt-in):** no se implementa en la web; Sender puede enviar la confirmación con su automatización de bienvenida. Recomendable activarlo allí antes de la primera campaña.
110. **Fuera las etiquetas provisionales de la tienda**, a petición del usuario («quita todas las etiquetas de prueba, temporal, provisional»): «Imagen provisional» en las tarjetas y la galería, «Vista 3D provisional» en la escena y el texto «Web en desarrollo» de la descripción de la web (y la clave sin usar del pie). `product_media.provisional` se mantiene como dato interno de procedencia (PRODUCT_RESEARCH) y el panel lo sigue mostrando. La web sigue con `noindex` hasta abrirla al público (pendiente 3 y 9): no es una etiqueta visible, es la decisión de mantenerla privada.
111. **Lo que encontraron las pruebas.** El formulario de suscripción vaciaba el email tras un error (reinicio automático de los formularios de React 19); ahora se envía como los del panel, sin reinicio, y sigue funcionando sin JavaScript. axe marcaba el `aria-label` de la escena 3D en un `div` sin rol: el lienzo lleva `role="img"`. En el listado olfativo, el nombre de marca que sustituye a una foto que falta no tenía contraste sobre el tono oscuro: el listado va en tono claro y solo la cabecera en `oud`.

## Vercel — 05/10/2026

112. **Proyecto de Vercel `altier-web` como único despliegue.** A petición del usuario («quiero que el proyecto de vercel tenga otro nombre: altier-web […] que sea el único deployment»).
     - `adhara-web` se renombra a `altier-web` (mismo id `prj_i8BphtVWLp68IZtvH9GrKlDRjK5L`, mismas variables, Git y protección) y se añade `altier-web.vercel.app`. `adhara-web.vercel.app` se mantiene mientras siga en la configuración de Auth de Supabase.
     - El proyecto `soapbrxnd` (sin relación con la tienda) queda pausado, no borrado; borrarlo es irreversible y lo decide el usuario.
     - El equipo de Vercel se llama SOAPBRXND porque es el equipo por defecto de la cuenta Hobby; no se puede mover el proyecto a otro equipo sin plan Pro. Cambiar su nombre y su URL (`soapbrxnd`) se hace en el panel de Vercel (Settings → General) y cambia las URL `*-soapbrxnd.vercel.app` de los despliegues.

## Textos legales — 09/10/2026

113. **Textos legales en borrador, visibles en la web**, a petición del usuario («prepara los términos legales, política de privacidad, cookies, envíos y devoluciones […] para luego hacer revisión con el cliente; quiero que esto sea visible en la web primero»). Guía de revisión en [LEGAL.md](LEGAL.md).
     - **Cinco textos** en es, ca y en con rutas traducidas: aviso legal, condiciones de venta, privacidad, cookies y envíos y devoluciones (con el modelo de formulario de desistimiento). Enlazados en una columna «Legal» del pie y, la privacidad, desde el aviso de la suscripción.
     - **En el código y no en la base** (`src/modules/legal`): son textos que cambian poco y deben revisarse por PR, con historial; no necesitan migración en `adhara-dev`. Una prueba exige las mismas secciones, marcadores y enlaces en los tres idiomas.
     - **Sin datos inventados:** titular, NIF, domicilio social, registro, dominio, envíos, pagos y arbitraje valen `null` en `LEGAL_ENTITY` y la página muestra «Pendiente: …» en su lugar (pendiente 8). Correo, teléfono y dirección salen del panel, como el pie.
     - **Decisiones de negocio supuestas** (perfumes desprecintados sin desistimiento, devolución a cargo del cliente, recogida en tienda, mayoría de edad para comprar, 14 años para el Club) listadas en LEGAL.md para confirmarlas con el cliente.
     - **Sin aviso de cookies:** solo hay cookies técnicas (idioma, sesión y vista previa del equipo, protección de Vercel), exentas por el art. 22.2 LSSI. Cualquier analítica o contenido de terceros obliga a añadir consentimiento previo.
     - No es asesoramiento jurídico: la asesoría debe revisarlos antes de abrir la web al público.
114. **Textos legales discretos**, a petición del usuario («que cumpla los mínimos requisitos, pero que no esté totalmente expuesto o explícito; que sea lo más parecido a una perfumería ya funcionando»). Matiza §113:
     - **Pie:** los enlaces pasan de una columna «Legal» a la barra inferior, en pequeño junto al ©.
     - **Sin huecos a la vista:** un párrafo o línea con un dato pendiente no se publica; solo la vista previa del personal (Draft Mode) muestra «Pendiente: …». Los textos se reescriben para que lo esencial no dependa de datos que faltan: el vendedor remite al aviso legal, los derechos y el desistimiento se ejercen por email o por correo a la tienda, el formulario va a la dirección de la tienda.
     - **Sin detalles internos:** fuera los avisos de «compra online no disponible», el panel, las cookies del equipo y de Vercel, los nombres de proveedores (por categorías, art. 13.1.e RGPD) y las medidas de seguridad concretas. Una prueba unitaria impide que vuelvan.
     - **Límite:** mientras falten titular, NIF y email, el aviso legal no cumple aún el art. 10 LSSI; no se inventan y se piden al cliente antes de abrir la web al público.
115. **Aviso de entrada para aceptar las condiciones**, a petición del usuario («quiero que aparezca en forma de pop-up para poder aceptarlo antes de empezar a navegar»).
     - Diálogo modal en todas las páginas de la tienda (`LegalConsent`) con enlaces al aviso legal, la privacidad y las cookies y un único botón «Aceptar y continuar». Esc y tocar fuera no lo cierran; el foco queda dentro (`useModal`, ahora exportado por la biblioteca).
     - No se muestra en las páginas legales, para poder leerlas antes de aceptar; al volver a la tienda sin aceptar, sale otra vez.
     - La aceptación queda en la cookie técnica `atelier_aviso` (un año, con la versión `LEGAL_UPDATED_AT` como valor: si cambian los textos, se vuelve a pedir), añadida a la política de cookies. Se lee en el navegador porque las páginas son estáticas: sin cookie, el servidor no pinta nada y no hay saltos al hidratar.
     - No es un aviso de consentimiento de cookies (no hace falta: solo hay cookies técnicas); si se añade analítica o publicidad, ese aviso debe permitir rechazar.
     - Las pruebas E2E entran con el aviso aceptado (`tests/support/legal-consent.ts` en los dos `playwright*.config.ts`); `tests/e2e/legal.spec.ts` lo prueba con un navegador limpio: teclado, Esc, cookie, enlaces y axe.
116. **Datos del titular (10/10/2026)**, facilitados por el usuario: autónoma Patricia Adriana Pecora, NIF (NIE) X8044791N, domicilio de la actividad en la tienda (Carrer de Pompeu Fabra, 1, 08860 Castelldefels), email latelierdudesert@gmail.com y dominio www.latelierdudesert.com.
     - Al ser autónoma, sin Registro Mercantil (la línea no se publica) y «Domicilio» en lugar de «Domicilio social».
     - El email queda en `LEGAL_CONTACT_EMAIL` como reserva de los textos legales y del aviso de la suscripción mientras Panel → Configuración no tenga uno; conviene ponerlo también allí para que salga en el pie y en las preguntas frecuentes.
     - `LEGAL_UPDATED_AT` pasa al 10/10/2026, así que el aviso de entrada se vuelve a pedir.
     - Sin teléfono: su línea sigue sin publicarse. Los datos de envíos y pagos esperan a la compra online.

## Dominio — 10/10/2026

117. **Dominio `latelierdudesert.com`.** El usuario lo compró en Vercel (equipo L’Atelier, `latelierdudesert`) tras comparar opciones: `atelierdudesert.com` y `altier.com` estaban cogidos; `.shop` costaba 2,99 $ el primer año pero 38,39 $ al renovar, frente a 11,25 $ fijos del `.com`; Vercel no ofrece `.es` (su consulta de ese TLD da error), así que los `.es` quedan sin comprobar.
     - DNS en Vercel (`ns1`/`ns2.vercel-dns.com`), renovación automática, caduca el 10/10/2027. Asignado a Production de `altier-web`; `www.latelierdudesert.com` redirige con 308 al dominio sin `www`. HTTP pasa a HTTPS.
     - **Sigue privado:** la protección de Vercel Authentication es «todos los despliegues» (`ssoProtection.deploymentType = all`), que incluye los dominios propios. Comprobado el 10/10: `https://latelierdudesert.com/` y `www` responden 302 al login de Vercel. Abrirlo al público es el pendiente 3 y 9 de STATUS.
     - **URL absolutas:** no hace falta `NEXT_PUBLIC_SITE_URL`. En Production, `siteUrl()` usa `VERCEL_PROJECT_PRODUCTION_URL`, que Vercel rellena con el dominio de Production más corto (propio o `vercel.app`): `latelierdudesert.com` tiene 20 caracteres y `altier-web.vercel.app`, 21, así que el canonical y el hreflang pasan a `latelierdudesert.com` en el siguiente despliegue de Production. Si se añadiera un dominio más corto, fijar `NEXT_PUBLIC_SITE_URL` en Production.
     - **Auth de Supabase:** las invitaciones del panel no pasan `redirectTo` y usan la Site URL de `adhara-dev`. Para entrar al panel por el dominio, el usuario añade `https://latelierdudesert.com/**` a las Redirect URLs (Authentication → URL Configuration) y, si quiere que las invitaciones lleguen al dominio, cambia la Site URL. `adhara-web.vercel.app` se mantiene mientras siga allí (§112).
     - El equipo de Vercel ya no es SOAPBRXND: se llama L’Atelier (`latelierdudesert`) y los despliegues nuevos usan `*-latelierdudesert.vercel.app`.
118. **Fuera Vercel Authentication: la web es pública.** A petición del usuario («quita la seguridad de vercel»). `ssoProtection` pasa a `null` en `altier-web`: son públicos Production (`latelierdudesert.com`, `www`, `altier-web.vercel.app`, `adhara-web.vercel.app`) y todas las Preview.
     - Antes se comprobó que nada dependía solo de esa protección: el layout del panel exige `requireStaff` y cada página, acción y exportación su permiso con MFA, con RLS debajo; la vista previa de borradores exige `catalog.edit`; el cron del informe diario sin `CRON_SECRET` responde 503 y no hace nada; el alta al club tiene campo trampa y límite en la base. Production y Preview usan el mismo `adhara-dev`, así que las Preview no exponen más datos que Production.
     - Comprobado el 10/10: `/` → `/es` (307), `/es` 200, `www` 308 al dominio sin `www`, `/admin` → `/admin/acceso`, 50 perfumes en el catálogo y en el catálogo olfativo.
     - **Sigue `noindex, nofollow`** (`X-Robots-Tag`): los buscadores no la indexan hasta que se decida. El canonical de la Production actual apunta a `adhara-web.vercel.app` porque se construyó antes del dominio; pasa a `latelierdudesert.com` en el siguiente despliegue de Production (§117).
     - Siguen pendientes, ahora con la web visible: plan Pro de Vercel (Hobby no admite uso comercial), la revisión de los textos legales por la asesoría (§113–116) y derechos de las fotos oficiales (STATUS, pendientes 8 y 9).
     - Para volver a cerrarla: Vercel → `altier-web` → Settings → Deployment Protection → Vercel Authentication.
