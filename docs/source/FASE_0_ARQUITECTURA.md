# ADHARA — Fase 0: Discovery, arquitectura y planificación

Estado: **pendiente de aprobación** · Fecha: 28/09/2026
Fuentes analizadas: instrucciones del proyecto, brief de la Fase 0, `CATALOGO global 2026.pdf` (56 págs.) y logotipo `image.png`.

---

## 1. Executive Summary

**Qué construimos.** Una plataforma ecommerce propia para ADHARA, la perfumería árabe de Castelldefels. Tiene dos caras sobre una sola base de datos:
- el **storefront** público, editorial y *mobile-first*;
- un **back-office** (`/admin`) que gestiona catálogo, research, media, inventario compartido con la tienda física, pedidos, Click & Collect y promociones.

**Qué dice el catálogo PDF (hallazgos verificados en el documento).**
- Es un catálogo hecho en Canva: 56 páginas A4 y unas **427 entradas con precio**. Descontando repeticiones, calculo **~410–420 productos distintos**; la cifra exacta saldrá de la extracción.
- **Estructura por secciones de marca:**
  - págs. 2–26: unas 231 entradas **sin separador de marca**; solo la página de ASAD menciona «Lattafa».
  - pág. 27: separador EMPER; págs. 28–41: unas 122 entradas.
  - pág. 42: separador ARMAF; págs. 43–46: 36 entradas.
  - pág. 47: «SHAGHAF COLLECTION»; pág. 48: 6 entradas, con estuches que muestran «Swiss Arabian».
  - pág. 49: separador FRENCH AVENUE; págs. 50–52: 22 entradas.
  - pág. 53: separador AL HARAMAIN; pág. 54: 4 entradas.
  - pág. 55: separador ORIENTICA; pág. 56: 6 entradas.
- **Precios** entre 7 € y 60 € (mediana 16 €). El documento **no dice si son PVP, precio mayorista o precio de coste**.
- **Datos que no aparecen en ningún producto:** volumen (ml), SKU, EAN, género y descripción. La concentración solo se deduce del nombre en algunos casos («Elixir», «Intense», «Extrait»).
- **Notas olfativas** solo en ~8 productos (4 Yara y 4 Desert). Dos de ellas (Desert Angel Night y Desert Pearl) tienen **exactamente el mismo texto que Yara Tous**: casi seguro es un copia-pega.
- **Imágenes:** 672 imágenes incrustadas, casi todas de 265–615 px. Los estilos son heterogéneos (bodegón con ingredientes, fondo blanco, fondos de color). Algunas llevan **marcas de agua de terceros**. Sirven para identificar productos, no como imágenes finales.

**Tesis de arquitectura.**
1. **Un solo Next.js (App Router) sobre Supabase**, desplegado en Vercel. El storefront y el admin viven en el mismo repo y el mismo despliegue, separados por *route groups* y por módulos de dominio.
2. **El catálogo del PDF no es la verdad; es una fuente más.** Cada dato publicado apunta a la evidencia de la que sale (catálogo, verificado, editorial o generado). La trazabilidad está en el modelo de datos, no en la disciplina de las personas.
3. **El precio, el stock y la publicación se deciden siempre en servidor.** El navegador solo envía intenciones (variante + cantidad).
4. **El 3D, la animación y la media pesada son mejoras progresivas.** Nunca forman parte del camino crítico de carga.

**Hallazgo de planificación importante.** El roadmap original construye Homepage, Catálogo y PDP (fases 2–4) antes del backend (fase 8). Pero también prohíbe los datos ficticios. Las dos cosas no encajan: sin backend ni importación, esas páginas solo podrían hacerse con datos inventados. Por eso propongo **reordenar**: primero fundaciones y la importación real del PDF, después las páginas sobre datos reales (ver §17).

---

## 2. System Architecture

```
                         ┌─────────────────────── Vercel ───────────────────────┐
 Cliente (móvil/desktop) │  Next.js App Router                                   │
   ─────────────────────►│  (storefront)  RSC + ISR/tag revalidation             │
                         │  (admin)       RSC dinámico + Server Actions          │
                         │  /api/webhooks/stripe   (Route Handler, Node runtime) │
                         │  /api/cron/*            (Vercel Cron: expirar reservas)│
                         └───────┬──────────────────────────┬───────────────────┘
                                 │ supabase-js (SSR cookies) │ stripe-node
                         ┌───────▼──────────┐        ┌──────▼──────┐
                         │ Supabase         │        │ Stripe      │
                         │ Postgres + RLS   │◄───────┤ webhooks    │
                         │ Auth · Storage   │        └─────────────┘
                         │ RPC (plpgsql):   │
                         │ reserve/commit/  │
                         │ release stock    │
                         └──────────────────┘
   Scripts offline (no desplegados): scripts/catalog-import, scripts/media (gltf-transform)
```

### Dónde se ejecuta cada cosa

| Funcionalidad | Ejecución | Mecanismo |
|---|---|---|
| Listados, fichas, marcas, colecciones, `/tienda` | Servidor | Server Components + caché con revalidación por tags al publicar |
| Precio y stock en PDP y listado | Servidor, dinámico | Componente servidor sin caché (o con caché corta) en *streaming*/Suspense, aislado del resto de la página cacheada |
| Filtros del catálogo | Servidor, con estado en la URL (`searchParams`) | RSC; el cliente solo gestiona el panel de filtros |
| Búsqueda | Servidor | Postgres full-text + `pg_trgm` (extensiones, no dependencias nuevas) |
| Carrito (añadir, quitar, cantidad) | Servidor | Server Actions; carrito en BD asociado a una cookie httpOnly |
| Crear el pago | Servidor | Server Action → Stripe, con totales recalculados desde la BD |
| Confirmación del pago | Servidor | Route Handler `/api/webhooks/stripe` con verificación de firma |
| Expirar reservas | Servidor | Vercel Cron → RPC `release_expired_reservations` |
| Mutaciones del admin | Servidor | Server Actions + validación zod + comprobación de rol |
| Galería, Scent Journey, microinteracciones | Cliente | Client Components pequeños (Framer Motion) |
| Visor 3D | Cliente, bajo demanda | `next/dynamic` con `ssr:false` y carga al interactuar |
| Importación del PDF, optimización GLB, generación de imágenes | Offline | Scripts Node en `scripts/`, fuera del bundle |

Regla general: **por defecto, Server Component**. Un componente pasa a cliente solo si necesita estado, eventos o APIs del navegador, y en ese caso se aísla como una «isla» lo más pequeña posible.

### Dependencias adicionales propuestas (todas justificadas)

| Dependencia | Para qué | Por qué es necesaria |
|---|---|---|
| `@supabase/ssr` + `@supabase/supabase-js` | Cliente de Supabase con sesión en cookies | Es la integración oficial de Auth con Server Components y Server Actions |
| `stripe` | SDK de servidor | Crear sesiones o PaymentIntents y verificar webhooks |
| `zod` | Validar la entrada en el servidor | Todas las Server Actions y webhooks validan su entrada; evita escribir validación a mano en cada punto |
| `server-only` | Impedir que código de servidor acabe en el bundle del cliente | Protege secretos y queries |
| `@gltf-transform/cli` (solo dev) | Optimizar GLB (meshopt/Draco, KTX2, dedupe) | Sin esto los modelos pesan 5–20 MB |
| `vitest` (dev) | Tests unitarios del dominio (precios, stock, completitud) | Es la lógica crítica y debe probarse de forma aislada |
| `@playwright/test` (dev) | Tests end-to-end de los flujos críticos | Checkout y reserva de stock deben verificarse en navegador real |
| Proveedor de email transaccional (**decisión pendiente**, p. ej. Resend) | Confirmación de pedido, aviso de «listo para recoger» | Supabase Auth solo envía emails de autenticación |

Descartado de momento, por innecesario:
- estado global de cliente (Zustand/Redux): el carrito vive en el servidor;
- Algolia: Postgres basta para ~420 productos;
- CMS externo: el contenido editorial vive en Supabase;
- librerías de formularios: Server Actions + zod son suficientes.

Se reevaluará si aparece una necesidad concreta.

---

## 3. Functional Modules

