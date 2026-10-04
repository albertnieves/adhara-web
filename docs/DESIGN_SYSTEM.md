# Sistema de diseño

Guía del sistema de diseño de L’Atelier du Désert (Fase 2). Vale para la tienda y el panel. La referencia viva, con los valores que aplica el navegador y todos los estados de cada componente, es `/admin/diseno` (personal con sesión). Las decisiones están en [DECISIONS.md](DECISIONS.md) §91–107 y el cierre en [phases/FASE_2_REPORT.md](phases/FASE_2_REPORT.md).

## 1. Principios

1. **Lujo sobrio.** Mucho aire, una sola familia de acentos (el dorado) y tipografía editorial. Nada compite con el producto.
2. **Accesible por diseño.** WCAG 2.2 AA en todas las combinaciones permitidas, teclado completo, foco visible y objetivos táctiles de 44 px. Lo comprueban pruebas, no la buena voluntad.
3. **Un solo lenguaje.** La tienda y el panel usan las mismas primitivas de `src/components/ui`. Una pantalla no inventa colores, tamaños ni botones.
4. **Semánticos, no colores.** Los componentes piden `text-fg`, `bg-surface` o `border-border`; el tono decide el valor. Así una sección oscura no necesita otra versión del componente.
5. **El movimiento acompaña.** Duraciones y curvas desde tokens y, con «reducir movimiento», ni desplazamientos ni bucles.
6. **La verdad en los datos.** Estados vacíos que dicen «no hay» o «todavía no»; nunca contenido de relleno.

## 2. Tokens

Todos están en `src/app/globals.css` con `@theme static` (Tailwind los publica aunque nadie los use todavía) y su catálogo en `src/modules/design/domain/tokens.ts`. `tests/unit/design-tokens.test.ts` exige que los dos tengan exactamente los mismos tokens.

### 2.1 Color en dos capas

- **Paleta de marca** (`ivory`, `paper`, `sand`, `stage`, `ink`, `ink-soft`, `night`, `night-raised`, `smoke`, `mist`, `line*`, `gold*`, `oud`, `indigo-night`, `forest`): solo define los semánticos. **No se usa en componentes**; la única excepción es `bg-stage`, el fondo de las fotos y de la escena de producto.
- **Semánticos**, los que usan los componentes:

| Token                                         | Uso                                                           |
| --------------------------------------------- | ------------------------------------------------------------- |
| `surface`, `surface-raised`, `surface-sunken` | Fondo de página o sección, tarjetas y campos, bandas hundidas |
| `fg`, `fg-muted`, `fg-inverse`                | Texto principal, secundario y sobre fondo `fg`                |
| `border`, `border-strong`                     | Separadores; bordes de controles (3:1)                        |
| `accent`, `accent-fg`                         | Dorado de acento (líneas, estrella, activo); texto dorado     |
| `focus`                                       | Contorno de foco de 2 px                                      |
| `danger`, `success`, `warning` y su `-soft`   | Estados y su fondo suave                                      |

**Se hace:** `text-fg-muted` para lo secundario, `border-border-strong` en controles, `text-accent-fg` para un texto dorado, `bg-accent/15` para un realce suave.
**No se hace:** `text-smoke`, `bg-ink`, `border-gold` ni colores de Tailwind (`bg-white`, `gray-*`), hexadecimales o `rgb()` en un componente. El dorado (`accent`) nunca es fondo de texto (D4).

### 2.2 Tonos

`data-tone` redefine los semánticos dentro de su contenedor: `dark` (momentos editoriales: portada, pie, menú móvil, menú del panel, banner de vista previa, informe del inicio y resumen del asistente) y los oscuros de colección `oud`, `indigo` y `forest` (D3, para la tienda a partir de la F5). No hay tema oscuro global ni automático (D2).

```tsx
<section data-tone="dark" className="bg-surface text-fg">
  <Eyebrow tone="accent">Asistente</Eyebrow>
  <Button variant="outline">Abrir</Button> {/* ya en claro sobre oscuro */}
</section>
```

### 2.3 Contraste

La matriz permitida está en `matrixPairs()` (`src/modules/design/domain/tokens.ts`) y la prueba la recorre en los cinco tonos:

