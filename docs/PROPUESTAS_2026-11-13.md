# Propuestas para dejar la página lista — 13/11/2026

A petición del usuario: mejoras para dejar la web lista, recomendaciones de código (añadir, modificar o eliminar) y el resultado de las pruebas de seguridad. **Nada de esta lista está hecho salvo lo que dice «Hecho hoy»**: cada punto espera tu visto bueno. Para autorizar, responde con los códigos («V1, C3 y S2»).

**Tamaños** (orientativos): **pequeña**, cabe con otras en una entrega; **mediana**, una entrega propia; **grande**, varias o depende de material tuyo.

## Hecho hoy (13/11)

- Inventario real cargado y existencias de prueba a cero (DECISIONS §194).
- Fondo beige de desierto, galería de casas en nichos y suscripción solo en las páginas de exploración (§192).
- Venta en pruebas con el Redsys de pruebas, lista para encender (§193).
- Pruebas de seguridad desde fuera: sin agujeros (ver más abajo).

## Mi recomendación

Por este orden: **V1** (encender la venta en pruebas, es lo que pide el banco), **V2** (los tres destacados de la portada están agotados), **V3** (pesos y «Ofrecer el envío», o el banco solo verá recogida en tienda), **C1** (marcar los pedidos de prueba) y **K1** (PVP y foto de lo que más unidades tiene).

## V. Lo que mira el banco

| Código | Qué                                                                                                                                                                                                                                                                                                         | Quién                                                     | Tamaño  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------- |
| V1     | **Encender la venta en pruebas.** Fusionar esta rama y poner en Vercel → Production: `WEB_CHECKOUT=1`, `WEB_CHECKOUT_TEST=1`, `REDSYS_MERCHANT_CODE=370787319`, `REDSYS_TERMINAL=001`, `REDSYS_ENVIRONMENT=test` y `REDSYS_SECRET_KEY` (la de pruebas del correo del banco, como «Sensitive»). Redesplegar. | Titular (o yo, con tu permiso, por el conector de Vercel) | Pequeña |
| V2     | **Destacados agotados.** Asad, Yara y Club de Nuit Intense Man LE abren la portada (carrusel 3D y «Fragancias destacadas») y tienen 0 unidades. Cambiar los destacados en el panel a perfumes con existencias, o reponerlos. Hay 6 publicados a cero (§194).                                                | Titular                                                   | Pequeña |
| V3     | **Envío.** Según lo último registrado (ROADMAP, 02/11), «Ofrecer el envío» sigue apagado y los formatos están sin pesar: solo se podría recoger en Castelldefels. Pesar los formatos publicados (Catálogo → Pesos de envío) y activar un servicio.                                                          | Titular                                                   | Pequeña |
| V4     | **Texto de la portada.** «La compra online llegará muy pronto» contradice la venta abierta: cambiarlo en Panel → Contenido → Portada al encender V1.                                                                                                                                                        | Titular                                                   | Pequeña |
| V5     | **Textos legales.** Faltan plazo de entrega, transportista y arbitraje, y la revisión de la asesoría (LEGAL.md). El banco suele leer las condiciones de venta y la política de devoluciones.                                                                                                                | Titular y asesoría                                        | Pequeña |
| V6     | **Una unidad de casi todo.** 42 de los 44 perfumes con stock tienen una unidad: un pedido (también uno de prueba) lo agota. Mientras dure la venta en pruebas, cancelar los pedidos de prueba el mismo día.                                                                                                 | Titular                                                   | —       |

## K. Catálogo e inventario

| Código | Qué                                                                                                                                                                                                                                                                       | Tamaño  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| K1     | **PVP y foto de los 93 formatos nuevos**, por tandas y empezando por los de más unidades: Qaed Al Fursan Unlimited, Musamam White Intense y Liquid Brun 150 ml (6 cada uno), Asad Elixir (5), Vulcan Feu, Royal Blend Nero, Art of Universe y Rayhaan Terra y Elixir (4). | Grande  |
| K2     | **Verificar la hoja contra las estanterías.** Todas las líneas están «Pendiente verificar» y cuatro documentos son presupuestos. Corregir desde Panel → Inventario → Recuento.                                                                                            | Mediana |
| K3     | **Páginas que faltan por fotografiar:** pág. 2 del presupuesto 05579, pág. 1 del presupuesto sin número (577,50 € sin detallar) y pág. 2 del albarán. Sus unidades no están cargadas.                                                                                     | Pequeña |
| K4     | **Decidir qué no va a la web:** ambientadores (84 uds), espray Iris (20), packs y sets. Pueden quedarse en borrador y venderse solo en el mostrador.                                                                                                                      | —       |
| K5     | **«Marca por identificar»** en 23 productos: ponerles su casa al revisarlos (muchas se leen en la caja).                                                                                                                                                                  | Mediana |
| K6     | **Fotos propias** de los 50 publicados: hoy enseñan recreaciones generadas (GENERATED_PRODUCT_IMAGES.md). Comprobar cada una con la unidad física; Miss Sakura sigue con la duda «Intense».                                                                               | Grande  |
| K7     | **Costes del albarán:** confirmar con el proveedor si llevan IVA y registrarlos; hoy solo están los de los presupuestos.                                                                                                                                                  | Pequeña |

## D. Diseño