| Módulo | Responsabilidad | Depende de | Lo consumen |
|---|---|---|---|
| **A. Storefront** | Presentación pública, navegación, SEO, layout editorial. No tiene lógica de negocio propia: compone lecturas de los demás módulos | Catalog, Product Experience, Commerce, Physical Store, Media | Clientes |
| **B. Commerce** | Carrito, cálculo de totales (precio, promoción, envío, IVA), checkout, Stripe, pedidos, estados, reembolsos | Catalog (variantes, precios), Inventory (reservar/confirmar), Customer, Promotions | Storefront, Admin |
| **C. Catalog** | Marcas, líneas, colecciones, categorías, productos, variantes, familias, notas y acordes. **Es la ficha maestra publicada** | Research (provenance), Media | Todos |
| **D. Product Experience** | PDP, Scent Journey, recomendaciones y visor 3D. Es de solo lectura | Catalog, Media | Storefront |
| **E. Physical Store** | Datos de la tienda (dirección, horarios, contacto), Click & Collect (preparación, aviso y entrega) | Inventory (ubicación), Commerce (pedido) | Storefront, Admin |
| **F. Inventory** | Niveles por variante y ubicación, reservas con caducidad, movimientos auditables, alertas de stock mínimo. **Único módulo que modifica el stock** | Catalog (variantes) | Commerce, Admin, Physical Store |
| **G. Admin** | Interfaz interna. Orquesta los casos de uso de los demás módulos; **no contiene reglas propias** | Todos | Personal |
| **H. Product Research** | Importaciones del PDF, ítems en bruto, *matching*, fuentes, afirmaciones (claims), conflictos, completitud y flujo de revisión | Catalog, Media | Admin |
| **I. Media** | Biblioteca de assets, roles (packshot, lifestyle…), variantes derivadas, briefs visuales, modelos 3D y posters, derechos de uso | Catalog | Todos |
| **J. Customer** | Perfil, direcciones, historial, wishlist y (a futuro) fidelización. Separa la identidad (Auth) del cliente (compras como invitado y en tienda) | Auth | Commerce, Admin |
| **Transversal: Auth** | Sesión, roles del personal, protección de rutas y helpers para RLS | Supabase Auth | Todos |

Reglas de relación:
- Los módulos se hablan a través de su **API pública** (`index.ts` del módulo). Nadie importa el interior de otro módulo.
- **Commerce nunca toca tablas de inventario**: llama a `inventory.reserve()`, `inventory.commit()` e `inventory.release()`.

---

## 4. Route Map

Convención: el catálogo (listados, fichas y filtros) se sirve cacheado y se revalida al publicar; carrito, checkout, pedido, cuenta y admin son dinámicos. Todas las rutas públicas son `index` salvo que se indique lo contrario.

### Storefront (público)

| Ruta | Propósito | Comportamiento | Relaciones |
|---|---|---|---|
| `/` | Home editorial | Estático + revalidación. Bloques gestionados desde Admin → Contenido | → catálogo, marcas, colecciones, tienda |
| `/catalogo` | Listado completo | Filtros en la URL (marca, familia, nota, género, precio, disponibilidad); paginación por URL; **canonical sin filtros** y `noindex` en combinaciones profundas | → `/perfume/[slug]` |
| `/perfume/[slug]` | PDP | Ficha cacheada + isla dinámica de precio y stock; Scent Journey; «Explorar en 3D» si hay modelo; `Product` + `Breadcrumb` JSON-LD | ← catálogo, marca, colección, búsqueda |
| `/marcas` | Índice de marcas | Estático | → `/marca/[slug]` |
| `/marca/[slug]` | Página de marca | Descripción, líneas y productos | → PDP |
| `/colecciones` | Colecciones editoriales (curadas) | Estático | → `/coleccion/[slug]` |
| `/coleccion/[slug]` | Colección | Curada manualmente o por reglas | → PDP |
| `/familia/[slug]` *(propuesta)* | Familia olfativa (Oud, Gourmand, Ámbar…) | Landing SEO | → PDP |
| `/nota/[slug]` *(propuesta, más adelante)* | Perfumes con una nota concreta | Solo si la nota tiene ≥ N productos verificados | → PDP |
| `/buscar` | Búsqueda | Dinámico, `noindex` | → PDP |
| `/carrito` | Carrito | Dinámico, `noindex`; precios recalculados en servidor | → `/checkout` |
| `/checkout` | Pago | Dinámico, `noindex`; elegir envío o Click & Collect; Stripe | → `/pedido/[token]` |
| `/pedido/[token]` | Confirmación y seguimiento | **Token aleatorio, no un id secuencial**; accesible sin cuenta mediante el enlace del email | ← webhook / email |
| `/cuenta` (+ `/cuenta/pedidos`, `/cuenta/direcciones`, `/cuenta/favoritos`) | Área del cliente | Privada (sesión del cliente) | ↔ pedidos |
| `/acceso`, `/auth/callback` | Login con magic link o contraseña | Supabase Auth | → `/cuenta` |
| `/tienda` | Tienda física de Castelldefels | Estático; `LocalBusiness` JSON-LD; mapa cargado al interactuar | → Click & Collect |
| Legales: `/aviso-legal`, `/privacidad`, `/cookies`, `/condiciones`, `/envios-y-devoluciones` | **Obligatorias en España (LSSI/RGPD/consumo)** y no estaban en la lista | Estáticas | Footer, checkout |

**Rechazo propuesto:** `/pedido/[id]` con id expuesto. Usaríamos `order_number` para humanos (p. ej. `ADH-2026-000123`) y un `access_token` para la URL.

### Admin (privado, rol de personal)

`/admin` · `/admin/productos` (+ `/nuevo`, `/[id]`) · `/admin/marcas` · `/admin/colecciones` · `/admin/inventario` (+ `/movimientos`, `/recuentos`) · `/admin/pedidos` (+ `/[id]`) · `/admin/recogidas` · `/admin/clientes` · `/admin/promociones` · `/admin/research` (+ `/importaciones`, `/conflictos`, `/fuentes`) · `/admin/media` · `/admin/contenido` · `/admin/configuracion` (+ `/usuarios`).

Protección en tres capas: el middleware redirige si no hay sesión; el layout del admin comprueba el rol en servidor; y **RLS** protege la BD aunque las dos anteriores fallen. Todo el admin va con `noindex` y queda fuera del sitemap.

### Técnicas

`/api/webhooks/stripe` (POST, firma verificada) · `/api/cron/expire-reservations` (secreto de cron) · `sitemap.xml` · `robots.txt` · `opengraph-image` por ruta.

**Decisión de idioma:** solo español al lanzar, sin prefijo `/es`. Si más adelante se añaden catalán o inglés, se migra a `/[locale]` con redirecciones. Afecta a las rutas, así que conviene confirmarlo ahora (ver §18).

---

## 5. Database Model

### Principios
1. **Producto ≠ variante.** El *producto* es el perfume (identidad olfativa y editorial). La *variante* es lo que se vende y se almacena (volumen, formato, SKU/EAN, precio). Stock y precios **nunca** van en `products`. Esto sustituye a `stock`, `reservedStock` y `costPrice` que aparecían en el modelo de producto de las instrucciones: desnormalizarlos provocaría incoherencias.
2. **Nada es obligatorio salvo la identidad mínima.** Un producto puede existir con solo nombre en bruto + ítem del catálogo. Los campos opcionales son `NULL`, no cadenas vacías ni valores por defecto inventados.
3. **Provenance.** Todo dato publicable que proceda de research apunta a su claim y a su fuente.
4. **Separar ciclos de vida:** publicación, research y media son estados independientes.
5. Dinero en **céntimos enteros** (`integer`) con moneda EUR; indicar siempre si incluye IVA.
6. `uuid` como PK, `created_at`/`updated_at` en todo, y *soft delete* (`archived_at`) en catálogo.

### Entidades

**Catálogo**

