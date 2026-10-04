# Graph Report - adhara-web  (2026-10-04)

## Corpus Check
- Large corpus: 507 files · ~700,943 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2676 nodes · 7435 edges · 133 communities (101 shown, 32 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 271 edges (avg confidence: 0.87)
- Token cost: 636,601 input · 0 output

## Community Hubs (Navigation)
- Informes y auditoría
- Sistema de diseño: contraste y tokens
- Movimientos de inventario
- Migración compras y mostrador
- Pedidos de compra (páginas)
- Páginas de catálogo del panel
- Acciones servidor catálogo e invitaciones
- Plan del panel y entorno
- Acciones de compras
- Importación y paginación de catálogo
- Dependencias del prototipo 3D
- Asistente e informe diario (UI)
- Asistente IA y cron
- Productos de unboxing y borradores
- Mostrador y tickets
- Modelo de producto y tienda
- Fases del panel y base de datos
- Servidor de inventario y mostrador
- Arquitectura y navegación del panel
- Control de acceso del equipo
- Movimiento del prototipo
- Formularios de catálogo e importación
- Scripts de auditoría y secretos
- Ficha pública y vista previa
- Dominio de precios
- Esquema de productos (prototipo)
- Botellas 3D (prototipo)
- Scripts de concurrencia y lint BD
- Login, contraseña y MFA
- Catálogo público
- Esquema de productos unboxing
- Configuración raíz del paquete
- Botón y tipografía UI
- Interfaz del prototipo
- Etiquetas y alta de producto
- Escena de botella unboxing
- Botellas 3D unboxing
- Escena de botella (prototipo)
- Fichas de producto del prototipo
- Decisiones de entornos y migraciones
- Revisión de PVP y módulos
- Flujo del piloto de animación
- Confirmación e iconografía
- Badges y etiquetas UI
- Configuración TypeScript
- Marca, fuentes y layout
- Campos de formulario UI
- Migración de catálogo
- Instrucciones de agentes y CI
- Asistente: secretos y aprobación
- Mensajes i18n y SEO
- Layout y errores del panel
- Contenido y configuración de tienda
- Movimiento de unboxing
- Estado e informe de Fase 1
- Seguridad y pruebas pgTAP
- Reglas de precios y dinero
- Supabase SSR y proxy
- Contenido editable e i18n
- Migración ediciones seguras
- Controles de formulario
- Plantilla de PR y Supabase
- Cambio masivo de precios
- Migración de inventario
- Arquitectura Fase 0
- IVA y etiquetas de precio
- Investigación de producto
- TSConfig del prototipo
- Tipos BD y bootstrap
- Estado de acciones y errores
- Acciones de stock UI
- Plan Fase 2 diseño
- Dependencias de desarrollo
- Scripts de pnpm
- Navegación i18n de tienda
- Estados de pedido
- Plan tienda física y reposición
- Pruebas de compras y mostrador
- Dependencias de ejecución
- Prototipo de animación (docs)
- Conversaciones con clientes
- Visor unboxing y WebGL
- Migración personal y permisos
- Auditoría de layout
- Pruebas E2E Playwright
- Pruebas de integración
- CI y criterios Fase 2
- Línea de tiempo de animación
- Migración informes del asistente
- Módulos del dominio Fase 0
- Migración de contenido
- Biblioteca de primitivas UI
- Migración de informes
- Guardia del sistema de diseño
- Workflow E2E
- Arquetipos de botella
- Botella torneada (prototipo)
- Botella torneada unboxing
- Migración costes de variante
- Prioridades de negocio
- Workflow de base de datos
- Índices de personal
- Salida de vista previa
- Permisos pendientes de personal
- Guardas MFA de administración
- Prueba de concurrencia
- Pruebas de informes
- Stack y workspace
- Pruebas catálogo e inventario
- Pruebas del asistente
- Pruebas garantías Fase 1
- Pruebas de entrega
- Cron de Vercel
- PostCSS

## God Nodes (most connected - your core abstractions)
1. `requirePermission()` - 108 edges
2. `next` - 83 edges
3. `Decisiones (registro y ADR)` - 63 edges
4. `PageHeader()` - 56 edges
5. `isAllowed()` - 54 edges
6. `SubmitButton()` - 47 edges
7. `cx()` - 46 edges
8. `Field()` - 43 edges
9. `FormMessage()` - 43 edges
10. `fail()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `ADHARA — PLAN de la Fase 1: Fundaciones` --references--> `grossToNet()`  [INFERRED]
  docs/source/FASE_1_PLAN.md → src/lib/money.ts
- `requireStaff()` --implements--> `MFA TOTP y sesión aal2`  [INFERRED]
  src/modules/auth/server/session.ts → docs/SECURITY.md
- `Reposición (vigilante y propuestas) implementada` --conceptually_related_to--> `watchStock()`  [INFERRED]
  docs/STATUS.md → src/modules/inventory/domain/stock-watch.ts
- `watchStock()` --implements--> `Vigilante de stock determinista sin IA (A4.1)`  [INFERRED]
  src/modules/inventory/domain/stock-watch.ts → docs/PLAN_TIENDA_REPOSICION.md
- `Tests iniciales (Vitest, pgTAP, Playwright)` --references--> `computeMargin()`  [INFERRED]
  docs/source/FASE_1_PLAN.md → src/modules/pricing/domain/margin.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three required GitHub Actions workflows protecting main** — _github_workflows_ci, _github_workflows_db, _github_workflows_e2e [EXTRACTED 1.00]
- **Unboxing choreography: spec drives timeline events that reveal the product panel** — pilot_piloto_animacion_flujo_motion_spec, pilot_piloto_animacion_flujo_timeline_events, pilot_piloto_animacion_flujo_productpanel, pilot_piloto_animacion_flujo_unboxingscene, pilot_animation_prototype_readme_motion_spec_module, pilot_animation_prototype_readme_timeline_sample [EXTRACTED 1.00]
- **Pilot asset provenance: AI drafts, official references, own store-kit photos** — pilot_assets_drafts_provenance_draft_rejected_naming, pilot_assets_refs_provenance_not_publishable, pilot_assets_refs_provenance_simulated_parts, pilot_kit_readme_photo_origin, agents_no_invented_product_data [INFERRED 0.85]
- **Autorización en capas del panel (proxy, guardas, RLS, funciones admin_* con MFA)** — docs_architecture_proxy_ts, docs_admin_plan_four_layer_authorization, docs_database_rls_deny_by_default, docs_database_admin_functions, docs_admin_plan_aal2_mfa, docs_database_has_permission [INFERRED 0.85]
- **Flujo del informe diario programado** — docs_architecture_cron_daily_report, docs_architecture_create_job_client, docs_decisions_daily_report, docs_admin_plan_watchstock, docs_database_admin_stock_watch_facts, docs_database_admin_open_purchase_orders, docs_database_is_service_role, docs_database_daily_reports_table [EXTRACTED 1.00]
- **Escrituras de stock solo mediante movimientos de solo inserción** — docs_database_admin_record_inventory_movement, docs_database_admin_record_store_sale, docs_database_admin_receive_purchase_order, docs_database_inventory_movements, docs_database_reject_mutation, docs_decisions_adr_005 [INFERRED 0.85]
- **Flujo de autorización del panel (proxy, layout, acción, RLS, MFA)** — src_proxy, src_modules_auth_server_session_requirestaff, src_modules_auth_server_session_requirepermission, docs_source_fase_1_plan_rls_denegar_defecto, docs_security_mfa_aal2 [EXTRACTED 1.00]
- **Cálculo y revisión de precios (dinero, margen, Ómnibus, política)** — src_lib_money_grosstonet, src_lib_money_nettogross, src_lib_money_dividehalfeven, src_modules_pricing_domain_margin_computemargin, src_modules_pricing_domain_price_change_reviewpricechange, src_modules_pricing_domain_omnibus_lowestpriceinwindow, src_modules_pricing_domain_policy_provisional_pricing_policy [INFERRED 0.85]
- **Ciclo de stock de la Fase R (proveedores, pedidos, mostrador, reposición)** — docs_plan_tienda_reposicion_r02_proveedores, docs_plan_tienda_reposicion_r03_pedidos_compra, docs_plan_tienda_reposicion_r04_mostrador, docs_plan_tienda_reposicion_r05_reposicion, docs_plan_tienda_reposicion_admin_record_inventory_movement, src_modules_inventory_domain_stock_watch_watchstock [EXTRACTED 1.00]

## Communities (133 total, 32 thin omitted)

### Community 0 - "Informes y auditoría"
Cohesion: 0.06
Nodes (78): AuditLog(), DATE, metadata, Search, short(), shortId(), DAYS, LeadTime() (+70 more)

### Community 1 - "Sistema de diseño: contraste y tokens"
Cohesion: 0.08
Nodes (63): contrastRatio(), formatRatio(), luminance(), parseColor(), Rgb, ACCENT_BACKGROUNDS, ANIMATION_TOKENS, backgroundsFor() (+55 more)

### Community 2 - "Movimientos de inventario"
Cohesion: 0.06
Nodes (61): DATE, GET(), DATE, metadata, metadata, proposalNote(), REORDER_KINDS, Replenishment() (+53 more)

### Community 3 - "Migración compras y mostrador"
Cohesion: 0.05
Nodes (35): internal.purchase_order_lines, internal.purchase_orders, internal.purchase_receipt_lines, internal.purchase_receipts, internal.supplier_variants, internal.suppliers, private.lock_purchase_order(), private.parse_quantity_items() (+27 more)

### Community 4 - "Pedidos de compra (páginas)"
Cohesion: 0.08
Nodes (44): DATE, DATE_TIME, metadata, PurchaseOrderPage(), Section(), DATE, metadata, Purchases() (+36 more)

### Community 5 - "Páginas de catálogo del panel"
Cohesion: 0.10
Nodes (40): next, EditProduct(), metadata, Section(), CatalogAdmin(), FILTERS, metadata, normalize() (+32 more)

### Community 6 - "Acciones servidor catálogo e invitaciones"
Cohesion: 0.11
Nodes (45): createAuthAdminClient(), fail(), ok(), describeDbError(), cancelInvite(), inviteStaff(), requirePermission(), grantStaff() (+37 more)

### Community 7 - "Plan del panel y entorno"
Cohesion: 0.08
Nodes (35): Entorno y validación de administración, scripts/local-env.ts (credenciales efímeras de la CLI), Mailpit (correo local), Proyecto Supabase local adhara-admin-delivery, Plantillas de Auth supabase/templates, Guía del panel de tienda, Recepción de mercancía sin duplicar stock, Equipo: invitaciones y desactivación de personal (+27 more)

### Community 8 - "Acciones de compras"
Cohesion: 0.11
Nodes (41): Field(), FormMessage(), assignInput, assignSupplierBrand(), changePurchaseOrderStatus(), createOrdersFromProposals(), createPurchaseOrder(), headerInput (+33 more)

### Community 9 - "Importación y paginación de catálogo"
Cohesion: 0.07
Nodes (41): RFC-4180, chunk(), PAGE_SIZE, PageResult, AUDIENCE_ALIASES, COLUMN_ALIASES, CONCENTRATION_ALIASES, CostAction (+33 more)

### Community 10 - "Dependencias del prototipo 3D"
Cohesion: 0.05
Nodes (41): dependencies, react, react-dom, @react-three/drei, @react-three/fiber, three, zod, description (+33 more)

### Community 11 - "Asistente e informe diario (UI)"
Cohesion: 0.10
Nodes (33): AssistantPage(), metadata, TIME, buildDailyReport(), DAILY_REPORT_VERSION, DAILY_TASK_KEYS, DAILY_TASK_PERMISSIONS, DailyReport (+25 more)

### Community 12 - "Asistente IA y cron"
Cohesion: 0.11
Nodes (31): @anthropic-ai/sdk, dynamic, maxDuration, POST(), authorized(), dynamic, GET(), maxDuration (+23 more)

### Community 13 - "Productos de unboxing y borradores"
Cohesion: 0.09
Nodes (13): asad, ASAD_DRAFT, LATTAFA_CYLINDER_PROFILE, asset(), clubDeNuitIntenseManLE, DRAFT, scenes, DRAFT (+5 more)

### Community 14 - "Mostrador y tickets"
Cohesion: 0.13
Nodes (29): query(), newRequestId(), addToTicket(), COUNTER_KIND_LABELS, COUNTER_KINDS, CounterItem, CounterKind, findByCode() (+21 more)

### Community 15 - "Modelo de producto y tienda"
Cohesion: 0.13
Nodes (29): EmptyState(), Audience, AUDIENCES, Availability, Concentration, CONCENTRATION_NAMES, CONCENTRATIONS, heroMedia() (+21 more)

### Community 16 - "Fases del panel y base de datos"
Cohesion: 0.09
Nodes (28): Fase A3 — Inventario operativo, Fase A8 — Dashboard, informes y configuración, Venta en tienda o integración con TPV, Módulo reports, Base de datos, Funciones admin_* SECURITY DEFINER, admin_open_purchase_orders, admin_receive_purchase_order (+20 more)

### Community 17 - "Servidor de inventario y mostrador"
Cohesion: 0.14
Nodes (28): server-only, CounterPage(), metadata, TIME, fetchAll(), StaffContext, MovementFilter, MovementRow (+20 more)

### Community 18 - "Arquitectura y navegación del panel"
Cohesion: 0.08
Nodes (28): Navegación del panel (menú lateral, panel móvil, Sheet de inventario), Fase A5 — Pedidos y Click & Collect, Fase A6 — Mensajes con clientes, Arquitectura, createSupabasePublicClient, createSupabaseServerClient, Módulo admin (useAdminAction, Sheet, avisos), Módulo auth (+20 more)

### Community 19 - "Control de acceso del equipo"
Cohesion: 0.12
Nodes (25): DATE, metadata, AdminAccess, AdminAccessInput, decideAdminAccess(), ROLE_LABELS, AAL2_PERMISSIONS, AuthenticatorLevel (+17 more)

### Community 20 - "Movimiento del prototipo"
Cohesion: 0.10
Nodes (19): clamp01(), easings, range01(), CameraPose, Ease, EaseName, EASINGS, Framing (+11 more)

### Community 21 - "Formularios de catálogo e importación"
Cohesion: 0.13
Nodes (21): ImportCatalogPage(), metadata, SubmitButton(), useAdminAction(), GenerateReportButton(), BulkPricing(), CatalogImport(), DeleteProductButton() (+13 more)

### Community 22 - "Scripts de auditoría y secretos"
Cohesion: 0.09
Nodes (18): vitest, dir, IMPACT_ORDER, pages, rows, rules, Summary, findSecrets() (+10 more)

### Community 23 - "Ficha pública y vista previa"
Cohesion: 0.13
Nodes (24): metadata, ProductPreview(), Params, ProductPage(), revalidate, createSupabasePublicClient(), isAudience(), isConcentration() (+16 more)

### Community 24 - "Dominio de precios"
Cohesion: 0.17
Nodes (21): Cambio masivo de PVP, grossToNet(), isNonNegativeCents(), ratioBp(), BulkRow, PRICE_ISSUE_LABELS, computeMargin(), Margin (+13 more)

### Community 25 - "Esquema de productos (prototipo)"
Cohesion: 0.09
Nodes (26): BottleShape, BottleShapeSchema, BOX_FACES, BoxConfig, BoxFace, BoxFaceImage, BoxSchema, DraftFile (+18 more)

### Community 26 - "Botellas 3D (prototipo)"
Cohesion: 0.17
Nodes (23): FrontProjection, MaterialConfig, ShapeOf, LatheBottle(), Props, build(), Props, RectPrismBottle() (+15 more)

### Community 27 - "Scripts de concurrencia y lint BD"
Cohesion: 0.07
Nodes (23): Issue, output, Result, { results = [] }, TEMP_TABLES, unexpected, formatted, generated (+15 more)

### Community 28 - "Login, contraseña y MFA"
Cohesion: 0.14
Nodes (24): AdminLogin(), ERRORS, AdminPassword(), AdminMfa(), Recovery(), AuthError(), AuthScreen(), audit() (+16 more)

### Community 29 - "Catálogo público"
Cohesion: 0.19
Nodes (20): Catalog(), generateMetadata(), revalidate, NotFound(), generateMetadata(), Home(), revalidate, generateMetadata() (+12 more)

### Community 30 - "Esquema de productos unboxing"
Cohesion: 0.10
Nodes (26): BottleShape, BottleShapeSchema, BOX_FACES, BoxConfig, BoxFace, BoxFaceImage, BoxSchema, DraftFile (+18 more)

### Community 31 - "Configuración raíz del paquete"
Cohesion: 0.07
Nodes (26): engines, node, react, react-dom, @react-three/drei, @react-three/fiber, three, @types/react (+18 more)

### Community 32 - "Botón y tipografía UI"
Cohesion: 0.12
Nodes (21): AsButton, AsLink, BUTTON_SIZES, BUTTON_VARIANTS, ButtonSize, ButtonVariant, Common, Content() (+13 more)

### Community 33 - "Interfaz del prototipo"
Cohesion: 0.13
Nodes (15): App(), initialSlug, Phase, ProductConfig, Props, DebugDock(), PHASE_LABEL, Props (+7 more)

### Community 34 - "Etiquetas y alta de producto"
Cohesion: 0.11
Nodes (21): metadata, PriceLabels(), metadata, NewProduct(), BulkPricingPage(), metadata, metadata, SupplierPage() (+13 more)

### Community 35 - "Escena de botella unboxing"
Cohesion: 0.18
Nodes (20): lerp(), ProductConfig, Bottle(), Props, latheShoulderSize(), rectPrismSize(), squareGlassSize(), CameraRig() (+12 more)

### Community 36 - "Botellas 3D unboxing"
Cohesion: 0.19
Nodes (21): FrontProjection, MaterialConfig, ShapeOf, LatheBottle(), Props, build(), Props, RectPrismBottle() (+13 more)

### Community 37 - "Escena de botella (prototipo)"
Cohesion: 0.19
Nodes (18): lerp(), Bottle(), latheShoulderSize(), rectPrismSize(), squareGlassSize(), CameraRig(), fitDistance(), framingFor() (+10 more)

### Community 38 - "Fichas de producto del prototipo"
Cohesion: 0.13
Nodes (12): asad, ASAD_DRAFT, LATTAFA_CYLINDER_PROFILE, clubDeNuitIntenseManLE, DRAFT, products, DRAFT, khamrah (+4 more)

### Community 39 - "Decisiones de entornos y migraciones"
Cohesion: 0.13
Nodes (13): Entornos Local, CI, Preview y Production, 17 migraciones de Supabase, Tabla product_media, Decisiones (registro y ADR), Proyecto adhara-dev (eu-central-1), CI en tres workflows: ci.yml, db.yml, e2e.yml (§84), Exportación de movimientos en CSV para Excel (§52), Roles preasignados por email (private.pending_staff_grants) (+5 more)

### Community 40 - "Revisión de PVP y módulos"
Cohesion: 0.13
Nodes (18): Flujo de revisión de PVP (caducidad 15 min), Fase A2 — Catálogo y precios, Módulo catalog, Módulo pricing, Módulo purchasing, admin_review_price / admin_apply_price_review, tests/e2e/cost-leak.spec.ts (coste centinela), internal.price_change_log (+10 more)

### Community 41 - "Flujo del piloto de animación"
Cohesion: 0.12
Nodes (23): src/scene/Box.tsx (base + lid, 3 openings, per-face material), src/products/*.ts (ESTIMATED measurements, archetype, materials, draft image), src/scene/projection.ts (front draft projection calibrated px/mm), Pilot visual drafts provenance, GENERATED drafts with _DRAFT / _REJECTED filename status, Official brand references provenance (internal use), Armaf (brand), Foil map (G = roughness, B = metalness) derived from box faces (+15 more)

### Community 42 - "Confirmación e iconografía"
Cohesion: 0.17
Nodes (16): Button(), useConfirm(), ICON_NAMES, StarDivider(), StarList(), StarLoader(), Text(), toast() (+8 more)

### Community 43 - "Badges y etiquetas UI"
Cohesion: 0.19
Nodes (18): Badge(), BADGE_TONES, BadgeTone, Tag(), TONES, cx(), Price(), Card() (+10 more)

### Community 44 - "Configuración TypeScript"
Cohesion: 0.08
Nodes (24): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+16 more)

### Community 45 - "Marca, fuentes y layout"
Cohesion: 0.15
Nodes (13): metadata, display, fontVariables, sans, generateMetadata(), LocaleLayout(), BRAND_NAME, BRAND_TAGLINE (+5 more)

### Community 46 - "Campos de formulario UI"
Cohesion: 0.14
Nodes (18): Choice(), ChoiceProps, describedBy(), FIELD_LABEL, FieldControlProps, FieldMessages(), Fieldset(), DIRECTIONS (+10 more)

### Community 47 - "Migración de catálogo"
Cohesion: 0.15
Nodes (20): brands_updated_at, internal.price_change_log, price_change_log_append_only, price_change_log_variant_idx, private.enforce_product_publication(), product_media_product_idx, product_translations_updated_at, product_variants_price_guard (+12 more)

### Community 48 - "Instrucciones de agentes y CI"
Cohesion: 0.15
Nodes (13): CI Workflow (ci.yml), quality job (scan:secrets, format, lint, typecheck, unit, build), AGENTS.md (Codex instructions), Locales es/ca/en, Spanish default, prefixed URLs, CLAUDE.md (Claude Code instructions), src/modules/<dominio> architecture (domain/, server/, ui/, index.ts vs server.ts), requireStaff / requirePermission on every admin page, action and Route Handler, README (L’Atelier du Désert · adhara-web) (+5 more)

### Community 49 - "Asistente: secretos y aprobación"
Cohesion: 0.13
Nodes (17): ANTHROPIC_API_KEY, CRON_SECRET y SUPABASE_SECRET_KEY en Vercel, Panel → Asistente e informe diario, Fase A4 — Agente de inventario, A4.1 — Vigilante determinista, A4.2 — Asistente conversacional, Cola de propuestas del agente, watchStock (vigilante de stock), createJobClient (clave secreta, solo informe diario) (+9 more)

### Community 50 - "Mensajes i18n y SEO"
Cohesion: 0.14
Nodes (12): config, withNextIntl, next-intl, Href, loaders, routing, Alternates, AlternatesInput (+4 more)

### Community 51 - "Layout y errores del panel"
Cohesion: 0.17
Nodes (13): PanelLayout(), SECTIONS, CloseButton(), ConfirmOptions, Dialog(), OverlayTone, Sheet(), Toaster() (+5 more)

### Community 52 - "Contenido y configuración de tienda"
Cohesion: 0.21
Nodes (15): SettingsPage(), ContentPage(), ContentEditor(), documentGlobal(), ContentKind, contentLocale, FIELD_LABELS, HomeContent (+7 more)

### Community 53 - "Movimiento de unboxing"
Cohesion: 0.14
Nodes (18): clamp01(), easings, range01(), CameraPose, Ease, EaseName, EASINGS, Framing (+10 more)

### Community 54 - "Estado e informe de Fase 1"
Cohesion: 0.12
Nodes (20): Informe de la Fase 1 — Fundaciones, Resultado por criterio de la Fase 1 (19), Deuda técnica de la Fase 1, Excepciones de la Fase 1 (DECISIONS §83–90), Fase S — Informes y control, Asistente con herramientas de solo lectura, Cabeceras de seguridad y noindex, Secretos y claves (SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY, CRON_SECRET) (+12 more)

### Community 55 - "Seguridad y pruebas pgTAP"
Cohesion: 0.13
Nodes (20): Suites pgTAP 01–07 (263/263), R07 — Validación (pgTAP, concurrencia, E2E), Los cuatro precios (PVP, tachado, coste, mercado), internal.variant_cost_records (solo inserción), Seguridad (SECURITY.md), Aislamiento de costes y proveedores (esquema internal), audit_log y tablas de solo inserción, Avisos del asesor de Supabase (adhara-dev) (+12 more)

### Community 56 - "Reglas de precios y dinero"
Cohesion: 0.17
Nodes (18): Precios (PRICING.md), admin_review_price → admin_apply_price_review, Trigger guard_variant_price, internal.price_change_log (solo inserción), Regla Ómnibus (art. 20 Ley 7/1996), PriceSize, SIZES, BASIS_POINTS (+10 more)

### Community 57 - "Supabase SSR y proxy"
Cohesion: 0.16
Nodes (15): @supabase/ssr, GET(), params, getSupabaseConfig(), schema, SupabaseConfig, refreshSupabaseSession(), refreshSupabaseSessionInto() (+7 more)

### Community 58 - "Contenido editable e i18n"
Cohesion: 0.17
Nodes (15): Editar portada (borrador, vista previa, publicación, historial), Configuración → Datos de la tienda, Módulo content, Módulo i18n, Tabla product_translations, Tabla store_content, requireLocale antes de leer datos (§98), Idiomas (+7 more)

### Community 59 - "Migración ediciones seguras"
Cohesion: 0.10
Nodes (7): audit_media, audit_products, audit_translations, compare_price_guard, cost_variant_lock, private.price_reviews, product_media_one_hero

### Community 60 - "Controles de formulario"
Cohesion: 0.26
Nodes (11): Checkbox(), Radio(), Field(), Input(), SearchField(), Select(), Textarea(), Example() (+3 more)

### Community 61 - "Plantilla de PR y Supabase"
Cohesion: 0.17
Nodes (17): Pull Request Template, PR Data & Infrastructure Section (migrations, env vars, manual actions), PR Validation Section (checks run and not run), /admin panel with two-step verification (catalog, PVP Omnibus, inventory, purchasing, team), Inventory assistant (Vercel Cron daily report + read-only Claude chat), Supabase README, adhara-dev Supabase project (eu-central-1), adhara-prod (planned production project) (+9 more)

### Community 62 - "Cambio masivo de precios"
Cohesion: 0.18
Nodes (14): bulkChangePrices(), BulkRowView, BulkState, paramsInput, readParams(), EXCLUDED, IDLE, PERCENT (+6 more)

### Community 63 - "Migración de inventario"
Cohesion: 0.19
Nodes (10): inventory_levels_location_idx, inventory_movements_actor_idx, inventory_movements_append_only, inventory_movements_location_idx, inventory_movements_variant_idx, public.admin_record_inventory_movement(), public.admin_record_stocktake(), public.inventory_levels (+2 more)

### Community 64 - "Arquitectura Fase 0"
Cohesion: 0.16
Nodes (13): Trigger enforce_product_publication, ADHARA — Fase 0: Discovery, arquitectura y planificación, can_publish(product_id), catalog_raw_items.ingest_status (RAW → MATCHED), Estructura por módulos de dominio (§14), Módulo G · Admin (orquesta, sin reglas propias), Estrategia de rendimiento (LCP, CLS, INP), Protocolo PLAN / IMPLEMENT / VERIFY / REPORT (+5 more)

### Community 65 - "IVA y etiquetas de precio"
Cohesion: 0.20
Nodes (15): IVA general 21 % en puntos básicos, formatEuros(), PriceLabelCard(), PriceLabelValues, centsToInput(), CostPanel(), CostValues, describeMargin() (+7 more)

### Community 66 - "Investigación de producto"
Cohesion: 0.17
Nodes (14): Investigación de producto (borrador), Claims y conflictos (Fase 4), Orígenes de un dato (CATALOG/VERIFIED/EDITORIAL/GENERATED/MANUAL), Prioridad de fuentes (fabricante > distribuidor > tienda > BD), Procedencia simplificada en source_ref (§30), product_media.origin / source / provisional, Roadmap (estado al 02/10/2026), Estado por fase F0–F17 (+6 more)

### Community 67 - "TSConfig del prototipo"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 68 - "Tipos BD y bootstrap"
Cohesion: 0.12
Nodes (13): @supabase/supabase-js, admin, email, CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema (+5 more)

### Community 69 - "Estado de acciones y errores"
Cohesion: 0.21
Nodes (9): Team(), ActionState, IDLE, DbError, MESSAGES, grantInput, setStaffActive(), GrantStaffForm() (+1 more)

### Community 70 - "Acciones de stock UI"
Cohesion: 0.15
Nodes (12): Props, StockActions(), Tab, TITLES, FIELDS, WatchSettingsForm(), savePurchaseOrderLines(), OrderLinesEditor() (+4 more)

### Community 71 - "Plan Fase 2 diseño"
Cohesion: 0.19
Nodes (11): Fase 2 — Sistema de diseño: plan, DS-00 · Aprobar plan y decisiones D1–D6, DS-01 · Red de seguridad (auditoría E2E y axe), DS-02 · Tokens, DS-03 · Página de referencia /admin/diseno, DS-05 · Iconos y marca, Línea base axe y auditoría de diseño (DS-01), Riesgos de la Fase 2 (+3 more)

### Community 72 - "Dependencias de desarrollo"
Cohesion: 0.12
Nodes (16): devDependencies, @axe-core/playwright, eslint, eslint-config-next, @playwright/test, prettier, prettier-plugin-tailwindcss, supabase (+8 more)

### Community 73 - "Scripts de pnpm"
Cohesion: 0.12
Nodes (16): scripts, bootstrap:owner, build, build:local, check, dev, format, format:check (+8 more)

### Community 74 - "Navegación i18n de tienda"
Cohesion: 0.23
Nodes (12): motion, getPathname, Link, redirect, usePathname, useRouter, EASE, Header() (+4 more)

### Community 75 - "Estados de pedido"
Cohesion: 0.22
Nodes (13): availableTransitions(), FulfillmentType, InventoryEffect, ORDER_STATUSES, OrderStatus, planTransition(), Transition, TransitionActor (+5 more)

### Community 76 - "Plan tienda física y reposición"
Cohesion: 0.21
Nodes (11): Fase R — Tienda física y reposición (plan), admin_record_inventory_movement (función SQL), Bloque E01–E07 de Codex, R02 — Proveedores y condiciones por formato, R03 — Pedidos de compra y recepción, R04 — Mostrador (venta en tienda desde tablet), R05 — Reposición: alertas y propuestas, R06 — Parámetros del vigilante (+3 more)

### Community 77 - "Pruebas de compras y mostrador"
Cohesion: 0.22
Nodes (7): pg_temp.line_id(), pg_temp.location_id(), pg_temp.on_hand(), pg_temp.order_id(), pg_temp.order_revision(), pg_temp.order_status(), pg_temp.supplier_id()

### Community 78 - "Dependencias de ejecución"
Cohesion: 0.14
Nodes (14): dependencies, @anthropic-ai/sdk, motion, next, next-intl, react, react-dom, @react-three/drei (+6 more)

### Community 79 - "Prototipo de animación (docs)"
Cohesion: 0.19
Nodes (11): Prototype index.html (Vite entry, noindex, /src/main.tsx), Animation prototype README (pilot step 3a), src/motion/spec.ts (single zod motion spec), src/motion/timeline.ts sample(spec, t), URL params (?p, ?grey, ?templates, ?nowebgl), Shared motion spec S0-S5 (~5 s choreography), ProductPanel (real HTML/RSC, server price, appears on rotated), Timeline events opened / risen / rotated / done (+3 more)

### Community 80 - "Conversaciones con clientes"
Cohesion: 0.30
Nodes (11): canSetStatus(), Channel, CHANNELS, CONVERSATION_STATUSES, ConversationClock, ConversationStatus, isOverdue(), MANUAL (+3 more)

### Community 81 - "Visor unboxing y WebGL"
Cohesion: 0.22
Nodes (8): detectWebGL(), usePrefersReducedMotion(), Phase, findScene(), SceneErrorBoundary, Props, UnboxingLabels, UnboxingViewer()

### Community 82 - "Migración personal y permisos"
Cohesion: 0.25
Nodes (10): audit_log_actor_idx, audit_log_append_only, audit_log_entity_idx, private.has_permission(), private.is_staff(), public.audit_log, public.permissions, public.role_permissions (+2 more)

### Community 83 - "Auditoría de layout"
Cohesion: 0.31
Nodes (11): check(), ROUTES, ROUTES, AUDIT_WIDTHS, auditOutputDir(), auditRoute(), axeBaseline(), AxeSummary (+3 more)

### Community 84 - "Pruebas E2E Playwright"
Cohesion: 0.17
Nodes (3): @playwright/test, PATHS, PATHS

### Community 85 - "Pruebas de integración"
Cohesion: 0.30
Nodes (6): admin, login(), password, totp(), user(), AXE_TAGS

### Community 86 - "CI y criterios Fase 2"
Cohesion: 0.20
Nodes (10): CI en tres workflows (ci.yml, db.yml, e2e.yml), Contraste WCAG 2.2 AA garantizado por prueba, Criterios de finalización de la Fase 2 (13), Habilidades seleccionadas para ADHARA, gh-fix-ci, Graphify, security-best-practices, vercel-deploy (+2 more)

### Community 88 - "Migración informes del asistente"
Cohesion: 0.25
Nodes (5): assistant_usage_append_only, assistant_usage_user_created_idx, daily_reports_generated_by_idx, public.assistant_usage, public.daily_reports

### Community 89 - "Módulos del dominio Fase 0"
Cohesion: 0.29
Nodes (9): available = on_hand − reserved, Módulo C · Catalog (ficha maestra publicada), Módulo B · Commerce, Módulo F · Inventory (único que modifica el stock), Módulo I · Media, Módulo A · Storefront, reserve_stock (reserva atómica en Postgres), Tipos de movimiento de inventario (PURCHASE_RECEIPT, SALE_STORE…) (+1 more)

### Community 90 - "Migración de contenido"
Cohesion: 0.22
Nodes (4): private.store_documents, private.store_revisions, public.store_content, store_revision_immutable

### Community 91 - "Biblioteca de primitivas UI"
Cohesion: 0.53
Nodes (9): Biblioteca de primitivas src/components/ui, DS-04 · Tipografía (Heading, Text, Eyebrow), DS-06 · Acciones (Button, TextLink, SubmitButton), DS-07 · Formularios, DS-08 · Superposiciones y avisos (Dialog, Sheet, Toast), DS-09 · Datos y comercio (Badge, Price, Table…), DS-10 · Migrar la tienda, DS-11 · Migrar el panel (+1 more)

### Community 93 - "Guardia del sistema de diseño"
Cohesion: 0.28
Nodes (5): PERMANENT_COLOR_EXCEPTIONS, PERMANENT_TEXT_SIZE_EXCEPTIONS, FILES, RULES, sourceFiles()

### Community 94 - "Workflow E2E"
Cohesion: 0.36
Nodes (7): E2E Workflow (e2e.yml), Accessibility axe baseline report (axe-report.ts), e2e job (storefront 390x844/1440x900, admin with MFA and roles), Visual audit artifact (auditoria-visual screenshots), Cost sentinel (987654 cents, test-db.sql + cost-leak.spec.ts), internal and private schemas (no API access), internal.variant_cost_records (insert-only costs)

### Community 95 - "Arquetipos de botella"
Cohesion: 0.32
Nodes (8): src/scene/bottles/ (lathe-shoulder, rect-prism, square-glass), Lattafa (brand), Asad (Lattafa), Bottle archetypes (lathe shoulder, rect prism, square fluted glass, sleeved cylinder), Khamrah (Lattafa), Odyssey Mandarin Sky (Armaf, blocked by C-02/C-05), Yara (Lattafa), Versioned idempotent data loads (data/ pilot, CATALOGO 2026, Orient Fragance)

### Community 96 - "Botella torneada (prototipo)"
Cohesion: 0.48
Nodes (6): bodyRadiusAt(), buildLatheShoulder(), fillet(), Lathe, profiles(), skin()

### Community 97 - "Botella torneada unboxing"
Cohesion: 0.48
Nodes (6): bodyRadiusAt(), buildLatheShoulder(), fillet(), Lathe, profiles(), skin()

### Community 98 - "Migración costes de variante"
Cohesion: 0.38
Nodes (4): internal.variant_cost_records, public.admin_variant_costs(), variant_cost_records_append_only, variant_cost_records_variant_idx

### Community 99 - "Prioridades de negocio"
Cohesion: 0.40
Nodes (4): Prioridad de negocio: checkout con TPV (A5/F10) y mensajes (A6.1), Riesgos y preguntas abiertas (§18), Importador de catálogo CSV, Pendiente del usuario

### Community 100 - "Workflow de base de datos"
Cohesion: 0.60
Nodes (5): Database Workflow (db.yml), database job (supabase start, db reset, pgTAP, type/lint/concurrency checks), check-db-lint.ts (supabase db lint with plpgsql_check), Concurrency test counter_and_receipts.sh (24 parallel sessions), pgTAP database tests (263/263 in 8 files)

### Community 105 - "Prueba de concurrencia"
Cohesion: 0.70
Nodes (4): as_staff(), check(), q(), counter_and_receipts.sh script

### Community 107 - "Stack y workspace"
Cohesion: 0.50
Nodes (3): Stack (Node 24.16.0, pnpm 11.19.0, Next.js 16.3.6, React 19.3.0, Supabase, three/R3F), Prototype pnpm workspace (standalone package), Root pnpm workspace (allowBuilds: @parcel/watcher, @swc/core, unrs-resolver)

## Ambiguous Edges - Review These
- `No anticipatory library installs` → `Storefront 3D unboxing scene on product pages (pilot perfumes)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to
- `SUPABASE_SECRET_KEY only for Auth invitations and daily report` → `pnpm bootstrap:owner (uses SUPABASE_SECRET_KEY)`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to
- `pgTAP (263 pruebas en 8 archivos)` → `Evidencia local (211 pgTAP, 199 unitarias, 102 E2E)`  [AMBIGUOUS]
  docs/DELIVERY_REPORT.md · relation: conceptually_related_to
- `Catálogo real con precios PDF como coste interno (§54)` → `Importar el catálogo real «CATALOGO global 2026»`  [AMBIGUOUS]
  docs/DEVELOPMENT.md · relation: conceptually_related_to
- `Informe diario determinista (§77)` → `Fase S (informes y visor de auditoría de A8)`  [AMBIGUOUS]
  docs/PLAN_INFORMES.md · relation: conceptually_related_to
- `Escena 3D de unboxing (4 perfumes del piloto)` → `DS-10 · Migrar la tienda`  [AMBIGUOUS]
  docs/phases/FASE_2_PLAN.md · relation: conceptually_related_to

## Knowledge Gaps
- **540 isolated node(s):** `withNextIntl`, `config`, `name`, `version`, `private` (+535 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 756 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `No anticipatory library installs` and `Storefront 3D unboxing scene on product pages (pilot perfumes)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `SUPABASE_SECRET_KEY only for Auth invitations and daily report` and `pnpm bootstrap:owner (uses SUPABASE_SECRET_KEY)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `pgTAP (263 pruebas en 8 archivos)` and `Evidencia local (211 pgTAP, 199 unitarias, 102 E2E)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Catálogo real con precios PDF como coste interno (§54)` and `Importar el catálogo real «CATALOGO global 2026»`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Informe diario determinista (§77)` and `Fase S (informes y visor de auditoría de A8)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Escena 3D de unboxing (4 perfumes del piloto)` and `DS-10 · Migrar la tienda`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `next` connect `Páginas de catálogo del panel` to `Informes y auditoría`, `Sistema de diseño: contraste y tokens`, `Movimientos de inventario`, `Pedidos de compra (páginas)`, `Acciones servidor catálogo e invitaciones`, `Acciones de compras`, `Importación y paginación de catálogo`, `Asistente e informe diario (UI)`, `Asistente IA y cron`, `Productos de unboxing y borradores`, `Mostrador y tickets`, `Modelo de producto y tienda`, `Servidor de inventario y mostrador`, `Control de acceso del equipo`, `Formularios de catálogo e importación`, `Ficha pública y vista previa`, `Login, contraseña y MFA`, `Catálogo público`, `Configuración raíz del paquete`, `Botón y tipografía UI`, `Etiquetas y alta de producto`, `Marca, fuentes y layout`, `Campos de formulario UI`, `Mensajes i18n y SEO`, `Layout y errores del panel`, `Contenido y configuración de tienda`, `Supabase SSR y proxy`, `Cambio masivo de precios`, `Estado de acciones y errores`, `Navegación i18n de tienda`, `Salida de vista previa`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._