- texto (`fg`, `fg-muted`, `accent-fg`, `danger`, `success`, `warning`) ≥ 4,5:1 sobre las tres superficies y, en claro, sobre arena y escenario;
- bordes de controles (`border-strong`) y foco ≥ 3:1 sobre los mismos fondos;
- el dorado de acento marca estados solo sobre `surface` y `surface-raised`; sobre arena o escenario es adorno.

Una combinación que no está en la matriz no está permitida. Para añadir una, se añade a la matriz y la prueba dice si cumple.

### 2.4 Tipografía

- **Familias (D1):** Cormorant Garamond (`font-display`, titulares) y Manrope (`font-sans`, todo lo demás), autoalojadas.
- **Escala cerrada:** los tamaños de Tailwind (`text-xs` a `text-5xl`), `text-2xs` (11 px, el mínimo) y `text-display` (titular fluido de la portada). Espaciados `tracking-caps-sm`, `tracking-caps`, `tracking-caps-lg` y `tracking-display`.
- **Componentes:** `Heading` separa el nivel (h1–h4, estructura) del tamaño (`display`, `h1`–`h4`, aspecto); `Text` (cuerpo, pequeño, nota, cifras tabulares); `Eyebrow` (versalitas de 11 px, siempre en Manrope).

**No se hace:** `text-[…]` ni `tracking-[…]` arbitrarios, ni texto de menos de 11 px. Excepción permanente: la etiqueta de estante impresa (`PriceLabelCard`), en pt y mm.

### 2.5 Espacio, retícula, radios y capas

- Contenedor `max-w-page` (80 rem) y ritmo de sección `--section-y`.
- Radios: `0` por defecto y `rounded-hairline` (2 px).
- Capas: `--z-header`, `--z-overlay`, `--z-sheet` y `--z-toast`; nada de `z-[999]`.

### 2.6 Movimiento

- Duraciones `--duration-fast` (200 ms, controles), `--duration-base` (400 ms, paneles) y `--duration-slow` (600 ms, revelados), con la curva `ease-luxe`.
- Bucles decorativos (`animate-twinkle`, `sweep`, `marquee`, `scroll-cue`) solo como adorno.
- Con `prefers-reduced-motion` todo pasa al estado final: lo garantiza la regla global de `globals.css` y lo comprueba el E2E.

## 3. Componentes

Todos se importan de `@/components/ui`. `className` es solo para colocación (márgenes, ancho, rejilla); el aspecto lo deciden las props.

| Componente                                      | Para qué                                                                                                      | Se hace                                                                                                | No se hace                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `Button`, `buttonClass`                         | Acciones. Variantes `primary`, `secondary`, `outline`, `subtle`, `danger`; `sm` (36 px), `md` (44), `lg` (48) | Un solo `primary` por bloque; `buttonClass` en un `Link` o en el `Link` de next-intl; `md` en el panel | `sm` como control principal; botones a mano con `bg-ink`          |
| `SubmitButton`                                  | Envío de formularios con estado de carga (la estrella)                                                        | `pending` propio si la acción no es del formulario                                                     | Deshabilitar a mano mientras se envía                             |
| `TextLink`                                      | Enlaces de texto con subrayado animado                                                                        | Dentro de párrafos y listas                                                                            | Usarlo como botón                                                 |
| `Field`, `Fieldset`                             | Etiqueta, ayuda y error de un control                                                                         | Un único control dentro; el error se anuncia antes que la ayuda                                        | Etiquetas sueltas sin `htmlFor`                                   |
| `Input`, `Textarea`, `Select`, `SearchField`    | Controles de 44 px y 16 px de letra                                                                           | `CONTROL_CLASSES` solo para tipos nativos que no cubren (`file`, `search`)                             | La clase `.input`; para sobrescribir ancho o tamaño, usar `w-24!` |
| `Checkbox`, `Radio`                             | Opciones con la etiqueta entera como objetivo táctil                                                          | `label` con texto visible o `sr-only` en tablas                                                        | `<input type="checkbox">` suelto                                  |
| `Dialog`, `useConfirm`, `Sheet`                 | Superposiciones con foco atrapado, Esc y foco devuelto                                                        | `useConfirm` antes de acciones destructivas; `Sheet` con `tone="dark"` en menús                        | Superposiciones hechas a mano                                     |
| `Toast` (`toast`, `Toaster`)                    | Resultado de una acción en una región viva                                                                    | Los errores se quedan hasta cerrarlos                                                                  | Avisos que solo cambian de color                                  |
| `Badge`, `Tag`                                  | Estados (publicación, existencias, pedido) y etiquetas                                                        | Tono semántico + texto                                                                                 | Solo un punto de color                                            |
| `Price`                                         | PVP en el formato del idioma, «antes» accesible, «desde» y cifras tabulares                                   | Céntimos enteros como entrada                                                                          | Formatear importes a mano                                         |
| `Card`, `cardClass`                             | Superficie elevada con borde; `interactive` si toda la tarjeta es un enlace                                   | `cardClass` en enlaces, formularios y `fieldset`; `padding` (`none`–`lg`)                              | La clase `.panel-card`                                            |
| `Table`, `Th`, `Td`                             | Tablas con leyenda; en el móvil, fichas apiladas (`stacked`)                                                  | `caption` siempre; `stacked={false}` con desplazamiento horizontal en tablas anchas                    | `<table className="data-table">` suelto                           |
| `EmptyState`, `Skeleton`                        | Vacíos honestos y huecos de carga                                                                             | Una acción siguiente si la hay; anunciar la carga una vez (`role="status"`)                            | Datos de relleno                                                  |
| `Heading`, `Text`, `Eyebrow`                    | Tipografía (§2.4)                                                                                             | `Eyebrow as="dt"` o `as="legend"` en listas y grupos                                                   | La clase `.eyebrow`                                               |
| `Icon`, `StarList`, `StarDivider`, `StarLoader` | Iconos propios de trazo fino (D5) y la estrella del emblema                                                   | Decorativos por defecto; `label` si el icono es lo único que nombra la acción                          | Librerías de iconos                                               |
| `Logo` (`@/modules/brand`)                      | Emblema y nombre, con tamaño mínimo garantizado                                                               | Fondos permitidos de la sección «Marca» de `/admin/diseno`                                             | Deformarlo o recolorearlo                                         |