| Tabla | Responsabilidad | Campos principales | Relaciones / restricciones |
|---|---|---|---|
| `brands` | Marca comercial | name, slug, country, manufacturer, website, description, logo_asset_id, status | slug único |
| `product_lines` *(nueva)* | Línea de una marca (Yara, Asad, Badee Al Oud, Club de Nuit, Shaghaf, Khamrah…) | brand_id, name, slug | Distingue la «colección de marca» de la colección editorial |
| `collections` | Colección **editorial** curada (p. ej. «Gourmand», «Regalos < 20 €») | name, slug, description, type (manual/regla), rules jsonb, hero_asset_id, status | N:M con productos (`collection_products`, con posición) |
| `categories` | Tipo de producto: perfume, set de regalo, aceite, body mist… | name, slug, parent_id | Árbol simple. El PDF incluye *gift sets* |
| `olfactory_families` | Taxonomía controlada | name, slug, parent_id, description | Datos de referencia curados, no inventados por producto |
| `accords` + `product_accords` | Acordes principales | name / product_id, accord_id, weight, claim_id | — |
| `fragrance_notes` | Diccionario de notas (bergamota, oud…) | name_es, name_en, slug, aliases[], group (cítrico, especiado…) | Los alias normalizan «durazno/melocotón» |
| `products` | Perfume (ficha maestra) | slug, name, name_ar, brand_id?, line_id?, category_id, gender?, concentration?, family_id?, short_description, description, olfactory_description, profile scores (intensity, sweetness, freshness, woody, spicy, floral) nullable, usage (seasons[], day_night, occasions[]), longevity?, projection?, release_year?, perfumer?, **publication_status**, **research_status**, completeness_score, featured, is_new, is_bestseller, seo_title, seo_description, published_at, archived_at | `brand_id` puede ser NULL mientras la marca no esté verificada |
| `product_notes` | Nota en la pirámide | product_id, note_id, **tier** (top/heart/base/single), position, claim_id | Única por (product, note, tier) |
| `product_variants` | Unidad vendible | product_id, sku (interno), ean?, volume_ml?, format (EDP/EDT/Extrait/oil/set), **retail_price_cents**, compare_at_price_cents?, cost_price_cents? (solo admin), catalog_price_cents? (tal cual en el PDF), vat_rate, weight_g?, is_default, status | sku único; ean único si existe; `retail_price` obligatorio para publicar |
| `product_relations` | Relacionados, alternativas, flankers | product_id, related_id, type | — |

**Research y provenance**

| Tabla | Responsabilidad | Campos |
|---|---|---|
| `catalog_imports` | Cada importación de un PDF | file_asset_id, file_sha256, pages, imported_at, notes |
| `catalog_raw_items` | **Una entrada del PDF, inmutable** | import_id, page, position, raw_name, raw_price_text, raw_notes_text, section_label (p. ej. «EMPER»), crop_asset_id, bbox, **ingest_status**, matched_product_id?, duplicate_of? |
| `sources` | Fuente externa o interna | type (manufacturer/distributor/retailer/database/catalog/internal/ai), name, url, reliability (1–5), accessed_at, notes |
| `product_sources` | Fuentes usadas para un producto | product_id, source_id, notes |
| `product_claims` | **Afirmación atómica con evidencia** | product_id, field (p. ej. `notes.top`, `concentration`, `release_year`), value jsonb, **origin** (CATALOG/VERIFIED/EDITORIAL/GENERATED/MANUAL), source_id?, raw_item_id?, evidence (cita o captura), confidence, status (proposed/accepted/rejected/superseded), created_by, reviewed_by, reviewed_at |
| `product_conflicts` | Discrepancia entre claims | product_id, field, claim_ids[], status (open/resolved), resolution_note, resolved_by |
| `product_field_provenance` | Qué claim respalda cada valor publicado | product_id, field, claim_id |

**Media**

| Tabla | Campos |
|---|---|
| `media_assets` | storage_path, bucket, kind (image/model/video/document), mime, width, height, bytes, sha256, **origin** (catalog_pdf/official/own_photo/ai_generated/editorial), rights (licencia, autor, uso permitido), alt_text, status (draft/approved/rejected), generated_from_brief_id? |
| `product_media` | product_id, variant_id?, asset_id, **role** (primary/gallery/packshot/bottle/packaging/lifestyle/ingredient/og/thumbnail), position. El producto referencia el *rol*, así que cambiar un asset no cambia el producto |
| `product_3d_assets` | product_id, glb_asset_id, poster_asset_id, bytes, triangle_count, texture_format, camera/lighting preset jsonb, status |
| `visual_briefs` | product_id, brief jsonb (estructura del Visual Brief), version, status, approved_by |

**Inventario**

| Tabla | Campos | Restricciones |
|---|---|---|
| `stock_locations` | name, type (store/warehouse), address, is_pickup_point | Hoy: «Tienda Castelldefels». Permite añadir un almacén en el futuro sin rediseñar |
| `inventory_levels` | variant_id, location_id, **on_hand**, **reserved**, min_stock, updated_at | PK (variant, location); `CHECK on_hand >= 0`, `CHECK reserved >= 0`, `CHECK reserved <= on_hand`; `available` es columna generada `on_hand - reserved` |
| `inventory_reservations` | variant_id, location_id, quantity, order_id / cart_id, status (active/committed/released/expired), expires_at | — |
| `inventory_movements` | variant_id, location_id, type, quantity_delta_on_hand, quantity_delta_reserved, reason, reference_type + reference_id, actor_id, created_at | **Solo inserción** (sin UPDATE/DELETE por RLS) |

**Comercio y clientes**

| Tabla | Campos clave | Notas |
|---|---|---|
| `customers` | auth_user_id? (NULL si es invitado), email, name, phone, marketing_consent + fecha | Invitado y registrado en la misma tabla |
| `addresses` | customer_id, tipo, campos postales, is_default | — |
| `carts` / `cart_items` | token de cookie, customer_id? / variant_id, qty | **Sin precio**: se calcula siempre al leer |
| `orders` | order_number, access_token, customer_id, email, status, fulfillment_type (shipping/click_collect), pickup_location_id?, subtotal/discount/shipping/tax/total_cents, currency, shipping_address snapshot, promotion snapshot, placed_at | Estados: `pending_payment → paid → processing → ready_for_pickup / shipped → completed`, más `cancelled`, `refunded`, `partially_refunded` |
| `order_items` | order_id, variant_id, **snapshot** (nombre, marca, volumen, sku, precio unitario, IVA, descuento) | El histórico no cambia aunque cambie el producto |
| `payments` | order_id, provider, provider_payment_id, amount_cents, status, raw_event jsonb | — |
| `payment_events` | stripe_event_id (único), type, processed_at | Idempotencia de webhooks |
| `promotions` | code?, type (percent/fixed/free_shipping), value, scope (all/products/brands/collections), min_subtotal, starts_at, ends_at, usage_limit, per_customer_limit, active | — |
| `promotion_targets` | promotion_id, target_type, target_id | Sustituye a `promotion_products`: cubre también marcas y colecciones |
| `promotion_redemptions` | promotion_id, order_id, customer_id | Para controlar los límites de uso |
| `wishlists` / `wishlist_items` | customer_id / product_id | Una wishlist por cliente (ampliable) |

**Sistema:** `staff_members` (user_id, role), `audit_log` (acciones del admin: quién, qué, antes/después) y `store_settings` (horarios, contacto, envío).

### Restricciones importantes
- **Mínimo para publicar**, comprobado en BD (función `can_publish(product_id)`) y en servidor:
  - nombre verificado;
  - marca asignada;
  - ≥ 1 variante activa con volumen y PVP;
  - ≥ 1 imagen principal aprobada **no procedente del PDF**;
  - ningún conflicto abierto en campos críticos (nombre, marca, volumen, concentración).
- Los slugs no cambian una vez publicados; si cambian, se guarda una redirección en la tabla `redirects`.

---

## 6. Catalog Import Strategy

Propongo **separar dos máquinas de estado** que en el brief aparecían mezcladas:
- el estado del *ítem en bruto* del PDF;
- el estado del *producto*.

Además, la lista de las instrucciones del proyecto (UNRESEARCHED…COMPLETE) y la del brief de la Fase 0 (RAW…PUBLISHED) describen cosas distintas. Las reparto así:

**A. `catalog_raw_items.ingest_status`**
```
RAW ─► EXTRACTED ─► NORMALIZED ─► MATCHED ──────► (vinculado a un producto)
                          │           ├─► DUPLICATE (apunta al ítem original)
                          │           └─► NEW_PRODUCT (crea el producto en DRAFT)
                          └─► REJECTED (ilegible, no es un producto, etc.)
```

