# ADHARA — Piloto: escenas de movimiento (unboxing 3D) · PLAN

Estado: **Enfoque C APROBADO** (28/09/2026) · paso 4 (artes planos) en curso con Nano Banana Pro · ver §9 Registro
Base: `docs/PILOTO_5_PERFUMES.md` (concepto de animación aprobado el 28/09/2026), Fase 0 rev. 2 §8 y §12, ADR-014.

**Objetivo:** convertir el research visual de los 5 perfumes en una escena animada reproducible:

1. la caja se abre;
2. el frasco sale;
3. el frasco gira 360°;
4. se despliega el panel con descripción, precio y compra.

El flujo debe poder aplicarse después a todo el catálogo y encajar sin rehacer nada en las fases 7 (Media) y 8 (3D).

---

## 1. Decisión de enfoque (la más importante)

Hay tres formas de producir la escena. Recomiendo la **C**.

|                                   | A. Vídeo generado con IA (imagen → vídeo)                                                                  | B. 3D modelado a mano por un artista | **C. Escena 3D paramétrica + coreografía en código**                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| Fidelidad del frontal             | **Baja**: al girar, la IA deforma logotipos y la caligrafía árabe (أسد, خمرة, يارا) de un fotograma a otro | Alta                                 | **Alta**: la etiqueta es una textura aprobada, no se reinventa en cada fotograma |
| Coherencia entre productos        | Cada vídeo sale con cámara, luz y ritmo distintos                                                          | Depende del artista                  | **Idéntica**: una sola coreografía y N productos                                 |
| Panel HTML sincronizado           | Solo superpuesto a un vídeo fijo                                                                           | Sí                                   | Sí, con eventos de la línea de tiempo                                            |
| Interacción (girar con el dedo)   | No                                                                                                         | Sí                                   | Sí                                                                               |
| Peso en la PDP                    | 3–10 MB de vídeo por producto                                                                              | 1–3 MB GLB                           | **0,3–1,5 MB** (geometría simple + texturas KTX2)                                |
| Coste marginal por producto nuevo | Regenerar e iterar (créditos)                                                                              | Horas de artista                     | Medidas + texturas; la escena ya existe                                          |
| Traducible ES/CA/EN               | No, si hay texto en el vídeo                                                                               | Sí                                   | Sí                                                                               |
| Cumple §8 y §12 de la Fase 0      | Parcialmente (peso, LCP)                                                                                   | Sí                                   | Sí                                                                               |

**Conclusión:** la IA generativa **no produce la animación**. Produce los **materiales** de la escena (vistas limpias, artes planos de la caja y de la etiqueta) y, opcionalmente, un **previz** para validar el ritmo antes de programarlo. El movimiento se define una sola vez en código y se reutiliza en todos los productos.

**Insight clave:** la coreografía es común. Lo único que cambia entre productos es:

- la geometría del frasco;
- las texturas;
- las medidas de la caja.

Por eso **se aprueba el movimiento una vez**, con un producto, y el resto de productos solo pasan la revisión de fidelidad.

---

## 2. Arquitectura de la escena

```
UnboxingScene (R3F, client-only, carga bajo demanda)
├─ <Box>           procedural: BoxGeometry con medidas reales + 6 texturas de caras
│   └─ <Flap>      solapa superior con bisagra (grupo pivotado), textura de la tapa
├─ <Bottle>        GLB por producto (o LatheGeometry paramétrica) + materiales PBR
│   ├─ body        material del cuerpo (mate, satinado, vidrio con transmission)
│   ├─ decals      etiqueta/medallón frontal = textura aprobada (fidelidad)
│   └─ cap         tapón (pieza separada para brillos y metales)
├─ <Stage>         luz de estudio común + Environment HDRI ligero + ContactShadows
└─ Timeline        motion spec (JSON) → emite eventos: opened, risen, rotated, done
        ▼
<ProductPanel>     HTML real (RSC), precio del servidor; aparece con el evento `rotated`
```

