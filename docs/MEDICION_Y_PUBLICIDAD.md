# Analítica, publicidad y feed de productos

29/10/2026. A petición del usuario: «cookies analíticas y de publicidad para poder monetizar el tráfico de la web». Decisiones en [DECISIONS.md](DECISIONS.md) §179–180; textos legales en [LEGAL.md](LEGAL.md).

**Todo está apagado hasta que pongas los IDs.** Sin ellos, la web sigue como hoy: solo cookies técnicas, el aviso de entrada de siempre y ninguna llamada a terceros. Con un ID, ese proveedor aparece solo en el aviso, en la política de cookies y en la de privacidad, y se carga únicamente si el visitante lo acepta.

## Qué hace la web

| Pieza                                        | Para qué sirve                                                                                         | Se enciende con                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Google Analytics 4                           | Visitas, origen del tráfico, páginas, embudo de compra e ingresos                                      | `NEXT_PUBLIC_GA_MEASUREMENT_ID` (`G-…`)                                 |
| Google Ads                                   | Medir qué anuncios llevan a una compra y remarketing (anuncios a quien ya visitó la tienda)            | `NEXT_PUBLIC_GOOGLE_ADS_ID` (`AW-…`)                                    |
| Conversión «Compra» de Google Ads            | Que Google Ads cuente cada venta con su importe                                                        | `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` (la etiqueta de la conversión) |
| Píxel de Meta                                | Anuncios de Facebook e Instagram: medir ventas y volver a mostrar los perfumes vistos                  | `NEXT_PUBLIC_META_PIXEL_ID` (solo números)                              |
| Píxel de TikTok                              | Lo mismo en TikTok, donde la perfumería árabe tiene mucho público                                      | `NEXT_PUBLIC_TIKTOK_PIXEL_ID` (letras y números en mayúsculas)          |
| Feed de productos (`/feeds/productos.xml`)   | Fichas gratuitas y anuncios de Shopping en Google; catálogo para los anuncios dinámicos de Meta        | `WEB_CHECKOUT=1` (solo con la venta online encendida)                   |

**Eventos que se envían** (solo a lo aceptado): ver un perfume, añadir a la cesta, empezar a pagar, compra pagada (una sola vez por pedido, con su número e importe) y alta en el Club L’Atelier. Nunca el nombre, el email, el teléfono, la dirección ni costes.

**Las Preview nunca miden**, aunque hereden los IDs: sus pedidos de prueba contarían como ventas reales. Un ID con el formato equivocado hace fallar el build de Production con un mensaje que nombra la variable (sin enseñar su valor).

## Para encenderlo (usuario)

Haz los pasos de cada proveedor que quieras usar; los demás pueden quedarse sin ID. Todo en la cuenta del negocio, nunca en una personal.

### 1. Google Analytics 4