| Estado | Qué significa | Cómo se llega |
|---|---|---|
| RAW | Página y recorte registrados; nada interpretado | Script: se divide el PDF en entradas (texto + bbox + recorte de imagen) |
| EXTRACTED | Nombre y precio parseados literalmente | Parser: «14,5€» → 1450; «BLUSH 17» → 1700 con aviso de falta de «€» |
| NORMALIZED | Nombre limpio y tokens detectados (Elixir/Intense/Extrait → concentración *candidata*) | Reglas + diccionario. **El texto original no se toca nunca** |
| MATCHED / DUPLICATE / NEW_PRODUCT | Asociado a un producto | *Matching* con puntuación; por debajo del umbral lo decide una persona en el admin |

**B. `products.publication_status`** · `DRAFT → IN_REVIEW → READY → PUBLISHED → ARCHIVED`
**C. `products.research_status`** · `UNRESEARCHED → RESEARCHING → NEEDS_REVIEW → VERIFIED → COMPLETE`

`VERIFIED` significa que la identidad y los campos críticos están contrastados. `COMPLETE` significa que se alcanzó el umbral de completitud. Un producto puede publicarse con `VERIFIED` aunque no esté `COMPLETE`.

**Garantía anti-publicación accidental:** nada del PDF pasa a un campo publicado sin un claim `accepted` revisado por una persona. El paso a PUBLISHED exige `can_publish()`. Los datos de origen CATALOG no pueden aceptarse en bloque para campos críticos.

### Problemas concretos del PDF que el pipeline debe gestionar

| Problema | Ejemplos reales del PDF |
|---|---|
| **Marca implícita** | Págs. 2–26 sin marca; conviven productos de líneas distintas (Yara, Philos, Jean Lowe, Club de Nuit Intense «Limited Edition» a 60 €…) |
| **El separador de sección no garantiza la marca** | La sección tras «EMPER» mezcla muchas líneas; hay que verificar la marca producto a producto |
| **Duplicados** | FANOOS (págs. 17, 20, 23), RISALA (18, 22, 25), MIRSAAL PASSION (20, 22), ASAD ZANZIBAR (3, 25), KAFU (17, 20) |
| **Duplicados con precio distinto** | BRIOCHE VANILLE 22 € (p. 16) vs 15 € (p. 25); ECLAIRE 23 € (p. 4) vs 25 € (p. 18); FAKHAR GOLD 16 € (p. 4) vs 10 € (p. 31, posiblemente otro producto); Club de Nuit Women 28 € vs 25 € (p. 43) |
| **Ortografía y variantes** | PHLOS/PHILOS, NOBLEE, REMICENCE, CONFIDENTAL, ODESSEY/ODYSSEY, LA COLECTION/COLLECTION, SHAHEN/SHAHEEN, REGGAL/REGAL TOUCHE, Flubia/Fluvia, Saghaf/Shaghaf, «OIL LAIL MALAKI AMRROCAN BLUE», K&Q BLOOSOM, EXCELENCE, DELECATE, MAGNIFICANT |
| **Formato de precio** | «14,5€», «17» sin €, «ANTIQUE 26», «25€/», «14 €» |
| **Texto copiado erróneamente** | «Colección Magical Moment — Descubre nuestros 4 modelos de asad Lattafa» (copiado de la página Asad; además muestra 3 modelos); notas de Yara Tous repetidas en Desert Angel Night y Desert Pearl |
| **Mayúsculas inconsistentes** | Págs. 2–41 en MAYÚSCULAS; secciones finales en «Frase» |
| **Datos ausentes** | Volumen, EAN, SKU, género y descripción en el 100 % de los productos |
| **Imágenes** | Baja resolución, estilos mezclados, marcas de agua de terceros → solo `origin=catalog_pdf`, uso interno como referencia |

**Salida de la fase de importación:** un informe que el negocio pueda revisar, con los ítems, duplicados sugeridos, conflictos de precio y marcas no resueltas. Los precios del PDF se guardan en `catalog_price_cents` y **no** se copian a `retail_price` hasta confirmar qué representan.

---

## 7. Product Research Architecture

**Unidad de verdad: el claim.** Cada dato es una afirmación con origen, fuente, evidencia y estado. El valor publicado apunta al claim que lo respalda. Así, «¿de dónde salió esta nota olfativa?» se responde con una consulta: `product_notes.claim_id → product_claims → sources`.

| Origen | Significado | Puede publicarse | Reglas |
|---|---|---|---|
| CATALOG | Viene del PDF | Solo tras revisión humana | Fiabilidad baja por defecto |
| VERIFIED | Contrastado con una fuente externa | Sí | Requiere `source_id` y evidencia (URL + fecha de acceso) |
| EDITORIAL | Escrito por ADHARA | Sí | Autor y fecha |
| GENERATED | Producido por IA | Solo tras aprobación humana y **nunca para hechos** (notas, año, perfumista, concentración) | Solo contenido de marketing (descripciones, SEO) e imágenes; guarda modelo y prompt |
| MANUAL | Introducido por el personal sin fuente externa (p. ej. volumen medido en tienda) | Sí | Autor y nota |

**Flujo por producto**
1. Identificar (nombre oficial + marca) con prioridad de fuentes: fabricante > distribuidor oficial > retailer especializado > base de datos de perfumería > otras.
2. Crear un claim por campo y fuente.
3. Detectar conflictos automáticamente: dos claims `proposed` o `accepted` del mismo campo con valores distintos abren `product_conflicts`.
4. Revisión humana: aceptar, rechazar o resolver con nota. **Nunca se resuelve en silencio.**
5. Recalcular la completitud.

**Completitud (%)**: suma ponderada de grupos de campos. Por ejemplo: identificación 30 %, perfil olfativo 25 %, variante comercial 20 %, media 15 %, contenido 10 %. Los pesos se definen en config y la función vive en SQL para poder filtrar y ordenar en el admin. «Rango de edad orientativo» no entra en el cálculo por defecto (solo con fundamento, tal como pediste).

**La investigación asistida por IA** (búsqueda y extracción) crea claims `proposed` con su evidencia. Nunca claims `accepted`.

---

## 8. Media & 3D Architecture

### Storage (Supabase)

| Bucket | Acceso | Contenido |
|---|---|---|
| `catalog-source` | **Privado** | PDF original, recortes del PDF (`imports/{import_id}/p{page}-{pos}.png`) |
| `product-media` | Público (solo assets aprobados) | `products/{product_id}/{role}/{asset_id}.{ext}` con roles `packshot`, `bottle`, `packaging`, `lifestyle`, `ingredient`, `og` |
| `product-media-drafts` | Privado | Generados con IA y pendientes de aprobar: `products/{product_id}/generated/{brief_version}/{asset_id}.png` |
| `models-3d` | Público | `products/{product_id}/3d/{asset_id}.glb` + `poster.webp` |
| `brand-media` | Público | Logos y cabeceras de marca, fotos de la tienda |
| `references` | Privado | Referencias visuales de research (imágenes oficiales usadas como referencia, no publicables sin derechos) |

Principios:
- El nombre de archivo es el `asset_id`, así que los archivos son inmutables y el caché CDN puede ser largo. Reemplazar un asset = nuevo asset + reasignar el rol. El producto no cambia.
- Los thumbnails y tamaños responsive **no se guardan**: se derivan con optimización de imagen (decisión: Next Image en Vercel **o** Supabase Image Transformations; depende del plan y del coste, ver §18).
- Las imágenes OG se generan con `next/og` a partir del packshot.
- **Derechos:** cada asset registra origen y licencia. Las imágenes con marca de agua o de terceros quedan como `references`.

### Generación con IA
`visual_brief` versionado:
1. se construye desde claims verificados (botella, tapón, etiqueta, colores) + imágenes de referencia;
2. se genera;
3. queda en `drafts`;
4. se compara con la referencia (fidelidad de botella, logo y texto);
5. lo aprueba una persona;
6. se promociona a `product-media`.

Si la botella generada no coincide con el producto real, se rechaza.