## 4. Accesibilidad

- Teclado: Tab en orden visual, Intro y Espacio activan, Esc cierra y devuelve el foco (E2E sobre `/admin/diseno`).
- Foco: contorno global de 2 px en `focus`, ≥ 3:1.
- Objetivos: ≥ 44 px de alto en el panel y en los controles principales de la tienda; ≥ 24 × 24 px en todo.
- axe (WCAG 2.2 AA) sin infracciones en la página de referencia, las rutas públicas en es, ca y en y todas las pantallas del panel, sin excluir nada (tampoco el `<canvas>` de la escena 3D).

## 5. Guardas y pruebas

| Qué                                                                          | Dónde                                                                                                    |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Sin hexadecimales, `rgb()` ni colores de Tailwind                            | `tests/unit/design-guard.test.ts` (excepciones exactas en `design-guard-exceptions.ts`)                  |
| Sin colores de paleta fuera de los tokens (salvo `stage`)                    | `tests/unit/design-guard.test.ts`                                                                        |
| Sin `.btn`, `.panel-btn`, `.input`, `.panel-card`, `.field` ni `.eyebrow`    | `tests/unit/design-guard.test.ts`                                                                        |
| Escala tipográfica cerrada                                                   | `tests/unit/design-guard.test.ts` y la auditoría E2E (11 px)                                             |
| Contraste AA en cinco tonos                                                  | `tests/unit/design-tokens.test.ts`                                                                       |
| Componentes                                                                  | `tests/unit/{typography,icons,button,forms,overlays,data}.test.*`                                        |
| Maquetación (solapes, desbordes, objetivos) a 390, 768, 1280 y 1440 px y axe | `tests/e2e/layout-audit.spec.ts` (tienda) y `tests/integration/layout-audit.spec.ts` (panel, con sesión) |
| Teclado y movimiento reducido                                                | `tests/integration/design-reference.spec.ts`                                                             |

## 6. Cómo añadir algo

1. ¿Lo cubre una primitiva? Úsala con sus props. ¿Le falta una variante? Se añade a la primitiva, con su estado en `/admin/diseno` y su prueba, no en la pantalla.
2. ¿Hace falta un color nuevo? Se añade a la paleta y se expone con un semántico; el catálogo de `tokens.ts` y la matriz de contraste se actualizan en el mismo cambio.
3. Una excepción a una guarda solo entra con motivo escrito en `design-guard-exceptions.ts` y en DECISIONS.
