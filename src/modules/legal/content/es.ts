import type { LegalCopy } from '../domain/types';

/**
 * Textos legales en español (versión de referencia), a revisar con el
 * cliente y la asesoría. Los datos van como `{campo}`: si falta uno, ese
 * párrafo o línea no se publica y en la vista previa del personal se ve como
 * «Pendiente: …». Sin detalles internos (proveedores por nombre, panel,
 * estado de la web). Cualquier cambio de fondo se hace aquí primero y
 * después en ca.ts y en.ts, con las mismas secciones.
 */
export const es: LegalCopy = {
  ui: {
    eyebrow: 'Información legal',
    updated: 'Última actualización',
    contents: 'En esta página',
    pending: 'Pendiente',
    related: 'Otros textos legales',
  },
  fields: {
    holder: 'titular (razón social o nombre)',
    taxId: 'NIF',
    registeredAddress: 'domicilio',
    registry: 'datos registrales',
    email: 'email de contacto',
    phone: 'teléfono',
    domain: 'dominio de la web',
    storeAddress: 'dirección de la tienda',
    shippingZones: 'zonas de envío',
    shippingCost: 'tarifa de envío',
    freeShippingFrom: 'importe para envío gratis',
    deliveryTime: 'plazo de entrega',
    carrier: 'empresa de transporte',
    paymentMethods: 'medios de pago',
    arbitration: 'adhesión al arbitraje de consumo',
  },
  documents: {
    legalNotice: {
      title: 'Aviso legal',
      summary:
        'Quién está detrás de esta web y en qué condiciones puedes usarla.',
      sections: [
        {
          id: 'titular',
          title: 'Datos del titular',
          blocks: [
            'En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de servicios de la sociedad de la información y de comercio electrónico (LSSI), estos son los datos del titular de esta web:',
            {
              list: [
                'Titular: {holder}',
                'Nombre comercial: L’Atelier du Désert',
                'NIF: {taxId}',
                'Domicilio: {registeredAddress}',
                'Tienda: {storeAddress}',
                'Email: {email}',
                'Teléfono: {phone}',
                'Datos registrales: {registry}',
                'Web: {domain}',
              ],
            },
          ],
        },
        {
          id: 'objeto',
          title: 'Objeto y aceptación',
          blocks: [
            'Esta web da a conocer la perfumería árabe de L’Atelier du Désert y su tienda de Castelldefels: su colección, el catálogo olfativo y la compra online.',
            'Navegar por la web supone aceptar este aviso legal. Las compras se rigen además por las [condiciones de venta](doc:terms) y por la página de [envíos y devoluciones](doc:shipping).',
          ],
        },
        {
          id: 'uso',
          title: 'Uso de la web',
          blocks: [
            'Te comprometes a usar la web de forma lícita y de acuerdo con este aviso. En particular, no debes:',
            {
              list: [
                'usarla para fines ilícitos o que perjudiquen a terceros;',
                'introducir virus o cualquier código que pueda dañarla;',
                'intentar acceder a zonas restringidas o a datos de otras personas;',
                'copiar o extraer de forma masiva sus contenidos.',
              ],
            },
            'Podemos interrumpir el acceso por mantenimiento, por seguridad o por causas técnicas, intentando que sea el menor tiempo posible.',
          ],
        },
        {
          id: 'propiedad',
          title: 'Propiedad intelectual e industrial',
          blocks: [
            'El nombre L’Atelier du Désert, su logotipo, el diseño de la web, sus textos propios y su código pertenecen al titular de esta web o se usan con licencia. No puedes reproducirlos, distribuirlos ni transformarlos sin autorización.',
            'Los nombres, las marcas y las imágenes de los perfumes pertenecen a sus casas respectivas. Se usan solo para identificar los productos que se venden en la tienda, sin que ello suponga ninguna relación distinta de la de revendedor.',
          ],
        },
        {
          id: 'productos',
          title: 'Información de los productos',
          blocks: [
            'Las notas, familias y demás datos olfativos proceden de la ficha oficial de cada casa o de su distribuidor oficial, y así se indica en cada perfume. La percepción de una fragancia es personal y puede variar según la piel.',
            'Las fotos son orientativas: las casas cambian a veces el envase o la caja sin aviso. Si detectas un error, escríbenos y lo corregiremos.',
          ],
        },
        {
          id: 'enlaces',
          title: 'Enlaces a otras webs',
          blocks: [
            'La web puede enlazar a otras, como nuestras redes sociales. No controlamos su contenido ni sus políticas, de las que responde cada titular.',
          ],
        },
        {
          id: 'responsabilidad',
          title: 'Responsabilidad',
          blocks: [
            'Ponemos los medios razonables para que la web funcione bien y sea segura, pero no podemos garantizar que no haya interrupciones o errores ajenos a nuestro control. Nada de este aviso limita los derechos que la ley te reconoce como consumidor.',
          ],
        },
        {
          id: 'datos',
          title: 'Datos personales y cookies',
          blocks: [
            'Cómo tratamos tus datos se explica en la [política de privacidad](doc:privacy), y qué cookies usa la web, en la [política de cookies](doc:cookies).',
          ],
        },
        {
          id: 'ley',
          title: 'Ley aplicable y jurisdicción',
          blocks: [
            'Este aviso se rige por la ley española. Si eres consumidor, puedes acudir a los juzgados de tu domicilio.',
          ],
        },
      ],
    },

    terms: {
      title: 'Condiciones de venta',
      summary:
        'Las condiciones que se aplican a las compras que hagas en esta web.',
      sections: [
        {
          id: 'partes',
          title: 'Quién vende y a quién',
          blocks: [
            'El vendedor es el titular de esta web, L’Atelier du Désert, cuyos datos figuran en el [aviso legal](doc:legalNotice#titular).',
            'Estas condiciones se aplican a las compras hechas en la web por personas mayores de edad, con entrega a domicilio o recogida en la tienda. Al hacer el pedido aceptas la versión vigente en ese momento, que te enviamos con la confirmación.',
          ],
        },
        {
          id: 'productos',
          title: 'Productos',
          blocks: [
            'Vendemos perfumes, aceites perfumados y otros artículos de perfumería de casas de Oriente Medio. Cada ficha indica la casa, el nombre, la concentración, el formato en mililitros y el precio. Las notas olfativas proceden de la casa o de su distribuidor oficial.',
            'Las fotos son orientativas y el envase puede cambiar según el lote. La disponibilidad que ves en la web se confirma al hacer el pedido.',
            {
              note: 'Son productos cosméticos de uso externo. Lee las precauciones del envase, no los apliques sobre piel irritada, mantenlos fuera del alcance de los niños y lejos del fuego: los perfumes con alcohol son inflamables. Si tienes la piel sensible, prueba primero en una zona pequeña.',
            },
          ],
        },
        {
          id: 'precios',
          title: 'Precios',
          blocks: [
            'Los precios están en euros e incluyen el IVA. Los gastos de envío no están incluidos: se indican antes de pagar y se explican en [envíos y devoluciones](doc:shipping).',
            'Se aplica el precio que aparece al hacer el pedido. Cuando anunciamos una rebaja, el precio anterior que mostramos es el más bajo de los 30 días previos.',
            'Si por un error evidente un precio no se corresponde con el real (por ejemplo, 0 € o un precio irrisorio), te avisaremos antes de enviar el pedido y podrás confirmarlo con el precio correcto o cancelarlo sin coste.',
          ],
        },
        {
          id: 'pedido',
          title: 'Cómo se hace un pedido',
          blocks: [
            {
              ordered: true,
              list: [
                'Elige el perfume y el formato y añádelo a la cesta.',
                'Revisa la cesta e indica tus datos de contacto y de entrega, o la recogida en la tienda.',
                'Comprueba el resumen: productos, gastos de envío y precio total. Hasta este momento puedes corregir cualquier dato.',
                'Acepta estas condiciones y pulsa el botón de pedido con obligación de pago.',
                'Paga en la página segura del banco.',
              ],
            },
            'Al terminar te enviaremos un email con la confirmación del pedido y estas condiciones. El contrato puede celebrarse en español, catalán o inglés. Guardamos el pedido en formato electrónico y puedes pedirnos una copia.',
          ],
        },
        {
          id: 'pago',
          title: 'Pago y factura',
          blocks: [
            'Medios de pago: {paymentMethods}.',
            'El pago con tarjeta se hace en la página segura del banco, con autenticación reforzada (3D Secure). Nunca vemos ni guardamos los datos de tu tarjeta. El cargo se hace al confirmar el pedido.',
            'Emitimos factura de cada pedido. Si la necesitas a nombre de una empresa, indícanos sus datos fiscales al hacer el pedido.',
          ],
        },
        {
          id: 'disponibilidad',
          title: 'Si un producto no está disponible',
          blocks: [
            'Si después de pagar no pudiéramos servir un producto por falta de existencias, te avisaremos y te devolveremos sin demora lo que hayas pagado por él, con el mismo medio de pago.',
          ],
        },
        {
          id: 'entrega',
          title: 'Entrega',
          blocks: [
            'Las zonas, los plazos y los gastos de envío se detallan en [envíos y devoluciones](doc:shipping). Salvo que acordemos otra cosa, entregaremos el pedido en un máximo de 30 días desde su confirmación.',
            'Los productos viajan bajo nuestra responsabilidad hasta que tú, o la persona que indiques, los recibís.',
          ],
        },
        {
          id: 'desistimiento',
          title: 'Derecho de desistimiento',
          blocks: [
            'Tienes 14 días naturales desde que recibes el pedido para desistir de la compra sin dar explicaciones, salvo en los productos precintados que se hayan desprecintado después de la entrega, que por motivos de higiene y protección de la salud no admiten devolución. Las condiciones, los plazos y el formulario están en [envíos y devoluciones](doc:shipping#desistimiento).',
          ],
        },
        {
          id: 'garantia',
          title: 'Garantía',
          blocks: [
            'Respondemos de cualquier falta de conformidad de los productos durante 3 años desde la entrega, según el texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios. Si el defecto aparece en los 2 primeros años, se presume que ya existía al entregarlo.',
            'Si un producto llega roto, defectuoso o no es el que pediste, puedes pedir que lo sustituyamos o, si no es posible, la devolución del importe. Te pedimos que nos avises cuanto antes, con fotos, para gestionarlo también con el transportista. Estos gastos corren de nuestra cuenta.',
          ],
        },
        {
          id: 'atencion',
          title: 'Atención al cliente y reclamaciones',
          blocks: [
            'Puedes contactarnos por estas vías. Responderemos a las reclamaciones lo antes posible y como máximo en un mes.',
            {
              list: [
                'Email: {email}',
                'Teléfono: {phone}',
                'Tienda: {storeAddress}',
              ],
            },
            'Tienes a tu disposición hojas oficiales de queja, reclamación y denuncia en la tienda, y también puedes pedírnoslas por email. Puedes dirigirte a la oficina municipal de información al consumidor de tu municipio o a la [Agència Catalana del Consum](https://consum.gencat.cat).',
            'Arbitraje de consumo: {arbitration}.',
          ],
        },
        {
          id: 'ley',
          title: 'Ley aplicable y jurisdicción',
          blocks: [
            'Estas condiciones se rigen por la ley española y, en lo que corresponda, por el Código de consumo de Cataluña. Si eres consumidor, puedes acudir a los juzgados de tu domicilio.',
          ],
        },
        {
          id: 'cambios',
          title: 'Cambios en estas condiciones',
          blocks: [
            'Podemos actualizar estas condiciones. A cada pedido se le aplican las vigentes en el momento de hacerlo.',
          ],
        },
      ],
    },

    privacy: {
      title: 'Política de privacidad',
      summary:
        'Qué datos personales tratamos, para qué, durante cuánto tiempo y qué derechos tienes.',
      sections: [
        {
          id: 'responsable',
          title: 'Responsable del tratamiento',
          blocks: [
            {
              list: [
                'Responsable: L’Atelier du Désert',
                'Titular: {holder}',
                'NIF: {taxId}',
                'Domicilio: {registeredAddress}',
                'Email para temas de privacidad: {email}',
              ],
            },
            'Para cualquier cuestión sobre tus datos, puedes escribirnos por email o por correo postal a la tienda, en {storeAddress}.',
          ],
        },
        {
          id: 'club',
          title: 'Club L’Atelier: promociones por email',
          blocks: [
            {
              list: [
                'Datos: tu email, el idioma de la web y la fecha y la versión del texto que aceptaste.',
                'Finalidad: enviarte promociones, descuentos y novedades de la tienda.',
                'Base jurídica: tu consentimiento, que das marcando la casilla del formulario (art. 6.1.a del RGPD y art. 21 de la LSSI).',
                'Conservación: hasta que te des de baja. Después guardamos bloqueado el registro del alta y de la baja el tiempo necesario para acreditar que contamos con tu consentimiento.',
              ],
            },
            'Puedes darte de baja en cualquier momento con el enlace que incluye cada correo o escribiéndonos.',
          ],
        },
        {
          id: 'consultas',
          title: 'Consultas y atención al cliente',
          blocks: [
            {
              list: [
                'Datos: los que nos des al escribirnos o llamarnos (nombre, email, teléfono y tu mensaje).',
                'Finalidad: responderte y atender tu consulta o reclamación.',
                'Base jurídica: nuestro interés legítimo en atenderte o, si nos pides información antes de comprar, la aplicación de medidas precontractuales.',
                'Conservación: el tiempo necesario para resolverla y, después, bloqueados durante los plazos de prescripción de posibles responsabilidades.',
              ],
            },
          ],
        },
        {
          id: 'pedidos',
          title: 'Pedidos online',
          blocks: [
            {
              list: [
                'Datos: nombre, email, teléfono, dirección de entrega y, si pides factura a nombre de una empresa, sus datos fiscales; productos, importes y estado del pago. Los datos de tu tarjeta los trata el banco: nosotros no los recibimos.',
                'Finalidad: gestionar el pedido, el pago, la entrega, las devoluciones y la garantía, y emitir la factura.',
                'Base jurídica: la ejecución del contrato de compraventa (art. 6.1.b del RGPD) y el cumplimiento de obligaciones legales fiscales y contables (art. 6.1.c).',
                'Conservación: mientras dure la relación y, después, 6 años por la normativa mercantil y los plazos que exija la normativa fiscal.',
              ],
            },
          ],
        },
        {
          id: 'seguridad-web',
          title: 'Funcionamiento y seguridad de la web',
          blocks: [
            {
              list: [
                'Datos: dirección IP, navegador y fecha de acceso, que registra el servidor.',
                'Finalidad: que la web funcione y protegerla frente a abusos y ataques.',
                'Base jurídica: nuestro interés legítimo en mantener la web segura.',
                'Conservación: periodos cortos, según la configuración del proveedor de alojamiento.',
              ],
            },
          ],
        },
        {
          id: 'destinatarios',
          title: 'Quién accede a tus datos',
          blocks: [
            'No vendemos ni cedemos tus datos. Solo acceden a ellos, con contrato de encargo de tratamiento y solo para prestarnos su servicio, estos proveedores:',
            {
              list: [
                'Proveedores de alojamiento web y de base de datos, con servidores en la Unión Europea.',
                'El proveedor de envío de los correos del Club L’Atelier.',
                'La entidad bancaria que procesa los pagos, la empresa de transporte y el proveedor de los emails de los pedidos.',
              ],
            },
            'También pueden acceder nuestra asesoría, para la contabilidad y los impuestos, y las administraciones públicas cuando una ley lo exija.',
          ],
        },
        {
          id: 'transferencias',
          title: 'Transferencias internacionales',
          blocks: [
            'Algunos proveedores tienen su sede fuera del Espacio Económico Europeo. Aunque los datos se guardan en la Unión Europea, puede haber accesos desde fuera de ella. En ese caso, la transferencia se ampara en el Marco de Privacidad de Datos UE-EE. UU. o en las cláusulas contractuales tipo aprobadas por la Comisión Europea.',
          ],
        },
        {
          id: 'derechos',
          title: 'Tus derechos',
          blocks: [
            'Puedes ejercer en cualquier momento tus derechos de:',
            {
              list: [
                'acceso a tus datos;',
                'rectificación de los que sean inexactos;',
                'supresión;',
                'oposición al tratamiento;',
                'limitación del tratamiento;',
                'portabilidad;',
                'retirada del consentimiento, sin que afecte a lo tratado antes.',
              ],
            },
            'Escríbenos por email o por correo postal a la tienda ({storeAddress}) indicando qué derecho quieres ejercer. Si tenemos dudas sobre tu identidad, podremos pedirte que la acredites. Te responderemos en el plazo de un mes.',
            'No tomamos decisiones automatizadas ni elaboramos perfiles con efectos sobre ti.',
            'Si crees que no hemos tratado bien tus datos, puedes reclamar ante la [Agencia Española de Protección de Datos](https://www.aepd.es).',
          ],
        },
        {
          id: 'menores',
          title: 'Menores de edad',
          blocks: [
            'Para suscribirte al Club L’Atelier debes tener al menos 14 años, y para comprar, ser mayor de edad. Si eres menor de 14 años, no nos facilites tus datos.',
          ],
        },
        {
          id: 'medidas',
          title: 'Seguridad',
          blocks: [
            'Aplicamos medidas técnicas y organizativas adecuadas para proteger tus datos, como la conexión cifrada (HTTPS) y el acceso restringido a la información.',
          ],
        },
        {
          id: 'cambios',
          title: 'Cambios en esta política',
          blocks: [
            'Si cambia la forma en que tratamos tus datos, actualizaremos esta política y su fecha. Si el cambio es importante, te lo comunicaremos.',
          ],
        },
      ],
    },

    cookies: {
      title: 'Política de cookies',
      summary: 'Qué cookies usa esta web, para qué y cómo puedes gestionarlas.',
      sections: [
        {
          id: 'que-son',
          title: 'Qué son las cookies',
          blocks: [
            'Las cookies son pequeños archivos que una web guarda en tu navegador para recordar información entre una página y otra, como el idioma elegido o una sesión iniciada.',
          ],
        },
        {
          id: 'cookies-usadas',
          title: 'Qué cookies usamos',
          blocks: [
            'Esta web solo usa cookies técnicas, necesarias para que funcione. No usamos cookies de analítica, de publicidad ni de redes sociales, y las tipografías se sirven desde nuestro propio servidor, sin llamadas a terceros.',
            {
              table: {
                caption: 'Cookies de esta web',
                head: ['Cookie', 'Titular', 'Para qué sirve', 'Duración'],
                rows: [
                  [
                    'NEXT_LOCALE',
                    'Propia',
                    'Recordar el idioma que eliges.',
                    'Hasta que cierras el navegador',
                  ],
                  [
                    'atelier_aviso',
                    'Propia',
                    'Recordar que has aceptado las condiciones de la web, para no volver a preguntarte.',
                    '1 año',
                  ],
                ],
              },
            },
          ],
        },
        {
          id: 'consentimiento',
          title: 'Por qué no te pedimos consentimiento',
          blocks: [
            'Las cookies técnicas, y las que guardan una preferencia que tú eliges, como el idioma, están exentas de consentimiento según el artículo 22.2 de la LSSI y la guía de la Agencia Española de Protección de Datos. Por eso no te pedimos que aceptes cookies: el aviso que ves al entrar es para que conozcas nuestras condiciones.',
            'Si en el futuro usamos cookies de analítica o de publicidad, te pediremos permiso antes de instalarlas, con la opción de rechazarlas tan fácilmente como aceptarlas, y actualizaremos esta política.',
          ],
        },
        {
          id: 'gestionar',
          title: 'Cómo bloquearlas o borrarlas',
          blocks: [
            'Puedes bloquear o borrar las cookies desde la configuración de tu navegador. Si bloqueas la del idioma, la web te mostrará el idioma por defecto en cada visita.',
            {
              list: [
                '[Google Chrome](https://support.google.com/chrome/answer/95647)',
                '[Mozilla Firefox](https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox)',
                '[Safari](https://support.apple.com/guide/safari/sfri11471/mac)',
                '[Microsoft Edge](https://support.microsoft.com/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09)',
              ],
            },
          ],
        },
        {
          id: 'mas',
          title: 'Más información',
          blocks: [
            'Cómo tratamos tus datos personales se explica en la [política de privacidad](doc:privacy).',
          ],
        },
      ],
    },

    shipping: {
      title: 'Envíos y devoluciones',
      summary:
        'Dónde y cuándo enviamos, cuánto cuesta y cómo devolver un pedido.',
      sections: [
        {
          id: 'zonas',
          title: 'Dónde enviamos',
          blocks: [
            'Enviamos a {shippingZones}.',
            'Los perfumes con alcohol son líquidos inflamables y su transporte, sobre todo por avión, tiene restricciones. Por eso algunos destinos pueden no estar disponibles: al hacer el pedido solo verás los que lo están.',
          ],
        },
        {
          id: 'recogida',
          title: 'Recogida en la tienda',
          blocks: [
            'Si lo prefieres, puedes recoger el pedido gratis en la tienda, en {storeAddress}, cuando te avisemos de que está listo. Trae el número de pedido; si viene otra persona, que traiga también tu autorización.',
          ],
        },
        {
          id: 'plazos',
          title: 'Gastos y plazos de entrega',
          blocks: [
            {
              list: [
                'Gastos de envío: {shippingCost}.',
                'Envío gratis a partir de {freeShippingFrom}.',
                'Plazo habitual: {deliveryTime} desde la confirmación del pedido.',
                'Transportista: {carrier}.',
              ],
            },
            'Verás siempre los gastos de envío y el total antes de pagar. En ningún caso la entrega superará los 30 días desde la confirmación, salvo que lo acordemos contigo.',
          ],
        },
        {
          id: 'recepcion',
          title: 'Al recibir el pedido',
          blocks: [
            'Comprueba el paquete delante del repartidor. Si está abierto o dañado, anótalo en el albarán de entrega o recházalo, y avísanos cuanto antes con fotos para resolverlo con el transportista.',
          ],
        },
        {
          id: 'desistimiento',
          title: 'Derecho de desistimiento: 14 días',
          blocks: [
            'Puedes desistir de la compra sin dar explicaciones en un plazo de 14 días naturales desde el día en que tú, o la persona que indiques (distinta del transportista), recibís el pedido. Si los productos llegan en entregas separadas, el plazo cuenta desde la última.',
            'Para desistir, comunícanoslo de forma clara antes de que acabe el plazo, por email o por correo postal a la tienda ({storeAddress}). Puedes usar el [formulario de desistimiento](doc:shipping#formulario), aunque no es obligatorio.',
          ],
        },
        {
          id: 'precintados',
          title: 'Perfumes precintados',
          blocks: [
            'Por ley (artículo 103.e del texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios), el derecho de desistimiento no se aplica a los productos precintados que no son aptos para devolverse por motivos de protección de la salud o de higiene y que se han desprecintado después de la entrega.',
            'En un perfume, esto significa que, si retiras el precinto o el celofán del estuche, o lo usas, ya no podrás desistir de su compra. Esto no afecta a la garantía: si el producto llega defectuoso, consulta el apartado de [productos dañados o equivocados](doc:shipping#defectos).',
          ],
        },
        {
          id: 'devolver',
          title: 'Cómo devolver el producto',
          blocks: [
            'Envíanos el producto, con su embalaje y precinto originales, sin demora indebida y como máximo 14 días naturales después de comunicarnos que desistes. Puedes enviarlo o traerlo a la tienda, en {storeAddress}.',
            'Los gastos de devolución corren de tu cuenta. Embálalo bien y usa un transportista que acepte perfumes. Solo respondes de la pérdida de valor del producto si se debe a una manipulación distinta de la necesaria para ver cómo es.',
          ],
        },
        {
          id: 'reembolso',
          title: 'Reembolso',
          blocks: [
            'Te devolveremos todo lo que hayas pagado, incluidos los gastos de envío ordinarios (no el coste adicional si elegiste un envío más caro), en un máximo de 14 días naturales desde que nos comuniques que desistes. Usaremos el mismo medio de pago, sin ningún coste para ti.',
            'Podemos esperar a reembolsarte hasta recibir el producto o hasta que nos envíes el justificante de que lo has enviado, lo que ocurra primero.',
          ],
        },
        {
          id: 'defectos',
          title: 'Productos dañados, defectuosos o equivocados',
          blocks: [
            'Si el producto llega roto, con fugas, defectuoso o no es el que pediste, escríbenos con el número de pedido y fotos. Te lo cambiaremos o te devolveremos el importe, y los gastos correrán de nuestra cuenta. Además, tienes la garantía legal de 3 años explicada en las [condiciones de venta](doc:terms#garantia).',
          ],
        },
        {
          id: 'cambios',
          title: 'Cambios de producto',
          blocks: [
            'Si quieres otro perfume, devuelve el que compraste dentro del plazo de desistimiento (si sigue precintado) y haz un pedido nuevo.',
          ],
        },
        {
          id: 'formulario',
          title: 'Modelo de formulario de desistimiento',
          blocks: [
            '(Solo debe cumplimentar y enviar el presente formulario si desea desistir del contrato.)',
            'A la atención de L’Atelier du Désert, {storeAddress}:',
            {
              list: [
                'Por la presente le comunico/comunicamos (*) que desisto de mi/desistimos de nuestro (*) contrato de venta del siguiente bien (*):',
                'Pedido el / recibido el (*):',
                'Nombre del consumidor o de los consumidores:',
                'Domicilio del consumidor o de los consumidores:',
                'Firma del consumidor o de los consumidores (solo si el presente formulario se presenta en papel):',
                'Fecha:',
              ],
            },
            '(*) Táchese lo que no proceda.',
          ],
        },
      ],
    },
  },
};