### Motion spec compartido (propuesta de coreografía, ~5 s)

| Escena        | Duración | Qué pasa                                                                                        | Curva             |
| ------------- | -------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| S0 · Reposo   | —        | Caja cerrada, 3/4 frontal. **Idéntico al poster** (sin salto visual al cargar)                  | —                 |
| S1 · Apertura | 0,9 s    | La solapa gira −115° sobre la bisagra trasera                                                   | ease-out suave    |
| S2 · Ascenso  | 1,2 s    | El frasco sube desde el interior; la caja desciende y se desvanece                              | ease-in-out       |
| S3 · Giro     | 2,4 s    | El frasco rota 360° y **termina de frente** (cara verificada)                                   | ease-in-out lento |
| S4 · Panel    | 0,6 s    | La cámara desplaza el frasco (a la izquierda en desktop, arriba en móvil) y entra el panel HTML | ease-out          |
| S5 · Libre    | —        | Giro manual limitado (OrbitControls sin pan, zoom acotado) + botón «Repetir»                    | —                 |

**Reglas:**

- Se puede saltar en cualquier momento.
- Con `prefers-reduced-motion` va directo al estado final (frasco de frente + panel), sin animación.
- Si no hay WebGL o falla la carga: poster + panel normal. **La compra nunca depende del 3D.**

Los tiempos son una propuesta: se ajustan una vez en el previz o prototipo (§4, paso 3).

---

## 3. Arquetipos de frasco (qué geometría necesita cada uno)

| Producto                     | Arquetipo                                      | Cómo se construye                                                                                                 | Dificultad                                | Bloqueos                                                                  |
| ---------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| **Asad**                     | Cilindro + hombro redondeado                   | `LatheGeometry` desde un perfil con medidas reales; bandas en X y medallón como decal + ligera extrusión          | Baja                                      | C-04 (concentración, no bloquea el 3D)                                    |
| **Yara**                     | **Mismo modelo que Asad** con otros materiales | Reutiliza el perfil de Asad → solo materiales y texturas nuevos                                                   | Muy baja                                  | Confirmar medidas iguales; C-01 no afecta al 3D                           |
| **Club de Nuit Intense Man** | Prisma rectangular + cadena y medallón         | Caja biselada + tapón con tornillos; la cadena, como malla simple o instancias                                    | Media                                     | **C-03**: confirmar qué edición suministra el distribuidor                |
| **Khamrah**                  | Vidrio cuadrado estriado + líquido             | Prisma + **normal map** de espiga + `MeshPhysicalMaterial` (transmission, IOR ~1,5) + volumen interior de líquido | **Alta** (el límite de calidad del visor) | Rendimiento de transmission en móvil: hay que medirlo                     |
| **Odyssey Mandarin Sky**     | Cilindro con funda + tapón con asa             | Lathe + funda texturizada (cuero, pespunte) + asa extruida                                                        | Media                                     | **C-02** (edición) y **C-05** (no está en el catálogo): lo dejo el último |

**Orden recomendado:** Asad → Yara (valida el camino completo con el mínimo riesgo y demuestra la reutilización) → Khamrah (valida el techo técnico) → CDN → Mandarin Sky.

---

## 4. Flujo de producción por producto

Cada paso deja un registro con un estado. Ningún paso publica nada.

