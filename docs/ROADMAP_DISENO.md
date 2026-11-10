# Roadmap de diseño, movimiento y 3D — para autorizar

Propuestas del 10/11/2026, a petición del usuario («crea un roadmap de mejoras para autorizar mañana»). **Nada de esta lista está hecho ni empezado**: cada punto espera tu visto bueno. Lo ya entregado en la rama `claude/blissful-ramanujan-t2e9bs` está al final, como contexto.

**Cómo autorizar:** responde con los códigos que quieras, por ejemplo «A2, A4 y B1». Puedes cambiar el orden, quitar puntos o pedir otros. Lo que no autorices no se toca.

**Tamaños** (orientativos, no son plazos): **pequeña**, cabe en una entrega junto a otras; **mediana**, una entrega propia; **grande**, varias entregas o depende de material que solo tienes tú.

## Mi recomendación

Por este orden: **A2** (la foto viaja de la rejilla a la ficha: es lo que más cambia la sensación de la tienda), **A4** (filtros siempre a mano: con 50 perfumes se nota), **B1** (la pirámide 3D con las notas de cada perfume), **D1** (medir el rendimiento antes de añadir más 3D) y **A1** (el frasco girando dentro de la tarjeta). El resto, después y según lo que veas en la tienda real.

## A. Colección y catálogo olfativo

| Código | Qué vería el cliente                                                                                                                                  | Tamaño  | Depende de                                                     | Riesgo o límite                                                                                                              | Autorizar |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- |
| A1     | En los perfumes con escena 3D, al pasar el cursor por la tarjeta el frasco gira en 3D dentro de su vitrina (hoy se ve la foto y la marca «Vista 3D»). | Mediana | Nada                                                           | Solo con tarjeta gráfica y con cursor (no en el móvil); un frasco a la vez para no cargar el navegador.                      | [ ]       |
| A2     | Al abrir un perfume, su foto «viaja» de la tarjeta a la ficha en vez de cambiar de página en seco; al volver, regresa a su sitio.                     | Mediana | Nada                                                           | Usa una función reciente de los navegadores: donde no existe, se ve como hoy. Hay que comprobarla con la caché de la tienda. | [ ]       |
| A3     | «Vista rápida»: un panel lateral con la foto, los formatos, el precio y las notas, sin salir de la rejilla.                                           | Mediana | Para «Añadir a la cesta» dentro del panel, la venta encendida. | Un sitio más donde mantener precio y existencias al día; sin venta, el panel solo enlaza a la ficha.                         | [ ]       |
| A4     | Al bajar por la rejilla, los filtros y el buscador se quedan arriba en una barra fina, con los filtros activos a la vista y «Quitar filtros».         | Pequeña | Nada                                                           | Hay que encajarla con la cabecera en el móvil para no quitar sitio a los perfumes.                                           | [ ]       |
| A5     | En el catálogo olfativo, filtrar por notas (vainilla, oud, rosa…) eligiéndolas en una nube animada, además de por familia, estación y momento.        | Mediana | Nada (las notas ya están en cada perfil, con su fuente).       | 3 de los 50 perfumes no tienen perfil olfativo: no saldrían al filtrar.                                                      | [ ]       |
| A6     | Comparador: elegir dos o tres perfumes y ver sus pirámides, familias y momentos lado a lado.                                                          | Mediana | Nada                                                           | En el móvil hay que pensarlo como deslizable; es la propuesta con más diseño por delante.                                    | [ ]       |
| A7     | El abanico 3D de la cabecera de la colección también en el móvil y la tableta, deslizable con el dedo (hoy solo sale en pantallas anchas).            | Pequeña | Nada                                                           | Empuja la rejilla hacia abajo en pantallas pequeñas: por eso hoy no está.                                                    | [ ]       |
| A8     | El mismo lenguaje (tarjetas que se inclinan, entrada con el scroll, titular animado) en las páginas de casas, la búsqueda y «También de esta casa».   | Pequeña | Nada                                                           | Las tarjetas de perfume ya lo tienen en todas partes; faltan las cabeceras y las tarjetas de casa.                           | [ ]       |

## B. Ficha del perfume