### 3D
- **Listados:** nunca WebGL. Solo imagen o poster.
- **PDP:** botón «Explorar en 3D» (solo si `product_3d_assets.status = approved`). Al pulsarlo:
  1. `next/dynamic` carga el viewer (R3F + Drei);
  2. se hace fetch del GLB con indicador de progreso;
  3. el poster se mantiene visible hasta el primer frame.
  Opcionalmente se hace *prefetch* del chunk al hacer hover o al hacerse visible el botón, nunca en la carga inicial.
- **Viewer:** `OrbitControls` con límites (rotación y zoom acotados, sin *pan* en móvil), `Environment` con HDRI ligero, `ContactShadows`, `frameloop="demand"` (solo renderiza al interactuar), DPR limitado (≤ 1,5 en móvil) y `Suspense` + `ErrorBoundary` que vuelve al poster si hay error o no hay WebGL.
- **Desactivar el 3D:** interruptor global en config + por producto; respeta `prefers-reduced-motion` y `navigator.connection.saveData` (no se hace auto-prefetch).
- **Presupuesto por modelo** (propuesta): ≤ 2,5 MB GLB, ≤ 50k triángulos, texturas KTX2 ≤ 2048 px y compresión meshopt, verificado por un script de CI con `gltf-transform inspect`.
- **Pregunta abierta:** el origen de los modelos (modelado a medida, fotogrametría, proveedor). Condiciona coste y calendario.

---

## 9. Inventory Architecture

**Fórmula:** `available = on_hand − reserved`, por variante y ubicación.
- `on_hand` son las unidades físicamente presentes.
- `reserved` son las unidades comprometidas pero que aún no han salido (checkout en curso o pedido pagado pendiente de enviar o recoger).

**Ciclo de vida en una compra online**

| Paso | on_hand | reserved | Movimiento |
|---|---|---|---|
| Inicio del checkout | = | +q | RESERVATION (con `expires_at`) |
| Pago confirmado (webhook) | = | = | La reserva pasa a `committed`; el pedido reserva |
| Envío / recogida entregada | −q | −q | SALE_ONLINE / SALE_CLICK_COLLECT |
| Pago fallido o expirado | = | −q | RESERVATION_RELEASE |
| Cancelación antes del envío | = | −q | RESERVATION_RELEASE |
| Devolución recibida | +q (si es revendible) | = | RETURN (o RETURN_DAMAGED sin reponer) |

**Condición de carrera (dos clientes, última unidad).** La reserva es una función Postgres (`reserve_stock`) que ejecuta en una transacción:

```sql
UPDATE inventory_levels
   SET reserved = reserved + q
 WHERE variant_id = $1 AND location_id = $2
   AND on_hand - reserved >= q
RETURNING ...;
```

Solo uno de los dos UPDATE concurrentes encuentra la fila con disponibilidad suficiente (bloqueo de fila de Postgres + condición en el WHERE). El otro recibe 0 filas y el checkout muestra «sin stock». Los `CHECK` de la tabla actúan como red de seguridad final. El movimiento y la reserva se insertan en la misma transacción.

**Expiración.** La reserva caduca junto con la sesión de pago de Stripe; en Checkout, el mínimo de Stripe es 30 minutos. Se libera por:
- el webhook `checkout.session.expired`;
- un cron de barrido cada ~5 min, por si se pierde un webhook.

Si llega un pago de una reserva ya liberada: se reintenta reservar; si no hay stock, se marca `needs_attention` y se reembolsa automáticamente o con una persona (decisión, ver §18).

**Tipos de movimiento:**
- `PURCHASE_RECEIPT` (entrada de proveedor)
- `SALE_STORE`, `SALE_ONLINE`, `SALE_CLICK_COLLECT`
- `RESERVATION`, `RESERVATION_RELEASE`
- `RETURN`, `RETURN_DAMAGED`
- `STOCKTAKE_ADJUSTMENT` (recuento físico: guarda lo esperado frente a lo contado)
- `MANUAL_ADJUSTMENT` (motivo obligatorio)
- `DAMAGE_LOSS`
- `TRANSFER_OUT` / `TRANSFER_IN` (si algún día hay más de una ubicación)
- `TESTER_ALLOCATION` (unidad pasada a probador)

**Punto crítico — ventas de la tienda física.** Si la tienda vende sin registrarlo en este sistema, el stock online será falso y habrá ventas online sin existencias. Necesitamos saber si existe un TPV/POS y si tiene API, o si construimos una pantalla «Venta en tienda» en el admin. **Es la dependencia más importante del inventario** (ver §18).

---

## 10. Admin Architecture

**Navegación** (barra lateral en desktop, menú inferior + cajón en tablet):

1. **Dashboard:**
   - ventas hoy/7/30 días, pedidos y ticket medio;
   - pedidos pendientes de preparar y recogidas listas;
   - reservas activas y stock crítico (≤ mínimo);
   - top ventas;
   - alertas: webhooks fallidos, pagos sin stock, conflictos de research abiertos.
2. **Catálogo:**
   - Productos: listado con filtros por estado de publicación, research y media, completitud y marca. La ficha tiene pestañas General · Variantes y precios · Olfativo · Media · 3D · SEO · Research · Historial. Acciones: crear, editar, publicar (con checklist de `can_publish`), archivar;
   - Marcas, Líneas, Colecciones, Taxonomías (familias, notas, acordes).
3. **Inventario:**
   - stock por variante (on_hand/reserved/available/mínimo);
   - movimientos (filtrable y exportable);
   - ajustes con motivo obligatorio;
   - recuentos (inventario físico);
   - recepción de mercancía;
   - alertas.
4. **Ventas:** pedidos (estados, reembolsos vía Stripe), Click & Collect (preparar → listo → entregado), devoluciones.
5. **Clientes:** listado, ficha, pedidos y consentimientos.
6. **Promociones:** códigos, automáticas, vigencia y uso.
7. **Research:**
   - importaciones del PDF (revisión de ítems y duplicados);
   - cola sin investigar, incompletos (por %), verificados y con conflictos;
   - fuentes.
8. **Media:** biblioteca (filtro por origen y estado), briefs visuales, generados pendientes de aprobar, modelos 3D.
9. **Contenido:** bloques de la home, páginas editoriales, textos legales.
10. **Analytics** (fase posterior).
11. **Configuración:** datos de la tienda y horarios, envío, impuestos, usuarios y roles, integraciones.

**Reglas del admin:**
- toda mutación pasa por un caso de uso del módulo (no hay SQL en las páginas);
- toda acción sensible escribe en `audit_log`;
- las tablas grandes se paginan en servidor;
- el admin debe ser **usable en tablet**, porque se usará detrás del mostrador para recogidas y ventas.

---

## 11. Security Model

**Roles** (tabla `staff_members`, nunca en `user_metadata` editable por el usuario):

| Rol | Puede |
|---|---|
| `owner` | Todo, incluidos usuarios, configuración y precios de coste |
| `manager` | Catálogo, precios, promociones, pedidos, inventario |
| `store_staff` | Pedidos, recogidas, ventas en tienda, recuentos; sin precios de coste ni configuración |
| `content_editor` | Research, media y contenido; sin pedidos, clientes ni precios |
| `customer` | Implícito: usuario autenticado con fila en `customers` |

**RLS:**
- activada en **todas** las tablas;
- lectura pública solo de filas `PUBLISHED` (productos, variantes activas sin `cost_price`, que va en una vista o columna aparte y no es accesible para `anon`);
- los clientes solo ven sus pedidos, direcciones y wishlist;
- el personal accede según la función `has_role()` (SECURITY DEFINER);
- `inventory_movements` y `audit_log` solo admiten INSERT (sin UPDATE ni DELETE, ni siquiera para el personal).

**`/admin`:** middleware (sesión) + comprobación de rol en el layout servidor + RLS. Además, cada Server Action vuelve a comprobar el rol: **las Server Actions son endpoints públicos** aunque no lo parezcan.

**Validación:** zod en toda Server Action, Route Handler y webhook. Nunca se confía en ids, precios ni cantidades del cliente.

**Precios:** el carrito guarda solo `variant_id + qty`. Al crear el pago, el servidor:
1. relee las variantes;
2. aplica las promociones válidas;
3. calcula el envío y el IVA;
4. crea el pedido `pending_payment` con snapshot;
5. crea el objeto de Stripe con **ese** importe.

