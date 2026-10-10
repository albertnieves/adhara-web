import type { LegalCopy } from '../domain/types';

/** Textos legals en català: les mateixes seccions que es.ts. */
export const ca: LegalCopy = {
  ui: {
    eyebrow: 'Informació legal',
    updated: 'Darrera actualització',
    contents: 'En aquesta pàgina',
    pending: 'Pendent',
    related: 'Altres textos legals',
  },
  fields: {
    holder: 'titular (raó social o nom)',
    taxId: 'NIF',
    registeredAddress: 'domicili social',
    registry: 'dades registrals',
    email: 'correu de contacte',
    phone: 'telèfon',
    domain: 'domini del web',
    storeAddress: 'adreça de la botiga',
    shippingZones: 'zones d’enviament',
    shippingCost: 'tarifa d’enviament',
    freeShippingFrom: 'import per a l’enviament gratuït',
    deliveryTime: 'termini de lliurament',
    carrier: 'empresa de transport',
    paymentMethods: 'mitjans de pagament',
    arbitration: 'adhesió a l’arbitratge de consum',
  },
  documents: {
    legalNotice: {
      title: 'Avís legal',
      summary:
        'Qui hi ha darrere d’aquest web i en quines condicions el pots fer servir.',
      sections: [
        {
          id: 'titular',
          title: 'Dades del titular',
          blocks: [
            'En compliment de l’article 10 de la Llei 34/2002, d’11 de juliol, de serveis de la societat de la informació i de comerç electrònic (LSSI), aquestes són les dades del titular d’aquest web:',
            {
              list: [
                'Titular: {holder}',
                'Nom comercial: L’Atelier du Désert',
                'NIF: {taxId}',
                'Domicili social: {registeredAddress}',
                'Botiga: {storeAddress}',
                'Correu electrònic: {email}',
                'Telèfon: {phone}',
                'Dades registrals: {registry}',
                'Web: {domain}',
              ],
            },
          ],
        },
        {
          id: 'objeto',
          title: 'Objecte i acceptació',
          blocks: [
            'Aquest web dona a conèixer la perfumeria àrab de L’Atelier du Désert i la seva botiga de Castelldefels: la col·lecció, el catàleg olfactiu i la compra en línia.',
            'Navegar pel web implica acceptar aquest avís legal. Les compres es regeixen, a més, per les [condicions de venda](doc:terms) i per la pàgina d’[enviaments i devolucions](doc:shipping).',
          ],
        },
        {
          id: 'uso',
          title: 'Ús del web',
          blocks: [
            'Et comprometes a fer servir el web de manera lícita i d’acord amb aquest avís. En particular, no has de:',
            {
              list: [
                'fer-lo servir per a finalitats il·lícites o que perjudiquin tercers;',
                'introduir-hi virus o qualsevol codi que el pugui danyar;',
                'intentar accedir a zones restringides o a dades d’altres persones;',
                'copiar o extreure’n els continguts de manera massiva.',
              ],
            },
            'Podem interrompre l’accés per manteniment, per seguretat o per causes tècniques, i procurarem que sigui el mínim temps possible.',
          ],
        },
        {
          id: 'propiedad',
          title: 'Propietat intel·lectual i industrial',
          blocks: [
            'El nom L’Atelier du Désert, el seu logotip, el disseny del web, els textos propis i el codi pertanyen al titular d’aquest web o es fan servir amb llicència. No els pots reproduir, distribuir ni transformar sense autorització.',
            'Els noms, les marques i les imatges dels perfums pertanyen a les seves cases respectives. Es fan servir només per identificar els productes que es venen a la botiga, sense que això suposi cap relació diferent de la de revenedor.',
          ],
        },
        {
          id: 'productos',
          title: 'Informació dels productes',
          blocks: [
            'Les notes, les famílies i la resta de dades olfactives provenen de la fitxa oficial de cada casa o del seu distribuïdor oficial, i així s’indica a cada perfum. La percepció d’una fragància és personal i pot variar segons la pell.',
            'Les fotos són orientatives: de vegades les cases canvien l’envàs o la capsa sense avís. Si detectes un error, escriu-nos i el corregirem.',
          ],
        },
        {
          id: 'enlaces',
          title: 'Enllaços a altres webs',
          blocks: [
            'El web pot enllaçar-ne d’altres, com les nostres xarxes socials. No en controlem el contingut ni les polítiques, de què respon cada titular.',
          ],
        },
        {
          id: 'responsabilidad',
          title: 'Responsabilitat',
          blocks: [
            'Posem els mitjans raonables perquè el web funcioni bé i sigui segur, però no podem garantir que no hi hagi interrupcions o errors aliens al nostre control. Res d’aquest avís limita els drets que la llei et reconeix com a consumidor.',
          ],
        },
        {
          id: 'datos',
          title: 'Dades personals i galetes',
          blocks: [
            'Com tractem les teves dades s’explica a la [política de privacitat](doc:privacy), i quines galetes fa servir el web, a la [política de galetes](doc:cookies).',
          ],
        },
        {
          id: 'ley',
          title: 'Llei aplicable i jurisdicció',
          blocks: [
            'Aquest avís es regeix per la llei espanyola. Si ets consumidor, pots adreçar-te als jutjats del teu domicili.',
          ],
        },
      ],
    },

    terms: {
      title: 'Condicions de venda',
      summary:
        'Les condicions que s’apliquen a les compres que facis en aquest web.',
      sections: [
        {
          id: 'partes',
          title: 'Qui ven i a qui',
          blocks: [
            'El venedor és el titular d’aquest web, L’Atelier du Désert, les dades del qual figuren a l’[avís legal](doc:legalNotice#titular).',
            'Aquestes condicions s’apliquen a les compres fetes al web per persones majors d’edat, amb lliurament a domicili o recollida a la botiga. En fer la comanda acceptes la versió vigent en aquell moment, que t’enviem amb la confirmació.',
          ],
        },
        {
          id: 'productos',
          title: 'Productes',
          blocks: [
            'Venem perfums, olis perfumats i altres articles de perfumeria de cases de l’Orient Mitjà. Cada fitxa indica la casa, el nom, la concentració, el format en mil·lilitres i el preu. Les notes olfactives provenen de la casa o del seu distribuïdor oficial.',
            'Les fotos són orientatives i l’envàs pot canviar segons el lot. La disponibilitat que veus al web es confirma en fer la comanda.',
            {
              note: 'Són productes cosmètics d’ús extern. Llegeix les precaucions de l’envàs, no els apliquis sobre pell irritada, mantén-los fora de l’abast dels infants i lluny del foc: els perfums amb alcohol són inflamables. Si tens la pell sensible, prova’ls primer en una zona petita.',
            },
          ],
        },
        {
          id: 'precios',
          title: 'Preus',
          blocks: [
            'Els preus són en euros i inclouen l’IVA. Les despeses d’enviament no hi són incloses: s’indiquen abans de pagar i s’expliquen a [enviaments i devolucions](doc:shipping).',
            'S’aplica el preu que apareix en fer la comanda. Quan anunciem una rebaixa, el preu anterior que mostrem és el més baix dels 30 dies previs.',
            'Si per un error evident un preu no es correspon amb el real (per exemple, 0 € o un preu irrisori), t’avisarem abans d’enviar la comanda i podràs confirmar-la amb el preu correcte o cancel·lar-la sense cost.',
          ],
        },
        {
          id: 'pedido',
          title: 'Com es fa una comanda',
          blocks: [
            {
              ordered: true,
              list: [
                'Tria el perfum i el format i afegeix-lo a la cistella.',
                'Revisa la cistella i indica les teves dades de contacte i de lliurament, o la recollida a la botiga.',
                'Comprova el resum: productes, despeses d’enviament i preu total. Fins a aquest moment pots corregir qualsevol dada.',
                'Accepta aquestes condicions i prem el botó de comanda amb obligació de pagament.',
                'Paga a la pàgina segura del banc.',
              ],
            },
            'En acabar t’enviarem un correu amb la confirmació de la comanda i aquestes condicions. El contracte es pot formalitzar en castellà, català o anglès. Desem la comanda en format electrònic i ens en pots demanar una còpia.',
          ],
        },
        {
          id: 'pago',
          title: 'Pagament i factura',
          blocks: [
            'Mitjans de pagament: {paymentMethods}.',
            'El pagament amb targeta es fa a la pàgina segura del banc, amb autenticació reforçada (3D Secure). Mai no veiem ni desem les dades de la teva targeta. El càrrec es fa en confirmar la comanda.',
            'Emetem factura de cada comanda. Si la necessites a nom d’una empresa, indica’ns-en les dades fiscals en fer la comanda.',
          ],
        },
        {
          id: 'disponibilidad',
          title: 'Si un producte no està disponible',
          blocks: [
            'Si després de pagar no poguéssim servir un producte per manca d’existències, t’avisarem i et retornarem sense demora el que hagis pagat per aquest producte, amb el mateix mitjà de pagament.',
          ],
        },
        {
          id: 'entrega',
          title: 'Lliurament',
          blocks: [
            'Les zones, els terminis i les despeses d’enviament es detallen a [enviaments i devolucions](doc:shipping). Llevat que acordem una altra cosa, lliurarem la comanda en un màxim de 30 dies des de la confirmació.',
            'Els productes viatgen sota la nostra responsabilitat fins que tu, o la persona que indiquis, els rebeu.',
          ],
        },
        {
          id: 'desistimiento',
          title: 'Dret de desistiment',
          blocks: [
            'Tens 14 dies naturals des que reps la comanda per desistir de la compra sense donar explicacions, excepte en els productes precintats que s’hagin desprecintat després del lliurament, que per motius d’higiene i de protecció de la salut no admeten devolució. Les condicions, els terminis i el formulari són a [enviaments i devolucions](doc:shipping#desistimiento).',
          ],
        },
        {
          id: 'garantia',
          title: 'Garantia',
          blocks: [
            'Responem de qualsevol manca de conformitat dels productes durant 3 anys des del lliurament, d’acord amb el text refós de la Llei general per a la defensa dels consumidors i usuaris. Si el defecte apareix durant els 2 primers anys, es presumeix que ja existia en lliurar-lo.',
            'Si un producte arriba trencat, defectuós o no és el que vas demanar, pots demanar que el substituïm o, si no és possible, el retorn de l’import. Et demanem que ens avisis com més aviat millor, amb fotos, per gestionar-ho també amb el transportista. Aquestes despeses van a càrrec nostre.',
          ],
        },
        {
          id: 'atencion',
          title: 'Atenció al client i reclamacions',
          blocks: [
            'Ens pots contactar per aquestes vies. Respondrem les reclamacions al més aviat possible i com a màxim en un mes.',
            {
              list: [
                'Correu electrònic: {email}',
                'Telèfon: {phone}',
                'Botiga: {storeAddress}',
              ],
            },
            'Tens a la teva disposició fulls oficials de queixa, reclamació i denúncia a la botiga, i també ens els pots demanar per correu. Pots adreçar-te a l’oficina municipal d’informació al consumidor del teu municipi o a l’[Agència Catalana del Consum](https://consum.gencat.cat).',
            'Arbitratge de consum: {arbitration}.',
          ],
        },
        {
          id: 'ley',
          title: 'Llei aplicable i jurisdicció',
          blocks: [
            'Aquestes condicions es regeixen per la llei espanyola i, en allò que correspongui, pel Codi de consum de Catalunya. Si ets consumidor, pots adreçar-te als jutjats del teu domicili.',
          ],
        },
        {
          id: 'cambios',
          title: 'Canvis en aquestes condicions',
          blocks: [
            'Podem actualitzar aquestes condicions. A cada comanda s’hi apliquen les vigents en el moment de fer-la.',
          ],
        },
      ],
    },

    privacy: {
      title: 'Política de privacitat',
      summary:
        'Quines dades personals tractem, per a què, durant quant de temps i quins drets tens.',
      sections: [
        {
          id: 'responsable',
          title: 'Responsable del tractament',
          blocks: [
            {
              list: [
                'Responsable: L’Atelier du Désert',
                'Titular: {holder}',
                'NIF: {taxId}',
                'Domicili: {registeredAddress}',
                'Correu per a qüestions de privacitat: {email}',
              ],
            },
            'Per a qualsevol qüestió sobre les teves dades, ens pots escriure per correu electrònic o per correu postal a la botiga, a {storeAddress}.',
          ],
        },
        {
          id: 'club',
          title: 'Club L’Atelier: promocions per correu',
          blocks: [
            {
              list: [
                'Dades: el teu correu, l’idioma del web i la data i la versió del text que vas acceptar.',
                'Finalitat: enviar-te promocions, descomptes i novetats de la botiga.',
                'Base jurídica: el teu consentiment, que dones marcant la casella del formulari (art. 6.1.a del RGPD i art. 21 de la LSSI).',
                'Conservació: fins que et donis de baixa. Després en conservem bloquejat el registre de l’alta i de la baixa el temps necessari per acreditar que comptàvem amb el teu consentiment.',
              ],
            },
            'Et pots donar de baixa en qualsevol moment amb l’enllaç que inclou cada correu o escrivint-nos.',
          ],
        },
        {
          id: 'consultas',
          title: 'Consultes i atenció al client',
          blocks: [
            {
              list: [
                'Dades: les que ens donis en escriure’ns o trucar-nos (nom, correu, telèfon i el teu missatge).',
                'Finalitat: respondre’t i atendre la teva consulta o reclamació.',
                'Base jurídica: el nostre interès legítim a atendre’t o, si ens demanes informació abans de comprar, l’aplicació de mesures precontractuals.',
                'Conservació: el temps necessari per resoldre-la i, després, bloquejades durant els terminis de prescripció de possibles responsabilitats.',
              ],
            },
          ],
        },
        {
          id: 'pedidos',
          title: 'Comandes en línia',
          blocks: [
            {
              list: [
                'Dades: nom, correu, telèfon, adreça de lliurament i, si demanes factura a nom d’una empresa, les seves dades fiscals; productes, imports i estat del pagament. Les dades de la teva targeta les tracta el banc: nosaltres no les rebem.',
                'Finalitat: gestionar la comanda, el pagament, el lliurament, les devolucions i la garantia, i emetre la factura.',
                'Base jurídica: l’execució del contracte de compravenda (art. 6.1.b del RGPD) i el compliment d’obligacions legals fiscals i comptables (art. 6.1.c).',
                'Conservació: mentre duri la relació i, després, 6 anys per la normativa mercantil i els terminis que exigeixi la normativa fiscal.',
              ],
            },
          ],
        },
        {
          id: 'seguridad-web',
          title: 'Funcionament i seguretat del web',
          blocks: [
            {
              list: [
                'Dades: adreça IP, navegador i data d’accés, que registra el servidor.',
                'Finalitat: que el web funcioni i protegir-lo d’abusos i atacs.',
                'Base jurídica: el nostre interès legítim a mantenir el web segur.',
                'Conservació: períodes curts, segons la configuració del proveïdor d’allotjament.',
              ],
            },
          ],
        },
        {
          id: 'destinatarios',
          title: 'Qui accedeix a les teves dades',
          blocks: [
            'No venem ni cedim les teves dades. Només hi accedeixen, amb contracte d’encàrrec de tractament i només per prestar-nos el seu servei, aquests proveïdors:',
            {
              list: [
                'Proveïdors d’allotjament web i de base de dades, amb servidors a la Unió Europea.',
                'El proveïdor d’enviament dels correus del Club L’Atelier.',
                'L’entitat bancària que processa els pagaments, l’empresa de transport i el proveïdor dels correus de les comandes.',
              ],
            },
            'També hi poden accedir la nostra assessoria, per a la comptabilitat i els impostos, i les administracions públiques quan una llei ho exigeixi.',
          ],
        },
        {
          id: 'transferencias',
          title: 'Transferències internacionals',
          blocks: [
            'Alguns proveïdors tenen la seu fora de l’Espai Econòmic Europeu. Tot i que les dades es desen a la Unió Europea, hi pot haver accessos des de fora. En aquest cas, la transferència s’empara en el Marc de Privacitat de Dades UE-EUA o en les clàusules contractuals tipus aprovades per la Comissió Europea.',
          ],
        },
        {
          id: 'derechos',
          title: 'Els teus drets',
          blocks: [
            'Pots exercir en qualsevol moment els teus drets de:',
            {
              list: [
                'accés a les teves dades;',
                'rectificació de les que siguin inexactes;',
                'supressió;',
                'oposició al tractament;',
                'limitació del tractament;',
                'portabilitat;',
                'retirada del consentiment, sense que afecti el que s’ha tractat abans.',
              ],
            },
            'Escriu-nos per correu electrònic o per correu postal a la botiga ({storeAddress}) indicant quin dret vols exercir. Si tenim dubtes sobre la teva identitat, et podrem demanar que l’acreditis. Et respondrem en el termini d’un mes.',
            'No prenem decisions automatitzades ni elaborem perfils amb efectes sobre tu.',
            'Si creus que no hem tractat bé les teves dades, pots reclamar davant l’[Agència Espanyola de Protecció de Dades](https://www.aepd.es).',
          ],
        },
        {
          id: 'menores',
          title: 'Menors d’edat',
          blocks: [
            'Per subscriure’t al Club L’Atelier has de tenir com a mínim 14 anys, i per comprar, ser major d’edat. Si tens menys de 14 anys, no ens facilitis les teves dades.',
          ],
        },
        {
          id: 'medidas',
          title: 'Seguretat',
          blocks: [
            'Apliquem mesures tècniques i organitzatives adequades per protegir les teves dades, com ara la connexió xifrada (HTTPS) i l’accés restringit a la informació.',
          ],
        },
        {
          id: 'cambios',
          title: 'Canvis en aquesta política',
          blocks: [
            'Si canvia la manera com tractem les teves dades, actualitzarem aquesta política i la seva data. Si el canvi és important, t’ho comunicarem.',
          ],
        },
      ],
    },

    cookies: {
      title: 'Política de galetes',
      summary:
        'Quines galetes fa servir aquest web, per a què i com les pots gestionar.',
      sections: [
        {
          id: 'que-son',
          title: 'Què són les galetes',
          blocks: [
            'Les galetes (cookies) són petits fitxers que un web desa al teu navegador per recordar informació d’una pàgina a una altra, com l’idioma triat o una sessió iniciada.',
          ],
        },
        {
          id: 'cookies-usadas',
          title: 'Quines galetes fem servir',
          blocks: [
            'Aquest web només fa servir galetes tècniques, necessàries perquè funcioni. No fem servir galetes d’analítica, de publicitat ni de xarxes socials, i les tipografies se serveixen des del nostre servidor, sense crides a tercers.',
            {
              table: {
                caption: 'Galetes d’aquest web',
                head: ['Galeta', 'Titular', 'Per a què serveix', 'Durada'],
                rows: [
                  [
                    'NEXT_LOCALE',
                    'Pròpia',
                    'Recordar l’idioma que tries.',
                    'Fins que tanques el navegador',
                  ],
                  [
                    'atelier_aviso',
                    'Pròpia',
                    'Recordar que has acceptat les condicions del web, per no tornar-te-les a demanar.',
                    '1 any',
                  ],
                ],
              },
            },
          ],
        },
        {
          id: 'consentimiento',
          title: 'Per què no et demanem consentiment',
          blocks: [
            'Les galetes tècniques, i les que desen una preferència que tries tu, com l’idioma, estan exemptes de consentiment segons l’article 22.2 de la LSSI i la guia de l’Agència Espanyola de Protecció de Dades. Per això no et demanem que acceptis galetes: l’avís que veus en entrar és perquè coneguis les nostres condicions.',
            'Si en el futur fem servir galetes d’analítica o de publicitat, et demanarem permís abans d’instal·lar-les, amb l’opció de rebutjar-les tan fàcilment com acceptar-les, i actualitzarem aquesta política.',
          ],
        },
        {
          id: 'gestionar',
          title: 'Com bloquejar-les o esborrar-les',
          blocks: [
            'Pots bloquejar o esborrar les galetes des de la configuració del navegador. Si bloqueges la de l’idioma, el web et mostrarà l’idioma per defecte a cada visita.',
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
          title: 'Més informació',
          blocks: [
            'Com tractem les teves dades personals s’explica a la [política de privacitat](doc:privacy).',
          ],
        },
      ],
    },

    shipping: {
      title: 'Enviaments i devolucions',
      summary: 'On i quan enviem, quant costa i com retornar una comanda.',
      sections: [
        {
          id: 'zonas',
          title: 'On enviem',
          blocks: [
            'Enviem a {shippingZones}.',
            'Els perfums amb alcohol són líquids inflamables i el seu transport, sobretot per avió, té restriccions. Per això algunes destinacions poden no estar disponibles: en fer la comanda només veuràs les que ho estan.',
          ],
        },
        {
          id: 'recogida',
          title: 'Recollida a la botiga',
          blocks: [
            'Si ho prefereixes, pots recollir la comanda gratis a la botiga, a {storeAddress}, quan t’avisem que està a punt. Porta el número de comanda; si ve una altra persona, que porti també la teva autorització.',
          ],
        },
        {
          id: 'plazos',
          title: 'Despeses i terminis de lliurament',
          blocks: [
            {
              list: [
                'Despeses d’enviament: {shippingCost}.',
                'Enviament gratuït a partir de {freeShippingFrom}.',
                'Termini habitual: {deliveryTime} des de la confirmació de la comanda.',
                'Transportista: {carrier}.',
              ],
            },
            'Sempre veuràs les despeses d’enviament i el total abans de pagar. En cap cas el lliurament superarà els 30 dies des de la confirmació, llevat que ho acordem amb tu.',
          ],
        },
        {
          id: 'recepcion',
          title: 'En rebre la comanda',
          blocks: [
            'Comprova el paquet davant del repartidor. Si està obert o malmès, anota-ho a l’albarà de lliurament o rebutja’l, i avisa’ns com més aviat millor amb fotos per resoldre-ho amb el transportista.',
          ],
        },
        {
          id: 'desistimiento',
          title: 'Dret de desistiment: 14 dies',
          blocks: [
            'Pots desistir de la compra sense donar explicacions en un termini de 14 dies naturals des del dia que tu, o la persona que indiquis (diferent del transportista), rebeu la comanda. Si els productes arriben en lliuraments separats, el termini compta des de l’últim.',
            'Per desistir, comunica’ns-ho de manera clara abans que s’acabi el termini, per correu electrònic o per correu postal a la botiga ({storeAddress}). Pots fer servir el [formulari de desistiment](doc:shipping#formulario), tot i que no és obligatori.',
          ],
        },
        {
          id: 'precintados',
          title: 'Perfums precintats',
          blocks: [
            'Per llei (article 103.e del text refós de la Llei general per a la defensa dels consumidors i usuaris), el dret de desistiment no s’aplica als productes precintats que no són aptes per ser retornats per motius de protecció de la salut o d’higiene i que s’han desprecintat després del lliurament.',
            'En un perfum, això vol dir que, si retires el precinte o el cel·lofana de l’estoig, o el fas servir, ja no podràs desistir de la compra. Això no afecta la garantia: si el producte arriba defectuós, consulta l’apartat de [productes malmesos o equivocats](doc:shipping#defectos).',
          ],
        },
        {
          id: 'devolver',
          title: 'Com retornar el producte',
          blocks: [
            'Envia’ns el producte, amb l’embalatge i el precinte originals, sense demora indeguda i com a màxim 14 dies naturals després de comunicar-nos que desisteixes. El pots enviar o portar a la botiga, a {storeAddress}.',
            'Les despeses de devolució van a càrrec teu. Embala’l bé i fes servir un transportista que accepti perfums. Només respons de la pèrdua de valor del producte si es deu a una manipulació diferent de la necessària per veure com és.',
          ],
        },
        {
          id: 'reembolso',
          title: 'Reemborsament',
          blocks: [
            'Et retornarem tot el que hagis pagat, incloses les despeses d’enviament ordinàries (no el cost addicional si vas triar un enviament més car), en un màxim de 14 dies naturals des que ens comuniquis que desisteixes. Farem servir el mateix mitjà de pagament, sense cap cost per a tu.',
            'Podem esperar a reemborsar-te fins a rebre el producte o fins que ens enviïs el justificant que l’has enviat, el que passi primer.',
          ],
        },
        {
          id: 'defectos',
          title: 'Productes malmesos, defectuosos o equivocats',
          blocks: [
            'Si el producte arriba trencat, amb fuites, defectuós o no és el que vas demanar, escriu-nos amb el número de comanda i fotos. Te’l canviarem o et retornarem l’import, i les despeses aniran a càrrec nostre. A més, tens la garantia legal de 3 anys explicada a les [condicions de venda](doc:terms#garantia).',
          ],
        },
        {
          id: 'cambios',
          title: 'Canvis de producte',
          blocks: [
            'Si vols un altre perfum, retorna el que vas comprar dins del termini de desistiment (si continua precintat) i fes una comanda nova.',
          ],
        },
        {
          id: 'formulario',
          title: 'Model de formulari de desistiment',
          blocks: [
            '(Només cal emplenar i enviar aquest formulari si voleu desistir del contracte.)',
            'A l’atenció de L’Atelier du Désert, {storeAddress}:',
            {
              list: [
                'Per la present us comunico/comuniquem (*) que desisteixo del meu/desistim del nostre (*) contracte de venda del bé següent (*):',
                'Demanat el / rebut el (*):',
                'Nom del consumidor o dels consumidors:',
                'Domicili del consumidor o dels consumidors:',
                'Signatura del consumidor o dels consumidors (només si aquest formulari es presenta en paper):',
                'Data:',
              ],
            },
            '(*) Ratlleu el que no correspongui.',
          ],
        },
      ],
    },
  },
};