| #   | Paso                                                 | Entrada                               | Salida                                                                                                                                                                                                     | Herramienta                               | Quién aprueba                  |
| --- | ---------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------ |
| 0   | **Prerrequisitos**                                   | Research del piloto                   | Conflictos que afectan al aspecto resueltos (C-02, C-03)                                                                                                                                                   | —                                         | Tú                             |
| 1   | **Kit de tienda**                                    | Botella y estuche reales              | 6 fotos del frasco, fotos de las 6 caras de la caja, medidas en mm (frasco: alto, alto del tapón, ancho, fondo; **caja: alto, ancho, fondo**)                                                              | Móvil + calibre                           | —                              |
| 2   | **Scene brief**                                      | Visual brief del piloto + kit         | JSON: medidas, arquetipo, materiales (color, rugosidad, metalicidad), tipo de apertura, textos que deben aparecer literalmente                                                                             | Yo lo redacto                             | Tú                             |
| 3   | **Previz de coreografía** _(una sola vez, con Asad)_ | Motion spec                           | Vídeo corto de ritmo y encuadre para aprobar el «feel». Dos opciones: (a) prototipo R3F con cajas grises, **recomendado** porque es el mismo código final; (b) vídeo IA orientativo, que **no se publica** | Código / Weave                            | Tú                             |
| 4   | **Artes planos**                                     | Referencias oficiales + fotos del kit | Frontal del frasco ortográfico limpio, 6 caras de la caja en plano, tapa. Imagen → imagen con la referencia como entrada                                                                                   | Weave (tras vincularlo)                   | **Revisión de fidelidad** (§5) |
| 5   | **Texto y logotipos**                                | Arte plano aprobado                   | Los textos críticos (أسد, ASAD, Lattafa, KHAMRAH…) se **verifican letra por letra**. Si la IA los deforma, se rehace esa zona como vector (SVG → textura)                                                  | Revisión + SVG                            | Tú                             |
| 6   | **Modelo**                                           | Medidas + arquetipo                   | GLB del frasco (geometría paramétrica generada por script, versionada en el repo) + caja procedural (sin GLB)                                                                                              | `scripts/media/` (three + gltf-transform) | —                              |
| 7   | **Optimización**                                     | GLB + texturas                        | KTX2, meshopt, dedupe; presupuesto ≤ 2,5 MB y ≤ 50k triángulos                                                                                                                                             | `gltf-transform`                          | Check automático               |
| 8   | **Montaje**                                          | GLB + texturas + motion spec          | Escena reproducible en una página sandbox interna                                                                                                                                                          | R3F                                       | —                              |
| 9   | **Posters**                                          | Escena montada                        | Frame S0 (poster de carga) y frame final (fallback sin 3D / reduced motion), **renderizados desde la misma escena** para que coincidan                                                                     | Render offscreen                          | —                              |
| 10  | **QA**                                               | Todo lo anterior                      | Checklist §5 superado                                                                                                                                                                                      | —                                         | Tú: aprobación final           |

**Tiempo estimado por producto** una vez montado el camino (tras Asad): kit en tienda 10 min, artes planos + revisión 30–60 min, modelo + montaje 1–2 h. Khamrah, más.

---

## 5. Checklist de fidelidad y calidad (bloqueante)

**Fidelidad:**

- [ ] Silueta y proporciones dentro de ±3 % de las medidas reales.
- [ ] Frontal: logotipo, caligrafía árabe y textos latinos **idénticos** a la referencia oficial (no «parecidos»).
- [ ] Colores y acabados coherentes con las fotos del kit, no solo con el render oficial.
- [ ] Ningún elemento añadido (flores, ingredientes, reflejos inventados).
- [ ] Trasera, laterales e interior de la caja marcados como `GENERATED`, según la regla aprobada.
- [ ] Sin marcas de agua de terceros en ninguna textura.

**Técnica:**

- [ ] GLB y texturas dentro del presupuesto.
- [ ] 60 fps en un móvil medio de gama (se mide en un dispositivo real); 30 fps como mínimo aceptable para Khamrah.
- [ ] El poster S0 y el primer frame 3D coinciden (sin salto).
- [ ] Con reduced motion, sin WebGL y con error de carga, el panel y la compra funcionan.
- [ ] El giro termina exactamente de frente.

---

## 6. Integración con la plataforma (qué se añade al modelo de la Fase 0)