El webhook verifica la firma, la idempotencia (`payment_events`) y que `amount_received == order.total`. Si no coincide, el pedido va a `needs_attention` y no se confirma.

**Secrets:**
- solo en variables de entorno de Vercel, validadas al arrancar con zod (`lib/env`);
- `SUPABASE_SERVICE_ROLE_KEY` y `STRIPE_SECRET_KEY` solo en módulos `server-only`, usados únicamente por el webhook, el cron y los scripts;
- nada con prefijo `NEXT_PUBLIC_` salvo la URL y la *anon/publishable key*.

**Otros:**
- rate limiting en búsqueda, códigos promocionales y login;
- CSP y cabeceras de seguridad;
- el access token del pedido tiene alta entropía;
- RGPD: consentimientos con fecha, exportación y borrado del cliente, y banner de cookies antes de cualquier analítica no esencial.

---

## 12. Performance Strategy

**Objetivos (p75, móvil real):** LCP < 2,5 s · CLS < 0,1 · INP < 200 ms. En la PDP, el JS inicial debe ser razonablemente pequeño (propongo presupuesto ≤ ~170 KB gzip de JS de primera carga, medido en CI con el informe de build).

| Área | Regla |
|---|---|
| **Imágenes** | `next/image` con `sizes` correctos, AVIF/WebP y dimensiones o `aspect-ratio` fijos (CLS = 0). Solo la imagen LCP lleva `priority` y ninguna otra. Placeholders de color o blur generados al subir |
| **Fuentes** | `next/font` autoalojadas, máximo 2 familias (display + texto) y pocos pesos, subset latin (+ árabe solo donde se use), `display: swap` con métricas de fallback ajustadas |
| **Animación** | Solo `transform`/`opacity`; Framer Motion en islas cliente, con `LazyMotion` + `domAnimation` para reducir peso; respeto de `prefers-reduced-motion`; nada animado bloquea la interacción |
| **3D** | Fuera de todos los bundles iniciales; se carga al interactuar (§8) |
| **Queries** | Índices en slug, estados, FK y búsqueda (GIN tsvector/trigram). Sin N+1: vistas o RPC para listados. Paginación por cursor en el admin |
| **Caching** | Catálogo y fichas cacheados y revalidados por tag (`product:{id}`, `catalog`, `brand:{id}`) al publicar o editar; precio y stock en una isla dinámica; imágenes inmutables con caché larga |
| **Bundle** | Imports de servidor marcados `server-only`; analizador de bundle en CI; nada de librerías pesadas en el storefront sin revisión |
| **Terceros** | Mapa de `/tienda` cargado al hacer clic (placeholder estático); analítica tras consentimiento y con carga diferida |

**Inmediato:** HTML en servidor, CSS, fuente display, imagen hero/LCP, precio y CTA.
**Diferido:** galería más allá de la 1.ª imagen, Scent Journey animado (el contenido se renderiza en servidor y solo se hidrata la animación), recomendaciones (streaming), visor 3D, mapa, chat/WhatsApp.

---

## 13. Initial Design Direction

**Lectura del logotipo:**
- monograma en forma de arco de herradura/ojiva, construido con trazos caligráficos entrelazados;
- estrella de cuatro puntas (arriba, centro y bajo el nombre);
- tracería de arco muy tenue al fondo;
- «ADHARA» en serif de alto contraste con terminales caligráficos;
- «PERFUMERÍA ÁRABE» en versalitas muy espaciadas;
- todo dorado metálico sobre marfil.

El archivo actual es un **render ilustrado** (relieve, brillos, sombras), no un logotipo utilizable en web. **Necesitamos un SVG vectorial plano** (monograma solo, wordmark solo y lockup), en una tinta y en negativo.

| Aspecto | Dirección |
|---|---|
| **Personalidad** | Contemporánea, silenciosa, precisa. Culta sin ser ornamental. Hospitalidad árabe reinterpretada con rigor editorial, no con decoración |
| **Color base (claro)** | Marfiles y arenas cálidos como fondo (no blanco puro); tinta de texto marrón-negro cálido, no #000; neutros piedra para líneas y superficies secundarias |
| **Dorado** | **Solo acento:** líneas finas, la estrella, estados activos, detalles tipográficos puntuales. Dorado **plano y apagado** en UI (sin gradientes metálicos ni brillos; el metal queda para el logo y la fotografía). Uso orientativo < 5 % de la superficie |
| **Oscuros complementarios** | No negro + dorado. Secciones editoriales en tonos profundos de materia: café/oud tostado, índigo nocturno o verde muy oscuro, elegidos por colección o familia olfativa. Siempre como momentos, no como tema global |
| **Acentos de producto** | El color lo aportan las fotografías y las botellas (el catálogo es muy colorido). La UI se mantiene neutra para no competir |
| **Tipografía** | Display: serif de alto contraste con carácter caligráfico, en eco con el wordmark, para titulares grandes y nombres de perfume. Texto: sans humanista o grotesca neutra muy legible, con cifras tabulares para precios. Versalitas espaciadas para etiquetas (eco de «PERFUMERÍA ÁRABE»). Opcional: una tipografía árabe (naskh) para mostrar el nombre árabe de las fragancias como detalle cultural auténtico. Selección concreta y licencias en la Fase de Design System |
| **Fotografía** | Protagonista y coherente: packshots sobre fondos cálidos uniformes, luz lateral suave, sombra de contacto real. Lifestyle con materiales (piedra, lino, latón, madera, resina) en lugar de «explosiones» de ingredientes. Ingredientes fotografiados como bodegón aparte |
| **Espaciado** | Escala en base 4/8; mucho aire; retícula editorial de 12 columnas en desktop y 4 en móvil; ritmo vertical generoso entre secciones |
| **Bordes** | Radios mínimos (0–2 px) o ninguno; líneas de 1 px en tono piedra o dorado apagado como separadores; el arco del logo como **máscara de imagen** en momentos concretos (no en todas las tarjetas) |
| **Sombras** | Prácticamente ninguna en UI; profundidad por capas de color y fotografía |
| **Iconografía** | Trazo fino (1–1,5 px), geométrica y sobria; la estrella de 4 puntas como único ornamento de marca (viñeta, separador, loader) |
| **Motion** | Lento y líquido: fundidos y desplazamientos cortos (200–600 ms, curvas suaves), revelado de imágenes, Scent Journey como transición temporal. Sin rebotes ni parallax agresivo. Todo desactivable con `reduced-motion` |

**Riesgo de marca a vigilar:** muchas referencias del catálogo son perfumes «inspirados en» fragancias de diseñador. La comunicación nunca debe usar nombres de marcas de terceros como reclamo («clon de…»), por riesgo legal de marcas y competencia desleal.

---

## 14. Repository Structure

Estructura por **módulos de dominio** con capas internas, para que la lógica no acabe en `components/`:

```
adhara/
├─ src/
│  ├─ app/                          # SOLO routing y composición (delgado)
│  │  ├─ (storefront)/              # layout público
│  │  │  ├─ page.tsx
│  │  │  ├─ catalogo/ perfume/[slug]/ marcas/ marca/[slug]/ colecciones/ coleccion/[slug]/
│  │  │  ├─ buscar/ carrito/ checkout/ pedido/[token]/ tienda/ (legal)/
│  │  │  └─ cuenta/ acceso/
│  │  ├─ (admin)/admin/             # layout admin + guard de rol
│  │  ├─ api/webhooks/stripe/route.ts
│  │  ├─ api/cron/expire-reservations/route.ts
│  │  ├─ sitemap.ts  robots.ts  layout.tsx
│  ├─ modules/                      # dominio: cada módulo expone index.ts
│  │  ├─ catalog/
│  │  │  ├─ domain/        # tipos, reglas puras (can_publish, slug), sin I/O
│  │  │  ├─ server/        # queries, repositorios, actions ('server-only')
│  │  │  ├─ schemas/       # zod
│  │  │  └─ ui/            # componentes propios del módulo (ProductCard, Filters)
│  │  ├─ commerce/  inventory/  research/  media/  customer/
│  │  ├─ store/            # tienda física + click & collect
│  │  ├─ product-experience/
│  │  │  ├─ scent-journey/
│  │  │  └─ viewer-3d/     # ÚNICO lugar con three/R3F/drei (client-only)
│  │  ├─ auth/  seo/  content/
│  ├─ components/
│  │  ├─ ui/               # design system: primitivas sin lógica de negocio
│  │  └─ layout/           # header, footer, navegación
│  ├─ lib/
│  │  ├─ supabase/         # server.ts, browser.ts, admin.ts (service role, server-only)
│  │  ├─ stripe/  env.ts  money.ts  utils/
│  ├─ config/              # site, rutas, feature flags (3D on/off), pesos de completitud
│  └─ styles/              # tokens (CSS variables) + Tailwind
├─ supabase/
│  ├─ migrations/          # SQL versionado (fuente de verdad del esquema)
│  ├─ seed/                # solo datos de referencia revisados (sin productos ficticios)
│  └─ tests/               # tests de RLS y RPC (pgTAP o scripts)
├─ scripts/
│  ├─ catalog-import/      # PDF → raw items → normalización (offline)
│  └─ media/               # optimización GLB, validación de presupuestos
├─ tests/e2e/              # Playwright
├─ docs/                   # ver §16
├─ public/                 # favicons, logo SVG
├─ CLAUDE.md  README.md
```

