# Informe de la Fase 2 — Sistema de diseño

Cierre técnico del 04/10/2026, a petición del usuario («cerremos la última fase pendiente»). Plan: [FASE_2_PLAN.md](FASE_2_PLAN.md). La fase se desarrolló entre el 02/10 y el 04/10 en las PR #13 a #25 (DS-00 a DS-10) y en la PR de este cierre (DS-11 y DS-12). Decisiones en [DECISIONS.md](../DECISIONS.md) §91–107; guía en [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md).

**Estado: 12 de 13 criterios cumplidos con evidencia. Falta el criterio 13, la revisión visual del usuario en la Preview, que solo puede dar el usuario. La fase queda cerrada cuando la apruebe por escrito en la PR de cierre.**

## Resultado por criterio (plan §4)

| #   | Criterio                                                                                           | Estado                                                | Evidencia                                                                                                                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sin colores fuera de los tokens (salvo la escena 3D)                                               | Cumplido                                              | `design-guard.test.ts`: sin hexadecimales, `rgb()` ni colores de Tailwind (una excepción permanente: el fondo de `ProductStage`, que three.js no lee de CSS) y, desde DS-11, sin colores de la paleta fuera de los tokens salvo `stage`                                                                 |
| 2   | Contraste AA en todas las combinaciones permitidas, en claro y oscuros                             | Cumplido                                              | `design-tokens.test.ts` recorre la matriz de `tokens.ts` en los cinco tonos; `/admin/diseno` la recalcula en el navegador (todas cumplen)                                                                                                                                                               |
| 3   | Escala tipográfica cerrada y nada por debajo de 11 px                                              | Cumplido                                              | `design-guard.test.ts` (sin `text-[…]` ni `tracking-[…]`; excepción permanente de la etiqueta impresa en pt) y la auditoría E2E, que bloquea cualquier texto visible de menos de 11 px                                                                                                                  |
| 4   | Primitivas de §6 con variantes y estados; sin `.btn`, `.panel-btn`, `.input` ni `.panel-card`      | Cumplido                                              | `src/components/ui` con todas las primitivas y su sección en `/admin/diseno`; `design-guard.test.ts` falla si una de esas clases (o `.field` y `.eyebrow`) aparece en un `className` o se define en `globals.css`                                                                                       |
| 5   | Teclado: Tab en orden, foco ≥ 2 px y ≥ 3:1, Esc cierra y devuelve el foco, Intro y Espacio activan | Cumplido                                              | `tests/integration/design-reference.spec.ts` (acciones, formularios y superposiciones) y la matriz de foco de `design-tokens.test.ts`                                                                                                                                                                   |
| 6   | axe sin infracciones WCAG 2.2 AA en la referencia, la tienda (es, ca, en) y el panel               | Cumplido                                              | Desde DS-11 axe bloquea: `tests/e2e/layout-audit.spec.ts` (inicio, colección, ficha y 404 en los tres idiomas) y `tests/integration/layout-audit.spec.ts` (las 24 pantallas del panel, incluida `/admin/diseno`), sin excluir nada. La prueba encontró y se corrigió un contraste de 3,85:1 en la ficha |
| 7   | Sin solapes, texto fuera de su caja ni desplazamiento horizontal a 390, 768, 1280 y 1440 px        | Cumplido                                              | Las dos auditorías de maquetación, en tienda y panel, a los cuatro anchos                                                                                                                                                                                                                               |
| 8   | Objetivos ≥ 44 px en el panel y controles principales de la tienda; ≥ 24 px en todo                | Cumplido                                              | La auditoría del panel bloquea controles de menos de 44 px desde DS-11 (salvo la demostración del tamaño `sm` en la referencia); en la tienda bloquea < 24 px; los formatos, el buscador y el orden miden 44 px, y los filtros de la colección van en `sm` (36 px), dentro de WCAG 2.5.8 (ver «Deuda»)  |
| 9   | Duraciones y curvas desde tokens; con «reducir movimiento», sin desplazamientos ni bucles          | Cumplido                                              | `--duration-*` y `ease-luxe`; regla global de `prefers-reduced-motion`; E2E de la referencia con la preferencia emulada; las auditorías miden con movimiento reducido                                                                                                                                   |
| 10  | Guía `docs/DESIGN_SYSTEM.md` y decisiones                                                          | Cumplido                                              | [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) y DECISIONS §91–107                                                                                                                                                                                                                                             |
| 11  | `ci.yml`, `db.yml` y `e2e.yml` en verde en cada PR de la fase                                      | Cumplido en DS-00–DS-10; pendiente en la PR de cierre | PR #13 a #25 fusionadas con los tres workflows. Para la PR de cierre, ver «Comprobaciones» abajo; la CI se ejecuta al abrirla                                                                                                                                                                           |
| 12  | Sin dependencias nuevas de producción; solo `@axe-core/playwright` de desarrollo, exacta           | Cumplido                                              | `package.json`: `@axe-core/playwright` 4.13.0 en `devDependencies`; ninguna dependencia de producción nueva en la fase                                                                                                                                                                                  |
| 13  | Revisión visual aprobada por el usuario en la Preview                                              | **Pendiente del usuario**                             | Revisar en la Preview de la PR de cierre `/admin/diseno` (tonos, incluidos los de colección de D3) y las capturas del artefacto `auditoria-visual` de `e2e.yml`, y aprobar por escrito en la PR                                                                                                         |