Encaja en el diseño existente con cambios mínimos, que se aplicarán en su fase (F7/F8), no ahora:

- **`product_3d_assets`** (ya existe): añadir `scene_type` (`turntable` | `unboxing`), `box_dimensions_mm` jsonb, `bottle_archetype` y `motion_preset` (clave de la coreografía compartida; **no** una coreografía por producto).
- **`product_media.role`**: añadir `box_face_front`, `box_face_back`, `box_face_side`, `box_face_top`, `bottle_label`, `poster_start`, `poster_end`. Así los artes planos se reemplazan sin tocar el producto, como exige el brief.
- **`visual_briefs`**: el scene brief es una nueva versión del brief (`brief.scene`), sin tabla nueva.
- **Código:** `src/modules/product-experience/viewer-3d/` pasa a contener:
  - `unboxing/`: `UnboxingScene`, `Box`, `Bottle`, `Stage`;
  - `motion/`: el motion spec tipado con zod;
  - `presets/`.

  Sigue siendo el **único** lugar con three/R3F y se carga con `next/dynamic`.

- **Scripts:** `scripts/media/build-bottle.ts` (perfil + medidas → GLB), `scripts/media/check-budget.ts` y `scripts/media/render-posters.ts`.
- **Assets generados:** `origin = ai_generated`, `status = draft` en `product-media-drafts`, y promoción a `product-media` solo tras la aprobación. Es el flujo ya definido en la Fase 0 §8.

---

## 7. Encaje en el roadmap (a tener en cuenta)

Esto corresponde a las **Fases 7 y 8**, y la **Fase 1 (Fundaciones) aún no está implementada**: no hay repositorio ni base de datos. Propongo tratarlo como **piloto aislado**:

- los assets y el código viven en `pilot/` (o en una rama propia);
- no dependen de Supabase;
- se migran a su sitio definitivo cuando lleguen F7/F8.

Así no se adelanta ninguna fase ni se construye sobre una base que todavía no existe.

---

## 8. Lo que necesito de ti antes de empezar

1. **Aprobar el enfoque C** (escena 3D paramétrica + coreografía en código; IA solo para artes planos y previz). La alternativa es vídeo IA como producto final, que desaconsejo por la fidelidad del texto árabe.
2. **Vincular Weave** en https://app.weavy.ai/settings?section=profile (sigue sin estar vinculado a tu cuenta de Figma). Sin esto, el paso 4 no puede generarse desde aquí.
3. **Kit de tienda de Asad y Yara** (§4, paso 1), incluidas **las medidas de la caja**, que el piloto no pedía y la animación sí necesita.
4. **Modelos 3D:** ¿los genero yo por script (suficiente para Asad, Yara y CDN; Khamrah es el reto) o prefieres un artista 3D externo para alguno?
5. **Confirmar el orden:** Asad → Yara → Khamrah → CDN → Mandarin Sky.

**Primer entregable propuesto tras la aprobación:** prototipo de la coreografía con geometría gris (paso 3a) + scene brief de Asad. No requiere Weave ni el kit, así que puede empezar ya.

---

## 9. Registro de ejecución

**Operativa Weave (28/09/2026):** el plan gratuito de Weave no permite lanzar modelos vía MCP. La generación se hace **manualmente en app.weavy.ai**:

- flujo: nodo Import (referencia) → entrada verde del modelo; nodo Prompt → entrada rosa;
- modelo: Nano Banana Pro (~11 créditos/imagen);
- se descarga el ZIP y se revisa aquí.

Créditos iniciales: 150.