**Reglas de dependencia:**
- `app` → `modules` (index) → `lib`;
- `components/ui` no importa de `modules`;
- un módulo no importa el interior de otro;
- `viewer-3d` solo se importa vía `next/dynamic`;
- los tipos de BD se generan con `supabase gen types` en `src/lib/supabase/database.types.ts`.

Opcional: `eslint-plugin-boundaries` para imponer estas reglas en CI. Es la única dependencia de tooling extra que propondría; se decidirá en la Fase 1.

El PDF (50 MB) **no se sube a git**: va al bucket privado `catalog-source`.

---

## 15. Development Workflow

**Protocolo por fase** (tal como pediste):

1. **PLAN:** alcance, archivos previstos, decisiones y riesgos. Espera tu aprobación.
2. **IMPLEMENT:** solo lo aprobado, en una rama `phase/NN-nombre`.
3. **VERIFY:** `tsc --noEmit`, lint, tests (unitarios + RLS + e2e cuando aplique), `next build`, revisión responsive (360/768/1280/1600), accesibilidad (axe + teclado) y Lighthouse en las rutas afectadas.
4. **REPORT:** qué se creó, archivos, decisiones (→ DECISIONS.md), problemas, deuda técnica y siguiente fase recomendada. **Me detengo.**

**Infraestructura del flujo:**
- GitHub con PR por fase;
- CI (GitHub Actions: typecheck, lint, test, build);
- Vercel Preview por PR;
- Supabase con proyecto **dev** y **prod** separados; migraciones solo vía CLI y revisadas en el PR;
- Stripe en modo test hasta la fase de producción.

**Definición de hecho** (común a todas las fases): CI en verde, sin `any` sin justificar, sin secretos en el código, docs actualizadas, criterios de la fase verificados y enumerados en el REPORT.

Veo que en esta sesión hay conectores de **Supabase** y **Vercel** disponibles. Podrían usarse en la Fase 1 para crear o inspeccionar los proyectos, **siempre con tu aprobación previa**.

---

## 16. Documentation Strategy

| Documento | Contenido | Se actualiza |
|---|---|---|
| `README.md` | Qué es, requisitos, arranque local, scripts, variables de entorno | Fase 1 y cuando cambie el setup |
| `CLAUDE.md` | Instrucciones persistentes para el asistente: stack, reglas de arquitectura, convenciones, «no hacer», protocolo PLAN/IMPLEMENT/VERIFY/REPORT, enlaces a docs | Cada fase |
| `docs/ARCHITECTURE.md` | Este documento consolidado: módulos, capas, flujo de datos, ejecución servidor/cliente | Cuando cambie la arquitectura |
| `docs/DATABASE.md` | Entidades, relaciones, estados, RLS, RPC; diagrama ER | Con cada migración relevante |
| `docs/DESIGN_SYSTEM.md` | Tokens, tipografía, componentes, reglas de uso del dorado, motion | Fase DS y siguientes |
| `docs/PRODUCT_RESEARCH.md` | Orígenes de datos, prioridad de fuentes, claims, conflictos, completitud, reglas de publicación | Fases de import y research |
| `docs/INVENTORY.md` *(añadido)* | Fórmula, ciclo de reservas, tipos de movimiento, procedimientos de tienda | Fase de inventario |
| `docs/SECURITY.md` *(añadido)* | Roles, matriz de permisos, RLS, secretos, webhooks | Continuo |
| `docs/ROADMAP.md` | Fases, estado y criterios | Al cerrar cada fase |
| `docs/DECISIONS.md` | ADR simplificado: `ADR-NNN · fecha · contexto · decisión · alternativas descartadas · consecuencias · estado` (propuesta/aceptada/sustituida por ADR-X). **Nunca se borra una decisión: se sustituye** | Cada decisión relevante |
| `docs/CATALOG_IMPORT_REPORT.md` *(añadido)* | Resultado de la importación: conteos, duplicados, conflictos | Fase de importación |

ADRs iniciales que propongo registrar al aprobar esta fase:
1. monolito Next.js con módulos de dominio;
2. producto/variante con precio y stock en la variante;
3. provenance mediante claims;
4. estados de publicación, research y media separados;
5. reserva de stock atómica en Postgres;
6. el precio siempre se calcula en servidor;
7. el 3D solo en la PDP y bajo demanda;
8. solo español en el lanzamiento;
9. roadmap reordenado.

---

## 17. Roadmap

Propongo este orden. El cambio principal respecto al original es construir el backend y la importación **antes** que las páginas, para no depender de datos ficticios; la Homepage pasa al final porque depende de producto e imágenes reales.

