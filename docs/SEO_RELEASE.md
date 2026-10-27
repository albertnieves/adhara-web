# Cierre técnico y activación SEO

25/10/2026. Rama `codex/seo-indexacion-controlada`, sobre `codex/entornos-operacion` (#48), que a su vez depende de #47. No se han cambiado variables ni publicado Production. La indexación sigue apagada.

## Problema y corrección

El sitemap traducido, robots, JSON-LD de producto y metadatos sociales ya existían. `SEO_INDEXING` controlaba esos elementos y la metadata, pero `next.config.ts` añadía `X-Robots-Tag: noindex, nofollow` a cualquier respuesta, incluso cuando la apertura estaba autorizada. Una cabecera restrictiva impide indexar aunque la metadata lo permita.

La configuración de cabeceras usa ahora la misma decisión `indexingEnabled`:

- Sin `SEO_INDEXING=1`, fuera de Production o sin `NEXT_PUBLIC_SITE_URL=https://latelierdudesert.com`, se conserva el bloqueo global.
- Con las tres condiciones, desaparece el bloqueo global de las páginas públicas. No se fuerza `index`: las páginas que tengan metadata más restrictiva la conservan.
- `/admin`, `/api`, `/auth` y las rutas de cuenta, cesta, checkout y pedido, con sus traducciones es/ca/en y sus descendientes, mantienen la cabecera de exclusión.
- Los borradores siguen bajo Draft Mode y su metadata; no entran en el sitemap. Los idiomas sin contenido propio tampoco se incluyen para ese producto.

No se cambian productos, PVP, stock, rutas, pagos ni consentimiento. Ninguna variable SEO se activa con la PR.

## Comprobar antes de abrir

1. Fusionar #47, #48 y después esta PR, con sus comprobaciones. Completar los pasos legales y operativos del plan de apertura, incluido el aislamiento de previews.
2. Revisar productos publicados, fotos con derechos, descripciones, marca, precios y disponibilidad reales. No añadir reseñas, GTIN ni claims inventados para conseguir resultados enriquecidos.
3. Aprobar la apertura a buscadores. Solo entonces configurar en **Production** `SEO_INDEXING=1` y el dominio canónico en `NEXT_PUBLIC_SITE_URL`, y redesplegar. No copiar esta bandera a Preview.
4. Comprobar respuestas reales: portada, colección, casas y fichas sin cabecera global de noindex; sitemap con URLs canónicas y traducciones publicadas; robots con el sitemap. Panel, API, Auth, cuentas, cesta, checkout y pedido conservan noindex. Revisar las variantes con y sin `www` y sus redirecciones.
5. Comprobar HTML y JSON-LD de fichas ES/CA/EN: enlaces canonical y hreflang coherentes, precio EUR en céntimos convertido correctamente, ofertas solo si la venta está activa y sin costes/procedencia interna. Las comprobaciones existentes cubren el contrato con datos ficticios; la revisión de productos reales sigue pendiente.
6. El titular podrá verificar el dominio en Search Console y enviar el sitemap. No se ha conectado Search Console ni garantizado que Google indexe o muestre resultados enriquecidos.

Para volver a cerrar la web a buscadores, retirar la bandera y redesplegar; no es instantáneo y no borra de inmediato URLs ya indexadas. `noindex` tampoco sustituye la autorización del panel.

## Verificación de código

Pruebas de decisión y configuración HTTP real de Next en ambos modos, con las condiciones estrictas de dominio/entorno. E2E HTTP de las cabeceras públicas y 15 rutas operativas traducidas, tanto con apertura apagada como en una compilación local de ensayo con apertura encendida y sin credenciales remotas. La evidencia ejecutada se registra en STATUS y la PR; no equivale a activar producción.

Fuentes: [Google: robots y X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag), [Next: headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers).