| Fecha      | Producto | Asset                                                                 | Modelo          | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Estado                                          |
| ---------- | -------- | --------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 28/09/2026 | Asad     | Frontal del frasco (`asad_bottle-front_nbpro_v1_DRAFT.png`, 896×1200) | Nano Banana Pro | **Pasa la fidelidad de texto**: «أسد», «ASAD» y «Lattafa» idénticos a la referencia. Bandas en X, medallión del león y aros dorados correctos. Fondo blanco puro. Proporción ancho/alto 0,435 frente a 0,42 de la referencia (≈3 %, en el límite). **Pendiente:** (a) la vista está ligeramente picada, no es ortográfica pura (la base se ve curva), aceptable como packshot y a corregir para textura; (b) detalle fino del león sin verificar frente a foto real del kit | `GENERATED` · draft, pendiente de tu aprobación |

**Conclusión provisional:** Nano Banana Pro conserva el texto árabe y latino. El camino «IA para artes planos» es viable y no hace falta rehacer la etiqueta en vector para Asad.
| 28/09/2026 | Yara | Frontal del frasco (`yara_bottle-front_nb_v1_DRAFT.png`, 1024×1024) | Nano Banana (2.5 Flash) | «يارا», «YARA» y «Lattafa» correctos. Vista más frontal que Asad. **Proporción del cuerpo idéntica a Asad (0,358 ancho/alto)**, lo que apoya la geometría compartida (falta confirmarlo midiendo). **Problemas:** (a) el anillo del medallión lleva un texto ilegible que probablemente es inventado, pendiente de comparar con la referencia; (b) el fondo es gris claro (#F5F5F5), no blanco puro, corregible en postproceso | `GENERATED` · draft, en revisión |
| 28/09/2026 | Khamrah | Frontal del frasco (`khamrah_bottle-front_nb_v1_REJECTED.png`, 1024×1024) | Nano Banana (2.5 Flash) | Placa correcta: «خمرة», «KHAMRAH» y «Lattafa» bien. **Rechazado por el vidrio:** (a) estrías irregulares y deformadas, sin patrón de espiga constante; (b) el líquido tiene un contorno ondulado imposible, que no llena el frasco; (c) dentro del tapón se ve la bomba del spray, que la referencia muestra como un bloque sólido (pendiente de confirmar); (d) fondo gris #F5F5F5. La placa se puede aprovechar como textura. Siguiente intento: Nano Banana Pro | `GENERATED` · rechazado |
| 28/09/2026 | Khamrah | Botella en 3/4 (`khamrah_bottle-34_nbpro_v2_DRAFT.png`, 1024×1024) | Nano Banana Pro | **Mucho mejor que v1:** estrías diagonales regulares en espiga, líquido ámbar que llena el cuerpo, tapón macizo sin bomba visible, placa correcta («خمرة», «KHAMRAH», «Lattafa»). **Pero no es frontal:** ignora «straight front view» y saca una vista 3/4, seguramente porque la referencia también es 3/4. Fondo gris #F5F5F5 (igual que la referencia). Sirve como packshot 3/4, no como textura frontal | `GENERATED` · draft |

**Decisión C-03 (28/09/2026):** se trabaja con **CLUB DE NUIT INTENSE MAN LIMITED EDITION** (PDF p. 24, 60 €).

- Referencia N1: https://armaf.com/products/club-de-nuit-intense-man-limited-edition
  - imagen de la botella: https://armaf.com/cdn/shop/files/Untitleddesign_74_9303a701-fe01-492b-9199-2338cf103b6d.png
- N1 la describe como **Eau de Parfum**, 3,6 oz (≈105 ml), estuche regalo con gemelos. ⚠ Nueva discrepancia: varios retailers N3 (intenseoud, jomashop) la venden como «Pure Parfum». Hay que verificarlo en el envase.
  | 28/09/2026 | CDN Intense Man LE | Frontal (`cdn-le_bottle-front_nbpro_v1_REJECTED.png`, 800×1328) | Nano Banana Pro | **Rechazado por encuadre:** el frasco sale recortado por los lados y por abajo, sin margen. Lo demás es fiel: cuerpo gris grafito/gunmetal; tapón cuadrado con cristales en las esquinas; cadena con medallión «ARMAF» y un cristal; textos «Limited Edition» (rojo), «Parfum» y «club de nuit intense man»; «club de nuit» en relieve en el lateral. **Hallazgo:** el envase dice «Parfum», lo que apoya a los retailers (N3) frente a la ficha de Armaf (N1: EDP). La discrepancia sigue abierta hasta verlo en el envase físico. Nota: el ZIP incluía además un duplicado de Khamrah v2 (mismo md5), descartado | `GENERATED` · rechazado |
  | 28/09/2026 | CDN Intense Man LE | Frontal (`cdn-le_bottle-front_nbpro_v2_DRAFT.png`, 896×1200) | Nano Banana Pro | **Válido.** Frasco completo con margen, fondo blanco puro y 3:4. Textos correctos: «Limited Edition», «Parfum», «club de nuit intense man», «ARMAF». Tapón con cristales, cadena y medallión fieles. Detalle menor: se ve un poco el lateral izquierdo (relieve «club de nuit»), así que no es ortográfica pura. Sin impacto en el 3D: la geometría es un prisma y la etiqueta se toma de la cara frontal. El ZIP traía las salidas anteriores (Khamrah v2 y CDN v1, mismo md5), descartadas | `GENERATED` · draft, pendiente de tu aprobación |
  | 28/09/2026 | Odyssey Mandarin Sky | Frontal (`mandarin-sky_bottle-front_nbpro_v1_DRAFT.png`, 896×1200) | Nano Banana Pro | Encuadre completo con margen, fondo blanco y 3:4. Forma, colores, funda con pespunte negro, tira con pasador y tapón naranja con asa fieles. «ODYSSEY», «EAU DE PARFUM» y «LIMITED EDITION» legibles. **Falla el texto script: la palabra «Mandarinsky» sale deformada.** Como el grabado es tono sobre tono, en el 3D se rehace en vector (paso 5). ⚠ Lleva «LIMITED EDITION» (C-02) y el producto no está en el catálogo del distribuidor (C-05). El ZIP volvió a traer salidas antiguas, descartadas | `GENERATED` · draft con texto a rehacer |

### Cierre de las pruebas de artes planos (28/09/2026)

| Producto             | Mejor resultado  | Texto                | Uso previsto                                                   |
| -------------------- | ---------------- | -------------------- | -------------------------------------------------------------- |
| Asad                 | Pro v1 frontal   | ✔                    | Packshot + textura frontal                                     |
| Yara                 | Flash v1 frontal | ✔ (medallión dudoso) | Packshot; el medallión se revisa con la foto real              |
| Khamrah              | Pro v2 en 3/4    | ✔ placa              | Packshot 3/4; el vidrio se hace en código (normal map)         |
| CDN Intense Man LE   | Pro v2 frontal   | ✔                    | Packshot + textura frontal                                     |
| Odyssey Mandarin Sky | Pro v1 frontal   | ✖ script             | Packshot solo tras rehacer el texto; bloqueado por C-02 y C-05 |

**Conclusiones:**

- **Nano Banana Pro** es el modelo por defecto: conserva árabe, latino y detalle. Flash solo sirve para borradores.
- **Encuadre:** pedir siempre «ZOOMED OUT… nothing cropped» y proporción 3:4 vertical. Si la referencia está en 3/4, el modelo tiende a copiar ese ángulo.
- **Texto script o decorativo pequeño:** hay que prever rehacerlo en vector.
- **Operativa de Weave:** desconectar los nodos antiguos antes de ejecutar, porque el ZIP exporta todas las salidas del lienzo.
- **Siguiente fase:** prototipo visual de la coreografía (§4, paso 3a).

### Prototipo de coreografía · paso 3a (28/09/2026)

Proyecto aislado en `pilot/animation-prototype/` (Vite 8.3.1 + React 19.3.0 + three 0.186.1 + @react-three/fiber 9.8.1 + @react-three/drei 10.7.9 + zod 4.6.5, con lockfile propio). La app no instala nada: la raíz solo excluye la carpeta de `tsc`, ESLint y Prettier.

| Fecha      | Paso                                             | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Estado                           |
| ---------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 28/09/2026 | 1 · Asad en formas grises + coreografía completa | Motion spec único con zod (S0 3/4 · S1 0,9 s solapa −115° · S2 1,2 s ascenso y fundido de la caja · S3 2,4 s giro de 360° exactos · S4 0,6 s encuadre y panel · S5 OrbitControls acotado). Timeline con eventos `opened`, `risen`, `rotated` y `done`; el panel HTML entra con `rotated`. Caja procedural con solapa sobre bisagra trasera. Frasco `LatheGeometry` con medidas **ESTIMADAS** desde el draft (altura supuesta de 140 mm). Controles de revisión: producto, reproducir/repetir/saltar, velocidad 0,25×–2×, formas grises, reduced motion simulado, fase y FPS. Verificado en Chromium headless a 390 y 1440 px: secuencia completa, reduced motion real (estado final directo) y `?nowebgl` (imagen draft + panel). `pnpm build` sin errores. **Los FPS de las capturas (5–12) son de SwiftShader por software y no representan un dispositivo real** | Aprobado (28/09/2026)            |
| 28/09/2026 | 2 · Texturas de Asad                             | Aprobados ritmo y encuadre del paso 1. El draft frontal se **proyecta** sobre el arco frontal (±72°) del cuerpo y el tapón, calibrado en px/mm contra el propio draft (sin recortes a mano), con los bordes fundidos. El medallón 3D se alinea con el draft (en el draft está desplazado ≈5,8 mm a la derecha del eje, a comprobar con la foto real). Entorno de estudio claro para que los metales no reflejen negro                                                                                                                                                                                                                                                                                                                                                                                                                                               | `GENERATED` · textura de prueba  |
| 28/09/2026 | 3 · Yara                                         | Reutiliza el perfil de Asad; cambian los materiales (rosa satinado y plata), la textura y la calibración del medallón (≈5,6 mm a la derecha en el draft). La textura se ve pálida porque el draft Flash tiene poco contraste. El medallón del draft sigue con el texto dudoso de §9                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `GENERATED` · textura de prueba  |
| 28/09/2026 | 4 · CDN Intense Man LE                           | Prisma gunmetal con bisel, collarín, cuello y tapón cuadrado. Cadena simplificada (9 eslabones toroidales) y medallón como disco con la textura proyectada. Frente del cuerpo y del tapón con el draft v2. **El fondo del prisma (42 mm) es una suposición**: el draft solo muestra el frente                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `GENERATED` · textura de prueba  |
| 28/09/2026 | 5 · Khamrah                                      | Prisma de base cuadrada con `MeshPhysicalMaterial` (transmission 1, IOR 1,5), líquido ámbar interior y placa dorada plana con el recorte de la placa del draft 3/4 (no hay draft frontal). Normal map de estrías en espiga **provisional, generado en código**. La escena necesita fondo propio para que el vidrio no salga blanco opaco. Coste medido en S5 a 390 px: 9 draw calls y 3,7k triángulos (Asad: 9 y 9,8k). Con render por software, Khamrah va ≈11 % más lento que Asad (8,0 frente a 9,0 fps). **Falta medir los FPS en un móvil real**: objetivo 60 fps y mínimo 30 fps (§5)                                                                                                                                                                                                                                                                         | `GENERATED` · vidrio provisional |

**Pendiente:** medir FPS en un móvil real (sobre todo Khamrah); kit de tienda con medidas reales y fotos para sustituir texturas y normal map; revisar el medallón de Yara con la foto real. Descripciones y datos de producto: el catálogo (`CATALOGO global 2026`) no está en el repo; hasta que se aporte, el panel lleva placeholders.