| Código | Qué vería el cliente                                                                                                    | Tamaño  | Depende de                                                               | Riesgo o límite                                                                                          | Autorizar |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------- |
| B1     | La pirámide olfativa 3D de la cabecera del catálogo, en cada ficha y con las notas reales de ese perfume en cada piso.  | Pequeña | Nada                                                                     | Solo en los perfumes cuya fuente separa salida, corazón y fondo; el resto sigue con «notas principales». | [ ]       |
| B2     | Galería de la ficha con ampliación al tocar y cambio de foto con el dedo.                                               | Pequeña | Nada                                                                     | Las fotos oficiales son provisionales: ampliarlas enseña más su calidad real.                            | [ ]       |
| B3     | Escena 3D (caja que se abre y frasco que gira) para más perfumes, que además entran solos en el carrusel de la portada. | Grande  | **Tú:** medidas reales de frasco y caja y fotos propias o con derechos.  | Sin ese material habría que estimar, como en los cuatro pilotos; no se inventan medidas ni fotos.        | [ ]       |
| B4     | Texturas definitivas en los cuatro frascos 3D actuales (hoy llevan imágenes de prueba generadas y medidas estimadas).   | Mediana | **Tú:** fotos frontales de los cuatro frascos (o permiso de las marcas). | Es lo que más mejoraría el realismo del carrusel de la portada.                                          | [ ]       |

## C. Portada

| Código | Qué vería el cliente                                                                                                                 | Tamaño  | Depende de                                          | Riesgo o límite                                                                                   | Autorizar |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------- |
| C1     | Carrusel ajustado a cada dispositivo: calidad alta en ordenadores potentes y más ligera en móviles modestos, para que no dé tirones. | Pequeña | **Tú:** probarlo en un móvil y un ordenador reales. | Aquí no hay tarjeta gráfica: la fluidez real no se ha podido medir (ver «Límites»).               | [ ]       |
| C2     | «La experiencia»: al llegar a esa sección, la caja se abre y el frasco sube en 3D mientras se baja por la página.                    | Mediana | Nada                                                | Segunda escena 3D en la misma página: solo se cargaría al acercarse y nunca a la vez que la otra. | [ ]       |
| C3     | Recorrido olfativo con transiciones entre preguntas y las propuestas entrando una a una.                                             | Mediana | Nada                                                | Es un formulario: el movimiento no puede estorbar al teclado ni al lector de pantalla.            | [ ]       |

## D. Calidad y rendimiento

| Código | Para qué                                                                                                                                                          | Tamaño  | Depende de                                        | Riesgo o límite                                                                   | Autorizar |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------- | --------------------------------------------------------------------------------- | --------- |
| D1     | Medir en cada cambio lo que tarda en verse y en responder la portada, la colección y una ficha (Lighthouse en la CI), con un tope que avise si el 3D los empeora. | Mediana | Nada                                              | Es el punto 7 del [ROADMAP](ROADMAP.md); hoy la CI no mide el rendimiento.        | [ ]       |
| D2     | Datos de prueba de la CI con fotos y perfumes con escena, para que las pruebas del carrusel, el abanico y «Vista 3D» se ejecuten siempre (hoy la CI las omite).   | Pequeña | Nada                                              | Solo cambia datos ficticios de la base de pruebas; nunca `atelier-dev`.           | [ ]       |
| D3     | Una base de pruebas aparte para las Preview de Vercel, y así ver cada cambio de diseño con el catálogo antes de fusionar (hoy las Preview salen sin perfumes).    | Mediana | **Tú:** crear el proyecto de pruebas en Supabase. | Es el paso 3 de «Completar el aislamiento remoto» de [OPERATIONS](OPERATIONS.md). | [ ]       |

## Lo que necesito que decidas

1. **Qué códigos autorizas** y, si quieres, en qué orden.
2. **Cuánto movimiento quieres.** Lo entregado es deliberadamente sobrio (inclinaciones de pocos grados, entradas lentas). Si lo quieres más marcado o más discreto, dímelo antes de extenderlo con A8.
3. **Si puedes aportar el material de B3 y B4** (medidas y fotos). Sin él, esas dos no se pueden hacer bien.

## Límites de lo que he podido comprobar

- **Fluidez del 3D sin medir.** Este entorno no tiene tarjeta gráfica: el carrusel de la portada iba a un fotograma por segundo y no sé cómo va de suave en un móvil real. Las mejoras de la colección y del catálogo olfativo no usan WebGL (son transformaciones 3D del navegador), así que ese riesgo no las afecta.
- **La entrada y la deriva con el scroll** dependen de una función que hoy tienen Chrome, Edge y Safari recientes; en Firefox las tarjetas se ven quietas, en su sitio.
- **Las Preview de Vercel no tienen catálogo** (desde el 28/10): allí no se ve ni el carrusel ni las rejillas. De ahí D3.

## Ya entregado en esta rama (contexto)

- **Portada con carrusel 3D** de los cuatro perfumes con escena (DECISIONS §188).
- **Colección y catálogo olfativo con movimiento y 3D** (DECISIONS §189): tarjetas-vitrina que se inclinan hacia el cursor, entrada en perspectiva y deriva de la foto con el scroll, filtros con pastilla deslizante, abanico 3D con una fragancia de cada casa en la cabecera de la colección, pirámide olfativa 3D en la cabecera del catálogo olfativo y la marca «Vista 3D» en los perfumes con escena.
