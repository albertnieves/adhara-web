# SEO y revisión de PVP — 14/10/2026

Entrega en `codex/production-seo-pricing`, desde `main` 7b9c5c6. No activa checkout, buscadores ni despliega producción. No modifica PVP remotos.

## SEO implementado

- Sitemap de portada, colección, catálogo olfativo y fichas de perfume. URLs traducidas; las fichas solo incluyen español e idiomas con texto propio. Se consulta Supabase con cliente anónimo sin sesión ni Draft Mode y estado publicado. No se publican fechas de modificación inventadas.
- `SEO_INDEXING=1` habilita la indexación únicamente con `VERCEL_ENV=production` y `NEXT_PUBLIC_SITE_URL=https://latelierdudesert.com`. Sin esas condiciones se conserva `noindex`, robots bloqueado y sitemap vacío. Requiere nuevo despliegue tras cambiar variables.
- Las vistas previas del personal, idiomas sin traducción, administración, cesta, checkout y estado del pedido conservan `noindex`. Robots no sustituye autorización.
- JSON-LD Product en las fichas públicas, sin costes ni reseñas inventadas y con serialización que impide cerrar el script desde texto editorial. Las ofertas EUR solo aparecen con checkout habilitado y precios positivos; disponibilidad solo cuando la devuelve la consulta del catálogo. Sin ofertas/reseñas no se promete elegibilidad para resultados enriquecidos.
- Open Graph y Twitter en fichas con nombre, marca, URL, texto y foto reales. Se omite JSON-LD en Draft Mode.

Antes de activar: aprobación del contenido y legales, derechos de fotos, revisar canonical y sitemap contra catálogo publicado, y registrar el dominio en Search Console. Las fichas olfativas individuales, páginas de marca y colecciones editoriales quedan para otra entrega.

Fuentes: [sitemaps en Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap), [Product en Google](https://developers.google.com/search/docs/appearance/structured-data/product).

## Precios: diagnóstico y propuesta

Consulta de solo lectura a `adhara-dev` el 14/10: 50 formatos activos publicados, 33 con céntimos y 17 ya enteros. No hay precios tachados en estos 50. Los costes no se consultan ni se exportan.

[CSV de revisión](PRICING_REVIEW_2026-10-14.csv): todos los importes en céntimos, PVP actual, redondeo matemático, referencia externa cuando se encontró, propuesta basada en esa referencia y fuente. Es un informe, no un archivo para importar automáticamente. No son 50 precios oficiales verificados.

La referencia preferida es el mismo perfume/formato en euros e impuestos incluidos de un distribuidor autorizado para España. Orient Fragance se identifica como distribuidor oficial y ya era fuente del proyecto. Sus precios de venta no equivalen a una tarifa recomendada por el fabricante. Los resultados consultados tienen caché de semanas/meses; algunos accesos directos fallan. Reconfirmar la ficha y el formato antes de aplicar.

| Perfume                            |  Actual | Referencia EUR observada |   Propuesta redonda | Observación                                                          |
| ---------------------------------- | ------: | -----------------------: | ------------------: | -------------------------------------------------------------------- |
| Yara EDP 100 ml                    | 29,99 € |                  29,99 € |                30 € | Coincide con referencia española                                     |
| Asad Bourbon 100 ml                | 29,90 € |                  29,90 € |                30 € | Completar concentración en catálogo                                  |
| Asad Elixir 100 ml                 | 29,90 € |                  29,90 € |                30 € | Completar concentración en catálogo                                  |
| Yara Moi 100 ml                    | 29,90 € |                  29,90 € |                30 € | Completar concentración en catálogo                                  |
| Khamrah 100 ml                     | 44,02 € |                  35,90 € |                36 € | Revisar margen y concentración; no confundir con Qahwa               |
| Club de Nuit Intense Man LE 105 ml | 66,05 € |                  79,90 € | Sin propuesta final | Fuente agotada, etiqueta EDP y ficha local PARFUM: comprobar edición |

Las URLs exactas están en el CSV. Como contraste, [Lattafa Europe Yara](https://lattafaparfum.eu/nl-nl/products/yara) muestra 32,99 € y se identifica en el pie como distribuidor autorizado neerlandés: no se usa para subir automáticamente el PVP español. No convertir dólares de nuevo ni usar precios «desde 6 €» de muestras para frascos completos. Aceites de 20 ml y sets se revisan por separado.

## Aplicación en el panel

Catálogo → cambio masivo de PVP incorpora **Solo redondear**, que selecciona inicialmente euro entero y no exige un importe adicional. Usa la revisión existente: permisos, MFA, margen, confirmación de cambios, exclusión de rebajas, versiones y caducidad. No consulta precios externos.

El redondeo conserva la regla del proyecto: euro más cercano, empate al par (32,50 → 32; 33,50 → 34). Los precios ya enteros quedan sin cambio. Revisar la tabla antes de aplicar y desmarcar productos que precisen investigación; Khamrah a 36 € se revisa individualmente porque redondear 44,02 € solo daría 44 €.

No se alteran costes ni se añade un precio tachado tomado de otro vendedor. El canal de publicación de PVP sigue siendo el panel autenticado y su historial; esta entrega no ejecuta actualizaciones directas de precios por SQL.

## Verificación de esta entrega

Node 24.16.0 y pnpm 11.19.0, instalación con lockfile sin cambios de dependencias. `pnpm check`: lint, tipos, 579 unitarias y build correctos. `pnpm test:e2e` tras build: 206 correctas y 60 omitidas en 2,2 minutos. Se ejecutó sin conexión de la aplicación a Supabase y con checkout apagado; las omisiones incluyen centinela, fichas con datos y recorridos condicionados. No acredita el nuevo control de redondeo con sesión real ni el circuito de compra. La apertura SEO se prueba con entornos simulados en unitarias; el E2E comprueba robots y sitemap cerrados. Formato y escaneo de secretos correctos. No hay cambios de esquema SQL.

## Pendientes para producción

- Pago y devolución reales en sandbox de Redsys; correo real de Resend y remitente verificado.
- Tarifas, textos legales, stock contado y fotos aprobadas por el negocio.
- Entorno `adhara-prod`, restauración comprobada, alertas y separación de previews.
- Revisión visual del usuario para cerrar el criterio 13 del Design System.
- Aplicar la propuesta comercial tras confirmar fuentes, formatos y márgenes.

STATUS del 12/10 ya registra las diez migraciones de consola/pedidos aplicadas y Vercel Pro contratado. No se vuelven a incluir como trabajo pendiente ni se reaplican.