1. En [analytics.google.com](https://analytics.google.com), crea una cuenta y una propiedad «L’Atelier du Désert», zona horaria de Madrid y moneda EUR, y un flujo de datos web para `https://latelierdudesert.com`.
2. Copia el **ID de medición** (`G-…`).
3. En Administrar → Configuración de la cuenta: acepta las **condiciones de tratamiento de datos** y desactiva el **uso compartido de datos** con Google (la privacidad dice que Google Analytics actúa como encargado).
4. En Administrar → Recogida y conservación de datos → Conservación: **14 meses**.
5. Deja activada la **medición mejorada** con «Cambios de página según el historial del navegador» (viene así): la tienda cambia de página sin recargar y así se cuentan.
6. Marca `purchase` como **evento clave** (Administrar → Eventos).

### 2. Google Ads

1. En [ads.google.com](https://ads.google.com), Objetivos → Conversiones → Nueva acción de conversión → Sitio web → configurar manualmente: categoría «Compra», valor «Usar valores diferentes para cada conversión», recuento «Todas».
2. En «Configurar etiqueta» → «Instalar la etiqueta tú mismo» verás `send_to: 'AW-123456789/AbC…'`: lo de antes de la barra es `NEXT_PUBLIC_GOOGLE_ADS_ID` y lo de después, `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`.
3. Vincula Google Ads con Analytics y con Merchant Center (paso 5).
4. No actives las «conversiones mejoradas» (envían el email cifrado): la privacidad dice que no se envían datos de contacto. Si se quieren, antes hay que revisar la privacidad con la asesoría.

### 3. Píxel de Meta (Facebook e Instagram)

1. En [Meta Business Suite](https://business.facebook.com) → Administrador de eventos → Conectar orígenes de datos → Web → crea el píxel.
2. Copia su **ID** (solo números).
3. En la configuración del píxel, **desactiva la «coincidencia avanzada automática»** (lee los campos de los formularios, como el email). La web ya apaga la configuración automática del píxel (`autoConfig`).
4. Verifica el dominio `latelierdudesert.com` en Configuración del negocio → Seguridad de la marca → Dominios (registro TXT en el DNS de Vercel).

### 4. Píxel de TikTok

1. En [TikTok Ads Manager](https://ads.tiktok.com) → Herramientas → Eventos → Web → Configurar manualmente con código del píxel.
2. Copia el **ID del píxel** (letras y números en mayúsculas).
3. No actives la «coincidencia avanzada automática» por el mismo motivo que en Meta.

### 5. Poner los IDs y redesplegar

1. Vercel → `atelier-web` → Settings → Environment Variables: añade las que tengas, **solo en Production** (no son secretas, pero no hacen falta en Preview ni en Development).
2. Vuelve a desplegar Production: los IDs se leen al generar las páginas.
3. Comprueba en una ventana privada: sale el aviso con «Rechazar», «Aceptar todas» y «Configurar»; con «Rechazar» no se carga nada; con «Aceptar todas», la extensión Tag Assistant (Google), Meta Pixel Helper y TikTok Pixel Helper ven las etiquetas; al pie aparece «Configurar cookies»; la política de cookies y la de privacidad nombran solo los proveedores que pusiste.

### 6. Feed de productos (con la venta encendida)

1. Con `WEB_CHECKOUT=1`, `https://latelierdudesert.com/feeds/productos.xml` lista un artículo por formato con PVP, foto propia u oficial, disponibilidad y precio (con la rebaja si la hay). Sin la venta encendida responde 404.
2. **Google Merchant Center** ([merchants.google.com](https://merchants.google.com)): verifica y reclama el dominio, configura los envíos (España peninsular y Baleares, con los mismos importes que el checkout) y la política de devoluciones, y añade el feed como «fuente de datos programada» con esa URL, país España e idioma español. Actívalo para las **fichas gratuitas** y, si se quieren anuncios, vincúlalo con Google Ads.
3. **Catálogo de Meta** (Commerce Manager → Catálogo → Orígenes de datos → Feed de datos → URL programada): la misma URL, cada día. Conéctalo al píxel para los anuncios dinámicos.
4. **Sin GTIN (EAN):** la base no tiene el código de barras de los perfumes y no se inventa. Merchant Center avisará de «identificadores que faltan» y los anuncios pueden rendir menos. Para mejorarlo hace falta guardar el EAN de cada formato (otra entrega, con migración).
5. **Fotos:** solo entran perfumes con foto propia, oficial de la marca o del catálogo, y nunca las generadas o provisionales. Un perfume sin foto así no sale en el feed.

### 7. Asesoría

Antes de poner los IDs, que la asesoría revise la política de cookies y la de privacidad con los proveedores que se van a usar. Para verlas como quedarán sin encender nada: Panel → «Ver tienda con borradores» y abre las dos políticas: lo que depende de un proveedor aparece en un recuadro «Solo se publica con…».

## Monetizar el tráfico: qué se recomienda y qué no

- **Sí:** medir (Analytics), anuncios de búsqueda y Shopping en Google con el feed, remarketing en Instagram, Facebook y TikTok con el catálogo, y el Club L’Atelier con códigos de descuento (ya existe). Así cada visita tiene más opciones de acabar en compra.
- **No (de momento):** **anuncios de terceros en la web** (AdSense y similares). Con el tráfico de una tienda local pagan céntimos por mil visitas, sacan al cliente hacia otras webs (a veces de la competencia), restan imagen a una perfumería de lujo, ralentizan la página y obligan a pedir consentimiento a decenas de empresas publicitarias. Si en el futuro hay mucho tráfico informativo (por ejemplo, una guía de perfumes), se puede reconsiderar.
- **Más adelante:** la API de conversiones de Meta y TikTok (desde el servidor, más precisa con bloqueadores) necesita un token secreto y revisar la privacidad; y un feed en catalán e inglés si se anuncia fuera de España.

## Cómo está hecho

- Módulo `src/modules/tracking`: proveedores y formatos de ID (`domain/config.ts`), elección guardada (`domain/consent.ts`), eventos por proveedor (`domain/events.ts`) y lo que pasa en el navegador (`ui/runtime.ts`). El aviso es `src/modules/legal/ui/LegalConsent.tsx`.
- **Nada de terceros antes de aceptar.** Es el modo «básico» del Consent Mode v2 de Google: `gtag.js` no se descarga hasta aceptar, y al hacerlo se envían el consentimiento por defecto denegado y la actualización con lo aceptado. No se usa el modo «avanzado», que envía avisos sin cookies antes de aceptar.
- **Cookie técnica `atelier_cookies`** (versión, analítica y publicidad, proveedores que vio y fecha): un año. Se vuelve a preguntar al cambiar `TRACKING_CONSENT_VERSION` o al añadir un proveedor a un tipo que había aceptado.
- **Retirar el consentimiento** («Configurar cookies» en el pie o en la política): se borran las cookies de esos proveedores del dominio de la tienda y se recarga la página para descargar sus etiquetas.
- **Textos legales condicionales:** bloques, filas y secciones con `when` en `src/modules/legal/content/*.ts`. La fecha de las dos políticas pasa sola a `TRACKING_TEXTS_UPDATED_AT` al encender un proveedor.
- **Pruebas:** unitarias (`tracking`, `legal`, `merchant-feed`, `deployment-environment`), E2E del aviso (`tests/e2e/consent.spec.ts`) y de los eventos de una compra con el banco simulado (`tests/integration/tracking.spec.ts`). La CI compila con IDs de prueba y sirve vacías las etiquetas: ninguna petición sale a Google, Meta ni TikTok.