| # | Fase | Objetivo | Entregables | Dependencias | Criterios verificables de finalización |
|---|---|---|---|---|---|
| 0 | Arquitectura | Especificación aprobada | Este documento | — | Aprobación explícita; decisiones abiertas respondidas o aplazadas con fecha |
| 1 | **Fundaciones** | Repo y plataforma listos y seguros | Next.js + TS estricto + Tailwind; estructura de §14; lint/format; CI; proyectos Supabase dev/prod; migraciones **núcleo** (catálogo, provenance, media, staff); RLS base; Auth del personal + guard de `/admin`; env validado; docs iniciales + ADRs | F0 | CI en verde; `next build` sin errores; tests de RLS (anon no lee DRAFT, no-staff no accede al admin, cost_price invisible para anon); Preview de Vercel desplegado; `/admin` redirige sin sesión |
| 2 | Design System | Lenguaje visual implementable | Logo SVG; tokens (color, tipografía, espaciado, motion) claro/oscuro; primitivas (`Button`, `Link`, `Input`, `Select`, `Sheet`, `Dialog`, `Tag`, `Price`…); página interna de referencia en `/admin/design` | F1; SVG del logo; elección de fuentes | Contraste AA verificado en todas las combinaciones de tokens; componentes navegables por teclado; axe sin errores; revisión visual aprobada por ti |
| 3 | Importación del catálogo | PDF → BD como DRAFT, sin publicar nada | Script de extracción; `catalog_raw_items` con recortes; normalización; matching y duplicados; pantalla de revisión en admin; `CATALOG_IMPORT_REPORT.md` | F1 | El 100 % de entradas con precio tienen un raw item (conteo cuadrado con el PDF); los duplicados conocidos (§6) están detectados; 0 productos publicados; cada producto enlaza a su raw item |
| 4 | Research system | Enriquecer y verificar con trazabilidad | Claims, fuentes, conflictos, completitud, colas del admin | F3 | Toda nota o campo publicado tiene claim y fuente consultables; un conflicto de prueba no se resuelve sin acción humana; el % coincide con el cálculo manual en 5 productos |
| 5 | Catálogo (storefront) | Navegar productos reales | `/catalogo`, `/marcas`, `/marca/[slug]`, `/colecciones`, búsqueda, filtros por URL | F2, F4 (al menos N productos publicables) | Lighthouse móvil ≥ 90 en rendimiento y accesibilidad; CLS < 0,1; los filtros funcionan sin JS en lo esencial; solo aparecen productos PUBLISHED |
| 6 | PDP + Scent Journey | Ficha editorial completa | `/perfume/[slug]`, Scent Journey, relacionados, JSON-LD | F5 | JSON-LD válido (Rich Results Test); la PDP funciona sin notas, sin variante de volumen conocido o sin 3D, sin romper el layout; LCP < 2,5 s en 4G simulado |
| 7 | Media y generación de assets | Imágenes premium coherentes | Biblioteca, roles, briefs visuales, flujo de aprobación, OG | F4 | Ningún asset `ai_generated` sin aprobación visible en público; reemplazar un packshot no requiere editar el producto; cada asset tiene origen y derechos |
| 8 | Experiencia 3D | Visor bajo demanda | Viewer, pipeline GLB, presupuestos en CI | F6, F7, modelos disponibles | 0 bytes de three.js en el bundle inicial de la PDP (verificado con el analizador); fallback correcto sin WebGL; modelo ≤ presupuesto |
| 9 | Inventario | Stock fiable y auditable | Niveles, movimientos, reservas, recuentos, ventas en tienda (o integración con el TPV) | F1; respuesta sobre el TPV | Test de concurrencia: N compras simultáneas de la última unidad → exactamente 1 éxito; `on_hand` = suma de movimientos; no se pueden editar ni borrar movimientos |
| 10 | Carrito y checkout | Vender online | Carrito en servidor, Stripe, webhooks, pedidos, emails | F9, email, cuenta de Stripe | El precio manipulado en el cliente no altera el cobro (test); webhook idempotente (reenvío doble = 1 pedido); pago expirado libera la reserva; e2e completo en modo test |
| 11 | Admin operativo | Gestionar el negocio | Dashboard, pedidos, clientes, promociones, audit log | F9, F10 | Cada KPI del dashboard coincide con una consulta de control; toda acción sensible queda en `audit_log`; roles probados según la matriz |
| 12 | Click & Collect + `/tienda` | Recogida en tienda | Flujo de preparación y aviso, página de tienda, LocalBusiness | F10, datos de la tienda | Un pedido C&C reserva stock de la ubicación de la tienda; los estados notifican al cliente; JSON-LD válido |
| 13 | Homepage | Portada editorial | Home gestionada desde Contenido | F5–F7 | Solo usa productos e imágenes reales publicados; LCP < 2,5 s; bloques editables sin desplegar |
| 14 | Cuenta cliente | Área privada | Pedidos, direcciones, wishlist | F10 | RLS: un cliente no puede leer pedidos ajenos (test) |
| 15 | SEO y Analytics | Visibilidad y medición | Sitemap, canonical, metadata, redirecciones, analítica con consentimiento | F5, F6, F12 | Sitemap sin URLs `noindex`; canonical correctos en URLs con filtros; no se carga analítica sin consentimiento |
| 16 | QA, seguridad y performance | Endurecimiento | Auditorías, pentest básico, pruebas de carga del checkout | Todo | Checklist de seguridad cerrada; Core Web Vitals en objetivo; 0 errores críticos abiertos |
| 17 | Producción | Lanzamiento | Dominio, Stripe live, backups, monitorización, runbook | F16, legales | Compra real de prueba reembolsada end-to-end; backups verificados con restauración; alertas activas |

---

## 18. Risks / Open Questions

### Bloqueantes o de alto impacto (necesito respuesta antes de las fases indicadas)

1. **¿Qué son los precios del PDF: PVP con IVA, precio mayorista o coste?** Algunos parecen bajos para PVP (p. ej. Club de Nuit Intense a 28 €). Afecta al modelo de precios y a la F3.
2. **¿Es el PDF vuestro catálogo o el de un distribuidor?** ¿Vendéis *todos* esos productos o solo una selección? ¿Hay stock real de cada uno? (F3)
3. **Volúmenes y formatos.** El PDF no indica ml. ¿Cada perfume se vende en un solo formato? ¿Hay sets de regalo, aceites, *body mists*? (F3)
4. **TPV de la tienda física.** ¿Existe? ¿Cuál? ¿Tiene API o exportación? Sin esto el stock online no es fiable. (F9)
5. **Precios de coste:** ¿se gestionarán en la plataforma? (F1: permisos)
6. **Idiomas:** ¿solo español o también catalán/inglés? Cambia el routing. (F1)
7. **Envíos:** ¿solo península, Baleares/Canarias (IVA/IGIC), UE? Tarifas, transportista, umbral de envío gratis. (F10)
8. **Checkout como invitado** además de con cuenta: recomiendo que sí. (F10)
9. **Stripe:** ¿cuenta existente? ¿Métodos de pago deseados (tarjeta, Apple/Google Pay, Bizum si la plataforma lo permite)? ¿Checkout embebido de Stripe o Payment Element propio? Recomiendo el primero para empezar, por menor superficie y mantenimiento. (F10)
10. **Pago recibido cuando la reserva ya había expirado y no hay stock:** ¿reembolso automático o gestión manual? (F10)

### Información que falta
- Razón social, CIF, dirección exacta, horarios, teléfono, WhatsApp y fotos de la tienda (legales y `/tienda`).
- Logo en SVG; guía de marca si existe; licencias tipográficas.
- Política de devoluciones: los perfumes abiertos o precintados afectan al derecho de desistimiento.
- Dominio, cuentas de GitHub/Vercel/Supabase a usar y proveedor de email.
- Origen de los modelos 3D y fotografía propia prevista.
- Obligaciones de información de cosméticos en la venta online (Reglamento UE 1223/2009: ingredientes, alérgenos, persona responsable): **conviene confirmarlo con un asesor**, porque condiciona campos del modelo.

### Riesgos
- **Derechos de imagen:** las imágenes del PDF incluyen marcas de agua de terceros; las imágenes oficiales de marca requieren permiso. Las imágenes generadas con IA de productos reales deben ser fieles y no inducir a error.
- **Marcas registradas:** no usar reclamos del tipo «inspirado en / dupe de [marca de diseñador]».
- **Calidad del research:** mucha información de perfumería árabe está solo en retailers y bases de datos de fiabilidad media. Habrá conflictos frecuentes, así que el flujo de revisión debe ser rápido.
- **Carga operativa:** unos 420 productos × research + media + 3D es mucho trabajo manual de revisión. Recomiendo priorizar una primera tanda (p. ej. los 40–60 más vendidos) para el lanzamiento.
- **Coste de optimización de imágenes** en Vercel frente a Supabase con catálogos grandes: decidir en la F7.
- **Next.js y dependencias:** fijaré las versiones estables vigentes al iniciar la F1 y las documentaré.

---

## 19. Recommended Phase 1

**Fase 1 — Fundaciones técnicas** (y no Design System todavía). El Design System necesita repo, tokens en código y una página de referencia; y la importación del catálogo necesita el esquema. Las fundaciones desbloquean ambas cosas.

**Alcance propuesto:**
1. Proyecto Next.js (App Router, TS estricto, Tailwind, ESLint/Prettier) con la estructura de §14.
2. `lib/env` con validación zod; clientes Supabase server/browser/admin; `server-only`.
3. Supabase dev: migraciones **núcleo** de catálogo (brands, product_lines, categories, products, product_variants, olfactory_families, fragrance_notes, product_notes), provenance (catalog_imports, catalog_raw_items, sources, product_claims, product_conflicts, product_field_provenance), media (media_assets, product_media) y staff_members/audit_log. Inventario, comercio y clientes **quedan para sus fases**.
4. RLS base + tests de RLS.
5. Auth del personal + middleware + layout `/admin` protegido (vacío).
6. CI (typecheck, lint, test, build) + Preview en Vercel.
7. `README.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DECISIONS.md` con los ADRs iniciales, `docs/ROADMAP.md`.

**Fuera de alcance:** páginas del storefront, componentes visuales, importación de productos y cualquier dato de producto.

**Necesito de ti para arrancar la Fase 1:**
- aprobación (o cambios) de esta arquitectura y del roadmap reordenado;
- respuestas a las preguntas 1, 2, 5 y 6 de §18; el resto puede esperar a su fase;
- las cuentas a usar (GitHub, Vercel, Supabase).

Me detengo aquí a la espera de tu aprobación.