| Código | Qué vería el cliente                                                                                                                       | Tamaño  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| D1     | Revisar el beige en un móvil real y con las fotos antiguas de fondo blanco (se funden con `multiply`; aquí solo se han visto en capturas). | Pequeña |
| D2     | La cabecera de cada página de casa con su nicho en arco y el mismo filete dorado, para que la galería de la portada tenga continuidad.     | Pequeña |
| D3     | «Agotado» más elegante: tarjeta atenuada, al final de la rejilla, y «Avísame cuando vuelva» (enlaza con el Club).                          | Mediana |
| D4     | «Última unidad» en la ficha y la tarjeta cuando queda una: es verdad en casi todo el catálogo y empuja la compra sin inventar urgencia.    | Pequeña |
| D5     | Un tono propio y más neutro para el panel si el beige cansa al trabajar muchas horas (la consola ya tiene el suyo).                        | Mediana |
| D6     | Siguen pendientes de autorizar A2, A4, B1 y D1 de [ROADMAP_DISENO.md](ROADMAP_DISENO.md).                                                  | —       |

## C. Código: añadir

| Código | Qué y por qué                                                                                                                                                                                           | Tamaño  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| C1     | **Marca de pedido de prueba** (`orders.test_mode`, migración): los pedidos hechos con el entorno de pruebas quedan señalados y fuera de los informes, y no se mezclan con los reales al pasar a `live`. | Mediana |
| C2     | **Portada y destacados sin agotados:** que el carrusel 3D y «Fragancias destacadas» salten los perfumes sin existencias (hoy los eligen por orden).                                                     | Pequeña |
| C3     | **Importar un albarán desde el panel** (CSV de la hoja → revisión → recepción con su coste), para no volver a cargar el inventario por SQL. Reutiliza compras y recepciones de la fase R.               | Grande  |
| C4     | **E2E** de la galería de casas (teclado, flechas, móvil) y del aviso de la venta en pruebas; hoy tienen pruebas unitarias y capturas.                                                                   | Pequeña |
| C5     | **EAN en el feed** de Google y Meta: 31 formatos (aún en borrador) ya lo tienen en la base desde hoy.                                                                                                   | Pequeña |
| C6     | **Lighthouse CI** con presupuestos de peso (lo pide la F8) antes de añadir más 3D.                                                                                                                      | Mediana |

## M. Código: modificar

| Código | Qué y por qué                                                                                                                                                                                                                                                      | Tamaño  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| M1     | **Enlace «Acceso del equipo» del pie:** quitarlo de la tienda pública. No es un agujero (el panel exige sesión y MFA), pero anuncia dónde está la puerta; el equipo puede guardar la dirección.                                                                    | Pequeña |
| M2     | **STATUS.md tiene 658 líneas:** mover las entradas anteriores a octubre a `docs/phases/` y dejar arriba un resumen vigente. Cada agente lo lee entero al empezar.                                                                                                  | Pequeña |
| M3     | **AGENTS.md** dice «ADHARA»; el proyecto es L’Atelier du Désert. Unificar el nombre y enlazar el método de trabajo (hecho el enlace hoy).                                                                                                                          | Pequeña |
| M4     | **Disponibilidad y caché de 5 minutos:** con una unidad por perfume, comprobar que la ficha y la rejilla dejan de ofrecer un perfume en cuanto se reserva (las páginas se regeneran cada 5 minutos; el pedido ya lo rechaza bien) y, si no, revalidar al reservar. | Pequeña |
| M5     | **Nombre de la base:** `atelier-dev` es producción. Renombrar el proyecto en Supabase (solo la etiqueta) evita errores de agentes y personas.                                                                                                                      | Pequeña |

## E. Código: eliminar

| Código | Qué                                                                                                                                              | Tamaño  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| E1     | `graphify-out/` (6,8 MB de un análisis generado) del repositorio: no lo usa el código ni la CI.                                                  | Pequeña |
| E2     | Variables de Preview de las ramas de prueba del TPV y la clave secreta creada para ellas (pendiente desde el 25/10).                             | Titular |
| E3     | Pedidos de prueba 1001–1005 y los códigos `PRUEBATPV` y `ERIK` (ya inactivos): archivarlos o dejarlos marcados con C1.                           | Pequeña |
| E4     | El componente `Hero` fijo de la portada si se decide que el carrusel 3D es definitivo (hoy es la alternativa cuando no hay perfumes con escena). | Pequeña |

## S. Seguridad: pruebas del 13/11

Pruebas no destructivas contra `latelierdudesert.com` y la API de datos, con la clave pública que lleva la propia web (lo que tiene cualquier visitante). Detalle en [SECURITY_REVIEW_2026-11.md](SECURITY_REVIEW_2026-11.md#pruebas-desde-fuera-1311).

**Resultado: no se ha encontrado ninguna vía de entrada ni de fuga de datos.**

| Código | Hallazgo (todos de gravedad baja)                                                                                                               | Propuesta                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| S1     | El alta de cuentas de Auth está abierta aunque la cuenta de cliente esté apagada: cualquiera puede crear un usuario (sin rol ni acceso a nada). | Cerrar el alta en Supabase → Auth hasta encender `CUSTOMER_ACCOUNTS`.                           |
| S2     | `discount_codes` deja «leer» al visitante anónimo, aunque RLS no le devuelve ninguna fila.                                                      | Migración que retire ese permiso: defensa en profundidad.                                       |
| S3     | La CSP permite scripts en línea y no fija `default-src` ni `connect-src`.                                                                       | CSP con nonce (ya propuesta el 03/11): valorar con la venta abierta.                            |
| S4     | HSTS sin `preload`.                                                                                                                             | Añadir `preload` y dar de alta el dominio cuando todo vaya por HTTPS de forma estable.          |
| S5     | **Venta en pruebas (§193):** mientras dure, la clave de firma es la pública de Redsys y cualquiera puede dejar un pedido «pagado».              | Es el riesgo aceptado: no enviar nada, cancelar a diario y pasar a `live` cuanto antes. Ver C1. |
| S6     | Siguen pendientes del titular: reglas del Firewall de Vercel, proteger `main` en GitHub y la MFA de la cuenta del 30/09.                        | Hacerlo antes de anunciar la venta.                                                             |
