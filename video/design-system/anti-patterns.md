# Anti-patrones

**Estado: propuesta.** Se repasa antes de dar por buena cada escena. Las reglas marcadas **[auto]** las comprueba un script (`npm run tokens` o `npm run storyboard`) y fallan la etapa. Las marcadas **[a ojo]** se revisan en los fotogramas que extrae la etapa 13. Los valores están en [tokens.json](tokens.json).

## Color

- **[auto]** Solo los 4 colores de marca: `night`, `ivory`, `gold` y `oud`. El único derivado permitido es el mismo color con alfa (`text-muted` y `subtitle-scrim`).
- **[auto]** Contraste AA calculado, no supuesto: 4,5:1 para texto y 3:1 para filetes e iconos. Los subtítulos se miden en el peor caso, con el vídeo blanco o negro detrás.
- El dorado nunca es fondo de texto (D4 de la tienda). Sobre el fondo claro, solo filetes e iconos.
- Prohibido: gradientes violeta o cian, glassmorphism (desenfoque detrás de paneles), manchas difusas de fondo, brillos de neón y viñeteados añadidos.

## Tipografía

- **[auto]** Dos familias de Fontsource: Cormorant Garamond (titulares y cifras) y Manrope (etiquetas, subtítulos y texto). Sin CDN.
- **[auto]** Escala modular cerrada: 40 px × 1,333ⁿ. Nada por debajo de 30 px ni tamaños fuera de la escala.
- **[auto]** No todo centrado: cada escena se alinea a un lado y como máximo una puede ir centrada.
- Las etiquetas pequeñas van en Manrope en versalitas, nunca en Cormorant.
- Sin sombras de texto, contornos ni texto en degradado.

## Composición

- **[auto]** Rejilla de 12 columnas por formato y bloques de texto que empiezan y terminan en una columna.
- Asimetría intencional: el sujeto en un tercio y el texto en el lado opuesto, con espacio negativo de verdad, no relleno.
- Datos con una cifra grande y una etiqueta pequeña, separadas por el filete dorado. Una cifra por escena.
- **[a ojo]** Nada dentro de las zonas seguras del vertical (arriba 216 px, abajo 384 px y derecha 144 px), donde la interfaz de la red tapa el vídeo.

## Movimiento

- **[auto]** Duraciones de 300 a 700 ms y solo las cuatro de los tokens.
- **[auto]** Solo las tres curvas de los tokens, sin rebote ni sobrepaso (los cuatro valores entre 0 y 1).
- **[auto]** Como máximo 3 movimientos de interfaz por escena, cada uno con un propósito escrito.
- Prohibido: rebotes, elásticos, giros 3D de texto, parallax por defecto, zoom continuo de Ken Burns en todas las escenas y texto que entra letra a letra.
- Entradas de 24 px como máximo; deriva de cámara 2D de 48 px como máximo en toda la escena.

## Imagen

- **[auto desde la etapa 5]** Todos los prompts llevan el mismo bloque de estilo, generado desde los tokens: misma paleta, luz, lente, textura y grano (`npm run tokens -- --style` lo enseña).
- **[a ojo]** Las señales de imagen de IA invalidan el fotograma: texto o caligrafía inventados, superficies plásticas, nitidez exagerada tipo HDR, objetos fundidos, sombras incoherentes, bokeh de luces y destellos.
- Sin clichés orientalistas: dunas al atardecer, camellos, lámparas, humo dorado o arabescos generados. La IA deforma la caligrafía árabe (lo vimos en el piloto), así que no se genera.
- Ninguna imagen generada se presenta como un producto real: ni frascos ni cajas de marcas, ni notas de un perfume concreto. Las imágenes del ejemplo son materias primas ilustrativas.

## Iconos

- **[auto]** Solo Lucide, con rejilla de 24 px, tamaño de 48 px y trazo de 1,5 (3 px al tamaño final).
- **[auto]** Prohibidos los iconos «de IA» o de relleno: `sparkle(s)`, `wand(-sparkles)`, `brain(-circuit, -cog)`, `bot`, `cpu`, `atom`, `rocket` y `zap`.
- Un icono solo si aporta información. Ninguno decorativo.

## Texto en vídeo

- **[auto]** Una idea por escena, con 12 palabras como máximo.
- **[auto]** Tiempo de lectura: palabras ÷ 2,5 + 1 s cabe en la escena.
- **[auto]** Las cifras sin fuente no se renderizan. Mientras falte la fuente, el storyboard lo avisa y la etapa de composición lo bloqueará.
- Subtítulos (si hay locución) en Manrope de 53 px sobre la banda opaca, en una o dos líneas.

## Antes de dar por buena una escena

- [ ] Una sola idea, legible en su tiempo y alineada a un lado.
- [ ] Colores, tipos, tiempos y curvas salen de los tokens; ningún valor suelto.
- [ ] El fotograma clave respeta el bloque de estilo y no tiene señales de IA.
- [ ] Nada importante en las zonas seguras.
- [ ] Ningún icono prohibido ni decorativo.
- [ ] Cada cifra tiene fuente, o la escena se queda en borrador.
- [ ] Lo que sea placeholder está registrado en el informe.
