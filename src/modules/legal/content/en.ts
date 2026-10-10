import type { LegalCopy } from '../domain/types';

/** Textos legales en inglés: las mismas secciones que es.ts. */
export const en: LegalCopy = {
  ui: {
    eyebrow: 'Legal information',
    updated: 'Last updated',
    contents: 'On this page',
    pending: 'Pending',
    related: 'Other legal texts',
  },
  fields: {
    holder: 'owner (company or full name)',
    taxId: 'tax ID (NIF)',
    registeredAddress: 'address',
    registry: 'registration details',
    email: 'contact email',
    phone: 'phone',
    domain: 'website domain',
    storeAddress: 'shop address',
    shippingZones: 'shipping areas',
    shippingCost: 'shipping rate',
    freeShippingFrom: 'free shipping threshold',
    deliveryTime: 'delivery time',
    carrier: 'carrier',
    paymentMethods: 'payment methods',
    arbitration: 'consumer arbitration membership',
  },
  documents: {
    legalNotice: {
      title: 'Legal notice',
      summary: 'Who is behind this website and the terms for using it.',
      sections: [
        {
          id: 'titular',
          title: 'Owner details',
          blocks: [
            'In accordance with article 10 of Spanish Law 34/2002 of 11 July on information society services and electronic commerce (LSSI), these are the details of the owner of this website:',
            {
              list: [
                'Owner: {holder}',
                'Trade name: L’Atelier du Désert',
                'Tax ID (NIF): {taxId}',
                'Address: {registeredAddress}',
                'Shop: {storeAddress}',
                'Email: {email}',
                'Phone: {phone}',
                'Registration details: {registry}',
                'Website: {domain}',
              ],
            },
          ],
        },
        {
          id: 'objeto',
          title: 'Purpose and acceptance',
          blocks: [
            'This website presents the Arabian perfumery of L’Atelier du Désert and its shop in Castelldefels: its collection, the scent catalogue and online shopping.',
            'By browsing the website you accept this legal notice. Purchases are also governed by the [terms of sale](doc:terms) and the [shipping and returns](doc:shipping) page.',
          ],
        },
        {
          id: 'uso',
          title: 'Use of the website',
          blocks: [
            'You agree to use the website lawfully and in accordance with this notice. In particular, you must not:',
            {
              list: [
                'use it for unlawful purposes or to harm others;',
                'introduce viruses or any code that could damage it;',
                'try to access restricted areas or other people’s data;',
                'copy or scrape its content on a large scale.',
              ],
            },
            'We may interrupt access for maintenance, security or technical reasons, keeping it as short as possible.',
          ],
        },
        {
          id: 'propiedad',
          title: 'Intellectual and industrial property',
          blocks: [
            'The name L’Atelier du Désert, its logo, the website design, its own texts and its code belong to the owner of this website or are used under licence. You may not reproduce, distribute or modify them without permission.',
            'The names, brands and images of the perfumes belong to their respective houses. They are used only to identify the products sold in the shop and imply no relationship other than that of a retailer.',
          ],
        },
        {
          id: 'productos',
          title: 'Product information',
          blocks: [
            'Notes, families and other scent details come from each house’s official product page or its official distributor, as stated for each perfume. How a fragrance is perceived is personal and may vary with your skin.',
            'Photos are for guidance only: houses sometimes change bottles or boxes without notice. If you spot a mistake, write to us and we will correct it.',
          ],
        },
        {
          id: 'enlaces',
          title: 'Links to other websites',
          blocks: [
            'The website may link to others, such as our social media. We do not control their content or policies, which are the responsibility of their owners.',
          ],
        },
        {
          id: 'responsabilidad',
          title: 'Liability',
          blocks: [
            'We take reasonable steps to keep the website working well and securely, but we cannot guarantee that there will be no interruptions or errors beyond our control. Nothing in this notice limits your statutory rights as a consumer.',
          ],
        },
        {
          id: 'datos',
          title: 'Personal data and cookies',
          blocks: [
            'How we process your data is explained in the [privacy policy](doc:privacy), and which cookies the website uses, in the [cookie policy](doc:cookies).',
          ],
        },
        {
          id: 'ley',
          title: 'Governing law and jurisdiction',
          blocks: [
            'This notice is governed by Spanish law. If you are a consumer, you may bring proceedings before the courts of your place of residence.',
          ],
        },
      ],
    },

    terms: {
      title: 'Terms of sale',
      summary: 'The terms that apply to purchases made on this website.',
      sections: [
        {
          id: 'partes',
          title: 'Who sells and to whom',
          blocks: [
            'The seller is the owner of this website, L’Atelier du Désert, whose details are set out in the [legal notice](doc:legalNotice#titular).',
            'These terms apply to purchases made on the website by adults, for home delivery or for collection in the shop. When you order, you accept the version in force at that time, which we send you with the confirmation.',
          ],
        },
        {
          id: 'productos',
          title: 'Products',
          blocks: [
            'We sell perfumes, perfume oils and other fragrance items from Middle Eastern houses. Each product page shows the house, name, concentration, size in millilitres and price. Scent notes come from the house or its official distributor.',
            'Photos are for guidance only and packaging may vary between batches. The availability shown on the website is confirmed when you order.',
            {
              note: 'These are cosmetic products for external use. Read the precautions on the packaging, do not apply them to irritated skin, keep them out of the reach of children and away from flames: perfumes containing alcohol are flammable. If you have sensitive skin, try them on a small area first.',
            },
          ],
        },
        {
          id: 'precios',
          title: 'Prices',
          blocks: [
            'Prices are in euros and include VAT. Shipping costs are not included: they are shown before you pay and explained in [shipping and returns](doc:shipping).',
            'The price shown when you place the order applies. When we announce a sale, the previous price we show is the lowest of the preceding 30 days.',
            'If, due to an obvious error, a price does not match the real one (for example, €0 or a ridiculously low price), we will let you know before shipping and you can confirm the order at the correct price or cancel it free of charge.',
          ],
        },
        {
          id: 'pedido',
          title: 'How to place an order',
          blocks: [
            {
              ordered: true,
              list: [
                'Choose the perfume and size and add it to your basket.',
                'Review your basket and enter your contact and delivery details, or choose collection in the shop.',
                'Check the summary: products, shipping costs and total price. Up to this point you can correct any detail.',
                'Accept these terms and press the order button with an obligation to pay.',
                'Pay on the bank’s secure page.',
              ],
            },
            'Once finished, we will email you the order confirmation and these terms. The contract can be concluded in Spanish, Catalan or English. We keep the order electronically and you can ask us for a copy.',
          ],
        },
        {
          id: 'pago',
          title: 'Payment and invoice',
          blocks: [
            'Payment methods: {paymentMethods}.',
            'Card payments are made on the bank’s secure page, with strong authentication (3D Secure). We never see or store your card details. The charge is made when the order is confirmed.',
            'We issue an invoice for every order. If you need it in a company’s name, give us its tax details when ordering.',
          ],
        },
        {
          id: 'disponibilidad',
          title: 'If a product is unavailable',
          blocks: [
            'If, after payment, we cannot supply a product because it is out of stock, we will let you know and refund what you paid for it without delay, using the same payment method.',
          ],
        },
        {
          id: 'entrega',
          title: 'Delivery',
          blocks: [
            'Shipping areas, times and costs are set out in [shipping and returns](doc:shipping). Unless we agree otherwise, we will deliver your order within 30 days of confirmation at the latest.',
            'Products travel at our risk until you, or the person you designate, receive them.',
          ],
        },
        {
          id: 'desistimiento',
          title: 'Right of withdrawal',
          blocks: [
            'You have 14 calendar days from receiving your order to withdraw from the purchase without giving any reason, except for sealed products that have been unsealed after delivery, which cannot be returned for health protection and hygiene reasons. Conditions, deadlines and the form are in [shipping and returns](doc:shipping#desistimiento).',
          ],
        },
        {
          id: 'garantia',
          title: 'Guarantee',
          blocks: [
            'We are liable for any lack of conformity of the products for 3 years from delivery, under the Spanish consumer protection act (TRLGDCU). If a defect appears within the first 2 years, it is presumed to have existed on delivery.',
            'If a product arrives broken, faulty or is not what you ordered, you can ask us to replace it or, if that is not possible, to refund it. Please let us know as soon as possible, with photos, so we can also deal with the carrier. We cover these costs.',
          ],
        },
        {
          id: 'atencion',
          title: 'Customer service and complaints',
          blocks: [
            'You can reach us through these channels. We will answer complaints as soon as possible and within one month at the latest.',
            {
              list: [
                'Email: {email}',
                'Phone: {phone}',
                'Shop: {storeAddress}',
              ],
            },
            'Official complaint forms (fulls oficials de queixa, reclamació i denúncia) are available in the shop and you can also ask us for them by email. You can contact your local consumer information office or the [Catalan Consumer Agency](https://consum.gencat.cat).',
            'Consumer arbitration: {arbitration}.',
          ],
        },
        {
          id: 'ley',
          title: 'Governing law and jurisdiction',
          blocks: [
            'These terms are governed by Spanish law and, where applicable, by the Consumer Code of Catalonia. If you are a consumer, you may bring proceedings before the courts of your place of residence.',
          ],
        },
        {
          id: 'cambios',
          title: 'Changes to these terms',
          blocks: [
            'We may update these terms. Each order is governed by the terms in force when it was placed.',
          ],
        },
      ],
    },

    privacy: {
      title: 'Privacy policy',
      summary:
        'What personal data we process, why, for how long and what your rights are.',
      sections: [
        {
          id: 'responsable',
          title: 'Data controller',
          blocks: [
            {
              list: [
                'Controller: L’Atelier du Désert',
                'Owner: {holder}',
                'Tax ID (NIF): {taxId}',
                'Address: {registeredAddress}',
                'Email for privacy matters: {email}',
              ],
            },
            'For any question about your data, you can email us or write to us at the shop, at {storeAddress}.',
          ],
        },
        {
          id: 'club',
          title: 'Club L’Atelier: promotional emails',
          blocks: [
            {
              list: [
                'Data: your email, the website language and the date and version of the text you accepted.',
                'Purpose: to send you promotions, discounts and news from the shop.',
                'Legal basis: your consent, given by ticking the box on the form (art. 6.1.a GDPR and art. 21 LSSI).',
                'Retention: until you unsubscribe. After that, we keep a blocked record of your subscription and unsubscription for as long as needed to prove we had your consent.',
              ],
            },
            'You can unsubscribe at any time using the link in every email or by writing to us.',
          ],
        },
        {
          id: 'consultas',
          title: 'Enquiries and customer service',
          blocks: [
            {
              list: [
                'Data: what you give us when you write or call (name, email, phone and your message).',
                'Purpose: to reply and deal with your enquiry or complaint.',
                'Legal basis: our legitimate interest in assisting you or, if you ask for information before buying, taking pre-contractual steps.',
                'Retention: as long as needed to resolve it and then blocked for the limitation periods of any possible liability.',
              ],
            },
          ],
        },
        {
          id: 'pedidos',
          title: 'Online orders',
          blocks: [
            {
              list: [
                'Data: name, email, phone, delivery address and, if you ask for an invoice in a company’s name, its tax details; products, amounts and payment status. Your card details are processed by the bank: we do not receive them.',
                'Purpose: to manage the order, payment, delivery, returns and guarantee, and to issue the invoice.',
                'Legal basis: performance of the sales contract (art. 6.1.b GDPR) and compliance with tax and accounting obligations (art. 6.1.c).',
                'Retention: for the duration of the relationship and then 6 years under commercial law and for the periods required by tax law.',
              ],
            },
          ],
        },
        {
          id: 'seguridad-web',
          title: 'Website operation and security',
          blocks: [
            {
              list: [
                'Data: IP address, browser and access time, logged by the server.',
                'Purpose: to keep the website running and protect it from abuse and attacks.',
                'Legal basis: our legitimate interest in keeping the website secure.',
                'Retention: short periods, according to the hosting provider’s settings.',
              ],
            },
          ],
        },
        {
          id: 'destinatarios',
          title: 'Who can access your data',
          blocks: [
            'We do not sell or share your data. Only these providers access it, under a data processing agreement and solely to provide their service to us:',
            {
              list: [
                'Web hosting and database providers, with servers in the European Union.',
                'The provider that sends Club L’Atelier emails.',
                'The bank that processes payments, the carrier and the provider of order emails.',
              ],
            },
            'Our accounting and tax advisers, and public authorities where required by law, may also have access.',
          ],
        },
        {
          id: 'transferencias',
          title: 'International transfers',
          blocks: [
            'Some providers are based outside the European Economic Area. Although the data is stored in the European Union, it may be accessed from outside it. In that case, the transfer is covered by the EU-US Data Privacy Framework or by the standard contractual clauses approved by the European Commission.',
          ],
        },
        {
          id: 'derechos',
          title: 'Your rights',
          blocks: [
            'At any time you can exercise your rights of:',
            {
              list: [
                'access to your data;',
                'rectification of inaccurate data;',
                'erasure;',
                'objection to processing;',
                'restriction of processing;',
                'portability;',
                'withdrawal of consent, without affecting earlier processing.',
              ],
            },
            'Email us or write to us at the shop ({storeAddress}) stating which right you want to exercise. If we have doubts about your identity, we may ask you to prove it. We will reply within one month.',
            'We do not make automated decisions or create profiles that affect you.',
            'If you think we have not handled your data properly, you can complain to the [Spanish Data Protection Agency](https://www.aepd.es).',
          ],
        },
        {
          id: 'menores',
          title: 'Minors',
          blocks: [
            'You must be at least 14 to join Club L’Atelier and an adult to buy. If you are under 14, please do not give us your data.',
          ],
        },
        {
          id: 'medidas',
          title: 'Security',
          blocks: [
            'We apply appropriate technical and organisational measures to protect your data, such as encrypted connections (HTTPS) and restricted access to information.',
          ],
        },
        {
          id: 'cambios',
          title: 'Changes to this policy',
          blocks: [
            'If the way we process your data changes, we will update this policy and its date. If the change is significant, we will let you know.',
          ],
        },
      ],
    },

    cookies: {
      title: 'Cookie policy',
      summary: 'Which cookies this website uses, why and how to manage them.',
      sections: [
        {
          id: 'que-son',
          title: 'What cookies are',
          blocks: [
            'Cookies are small files that a website stores in your browser to remember information between pages, such as your chosen language or a signed-in session.',
          ],
        },
        {
          id: 'cookies-usadas',
          title: 'Which cookies we use',
          blocks: [
            'This website only uses technical cookies that it needs to work. We do not use analytics, advertising or social media cookies, and fonts are served from our own server, without calls to third parties.',
            {
              table: {
                caption: 'Cookies on this website',
                head: ['Cookie', 'Owner', 'Purpose', 'Duration'],
                rows: [
                  [
                    'NEXT_LOCALE',
                    'Ours',
                    'Remember the language you choose.',
                    'Until you close the browser',
                  ],
                  [
                    'atelier_aviso',
                    'Ours',
                    'Remember that you accepted the website terms, so we do not ask again.',
                    '1 year',
                  ],
                ],
              },
            },
          ],
        },
        {
          id: 'consentimiento',
          title: 'Why we do not ask for consent',
          blocks: [
            'Technical cookies, and those that store a preference you choose, such as the language, are exempt from consent under article 22.2 of the LSSI and the guidance of the Spanish Data Protection Agency. That is why we do not ask you to accept cookies: the notice you see when you arrive is to let you know our terms.',
            'If we ever use analytics or advertising cookies, we will ask for your permission before setting them, with the option to reject them as easily as accept them, and we will update this policy.',
          ],
        },
        {
          id: 'gestionar',
          title: 'How to block or delete them',
          blocks: [
            'You can block or delete cookies in your browser settings. If you block the language cookie, the website will show the default language on each visit.',
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
          title: 'More information',
          blocks: [
            'How we process your personal data is explained in the [privacy policy](doc:privacy).',
          ],
        },
      ],
    },

    shipping: {
      title: 'Shipping and returns',
      summary:
        'Where and when we ship, what it costs and how to return an order.',
      sections: [
        {
          id: 'zonas',
          title: 'Where we ship',
          blocks: [
            'We ship to {shippingZones}.',
            'Perfumes containing alcohol are flammable liquids and their transport, especially by air, is restricted. Some destinations may therefore be unavailable: when ordering you will only see those that are.',
          ],
        },
        {
          id: 'recogida',
          title: 'Collection in the shop',
          blocks: [
            'If you prefer, you can collect your order free of charge at the shop, at {storeAddress}, once we tell you it is ready. Bring your order number; if someone else comes, they should also bring your authorisation.',
          ],
        },
        {
          id: 'plazos',
          title: 'Costs and delivery times',
          blocks: [
            {
              list: [
                'Shipping costs: {shippingCost}.',
                'Free shipping from {freeShippingFrom}.',
                'Usual delivery time: {deliveryTime} from order confirmation.',
                'Carrier: {carrier}.',
              ],
            },
            'You will always see the shipping costs and the total before paying. Delivery will never take more than 30 days from confirmation unless agreed with you.',
          ],
        },
        {
          id: 'recepcion',
          title: 'When your order arrives',
          blocks: [
            'Check the parcel in front of the courier. If it is open or damaged, note it on the delivery slip or refuse it, and let us know as soon as possible with photos so we can sort it out with the carrier.',
          ],
        },
        {
          id: 'desistimiento',
          title: 'Right of withdrawal: 14 days',
          blocks: [
            'You can withdraw from the purchase without giving any reason within 14 calendar days from the day you, or a person you designate (other than the carrier), receive the order. If the products arrive in separate deliveries, the period runs from the last one.',
            'To withdraw, tell us clearly before the period ends, by email or by post to the shop ({storeAddress}). You may use the [withdrawal form](doc:shipping#formulario), but it is not compulsory.',
          ],
        },
        {
          id: 'precintados',
          title: 'Sealed perfumes',
          blocks: [
            'By law (article 103.e of the Spanish consumer protection act), the right of withdrawal does not apply to sealed goods that are not suitable for return for health protection or hygiene reasons and have been unsealed after delivery.',
            'For a perfume, this means that if you remove the seal or the cellophane from the box, or use it, you can no longer withdraw from the purchase. This does not affect the guarantee: if the product arrives faulty, see [damaged or wrong products](doc:shipping#defectos).',
          ],
        },
        {
          id: 'devolver',
          title: 'How to return the product',
          blocks: [
            'Send us the product, in its original packaging and with its seal intact, without undue delay and no later than 14 calendar days after telling us you are withdrawing. You can send it or bring it to the shop at {storeAddress}.',
            'You bear the cost of returning it. Pack it well and use a carrier that accepts perfumes. You are only liable for any loss of value caused by handling beyond what is needed to see what the product is like.',
          ],
        },
        {
          id: 'reembolso',
          title: 'Refund',
          blocks: [
            'We will refund everything you paid, including standard shipping costs (not the extra cost if you chose a more expensive delivery), within 14 calendar days of being told you are withdrawing. We will use the same payment method, at no cost to you.',
            'We may withhold the refund until we receive the product or until you send us proof of shipping, whichever comes first.',
          ],
        },
        {
          id: 'defectos',
          title: 'Damaged, faulty or wrong products',
          blocks: [
            'If the product arrives broken, leaking, faulty or is not what you ordered, email us with your order number and photos. We will replace it or refund you, and we will cover the costs. You also have the 3-year legal guarantee explained in the [terms of sale](doc:terms#garantia).',
          ],
        },
        {
          id: 'cambios',
          title: 'Exchanges',
          blocks: [
            'If you would like a different perfume, return the one you bought within the withdrawal period (if it is still sealed) and place a new order.',
          ],
        },
        {
          id: 'formulario',
          title: 'Model withdrawal form',
          blocks: [
            '(Complete and return this form only if you wish to withdraw from the contract.)',
            'To L’Atelier du Désert, {storeAddress}:',
            {
              list: [
                'I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*):',
                'Ordered on / received on (*):',
                'Name of consumer(s):',
                'Address of consumer(s):',
                'Signature of consumer(s) (only if this form is notified on paper):',
                'Date:',
              ],
            },
            '(*) Delete as appropriate.',
          ],
        },
      ],
    },
  },
};