## Comprobaciones de la PR de cierre (04/10, en local)

Con Supabase local (Postgres 17, las 17 migraciones) y los datos de `tests/fixtures/test-db.sql`, como en `e2e.yml`:

| Comprobación                        | Resultado                                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, tipos y formato               | Correctos (`pnpm check`, `prettier --check`)                                                                                                         |
| Unitarias (Vitest)                  | 292/292 en 36 archivos, con las dos guardas nuevas                                                                                                   |
| Build de producción (webpack)       | Correcto                                                                                                                                             |
| Escaneo de secretos                 | Sin secretos en los archivos versionados                                                                                                             |
| Panel con sesión (`test:e2e:local`) | 14/14: recorridos autenticados, teclado de la referencia y auditoría de las 24 pantallas a 390, 768, 1280 y 1440 px con 44 px y axe sin infracciones |
| Tienda pública (`test:e2e`)         | 151 correctas y 11 omitidas a propósito (la auditoría solo corre en el proyecto de escritorio), con el coste centinela y axe sin infracciones        |

Sin cambios de SQL en esta PR: `db.yml` (pgTAP y tipos) no cambia. Diferencias con la CI: en el contenedor había Node 22.22 (el repositorio fija 24.16) y Playwright usó el Chromium preinstalado con una configuración temporal no versionada.

## Qué deja la fase

- **Tokens en dos capas** (paleta y semánticos) con cinco tonos y escalas cerradas de tipografía, espacio, radios, capas y movimiento.
- **Biblioteca común** en `src/components/ui`: `Heading`, `Text`, `Eyebrow`, `Icon`, motivos de la estrella, `Button`/`buttonClass`, `TextLink`, `SubmitButton`, `Field`, `Fieldset`, `Input`, `Textarea`, `Select`, `SearchField`, `Checkbox`, `Radio`, `Dialog`, `useConfirm`, `Sheet`, `Toast`, `Badge`, `Tag`, `Price`, `Card`/`cardClass`, `Table`, `EmptyState` y `Skeleton`.
- **Página de referencia** `/admin/diseno` con los valores leídos del navegador y el contraste calculado.
- **Tienda y panel migrados** sin clases sueltas ni colores de paleta.
- **Red de pruebas:** guardas unitarias, contraste, auditoría de maquetación a cuatro anchos, objetivos táctiles y axe bloqueante en tienda y panel.

## Cambios visibles al migrar el panel (DS-11)

- Filtros, enlaces del menú lateral, accesos del pie del menú, pestañas de idioma y de acciones de stock pasan a 44 px de alto.
- Los desplegables del panel llevan el chevron del sistema; las casillas, la caja dibujada de 24 px.
- Las tarjetas que son enlace marcan el borde al pasar el ratón.
- El porcentaje de margen negativo se lee en rojo pleno.

## Deuda y límites

- **Criterio 13** pendiente del usuario (arriba).
- **D3:** los tonos de colección solo cambian la superficie; se decide al revisarlos, antes de usarlos en la F5.
- **Tienda:** la auditoría pública solo bloquea por debajo de 24 px. Los filtros de la colección, «Limpiar filtros» y «Salir» del banner de vista previa van en `sm` (36 px): cumplen WCAG 2.5.8 (24 px) pero no los 44 px. Si en la revisión visual se consideran controles principales, pasan a `md` en una línea cada uno.
- **Escena 3D** (`modules/unboxing`) fuera de las guardas, como dice el plan.
- `cx` no resuelve conflictos de Tailwind: para sobrescribir lo que fija un control se usa `!` (DECISIONS §106).

## Siguiente fase

Por prioridad de negocio (DECISIONS §82): **checkout con pago con tarjeta (F10/A5)**, que espera los datos del TPV virtual y el proveedor de correo, y después la puesta en producción (F17). Lo que hace falta del usuario está en [STATUS.md](../STATUS.md), «Pendiente del usuario».
