import type { LegalCopy } from '../domain/types';

/** Textos legales en inglés: las mismas secciones que es.ts. */
export const en: LegalCopy = {
  ui: {
    eyebrow: 'Legal information',
    updated: 'Last updated',
    contents: 'On this page',
    pending: 'Pending',
    related: 'Other legal texts',
    cookieSettings: 'Cookie settings',
    onlyWith: 'Only published with',
  },
  conditions: {
    optional: 'analytics or advertising cookies configured',
    noOptional: 'no analytics or advertising cookies',
    analytics: 'analytics configured',
    ads: 'advertising configured',
    ga4: 'Google Analytics configured',
    googleAds: 'Google Ads configured',
    meta: 'Meta pixel configured',
    tiktok: 'TikTok pixel configured',
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
            'Discount codes: the codes from our campaigns are entered at checkout. Each code states its discount and conditions (dates, minimum spend, whether it can be used once per email address or a limited number of times, and whether it applies to reduced items). It applies to the items, not to shipping costs, and only one code can be used per order. The discount is shown in the summary before you pay. If you return an item from a discounted order, we refund what you paid for it: its price less its proportional share of the discount.',
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
            'Payments are made on the bank’s secure page: by card, with strong authentication (3D Secure); with Bizum, with your mobile number and your Bizum PIN. We never see or store your card details or your PINs. The charge is made when the order is confirmed.',
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
                'Data: what you give us when you write to us (through the contact form or by email) or call: name, email, phone, your message and, if you give it, the order number.',
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
                'Data: name, email, phone, delivery address and, if you ask for an invoice in a company’s name, its tax details; products, amounts and payment status. Your card or Bizum details are processed by the bank: we do not receive them.',
                'Purpose: to manage the order, payment, delivery, returns and guarantee, and to issue the invoice.',
                'Legal basis: performance of the sales contract (art. 6.1.b GDPR) and compliance with tax and accounting obligations (art. 6.1.c).',
                'Retention: for the duration of the relationship and then 6 years under commercial law and for the periods required by tax law.',
              ],
            },
          ],
        },
        {
          id: 'cuenta',
          title: 'Customer account',
          blocks: [
            {
              list: [
                'Data: name, email and password (stored encrypted, so nobody can read it) and, if you save them, phone number and delivery address. If you sign in with Google, Google gives us your name and email.',
                'Purpose: giving you access to your account, showing you your orders (including those you placed without an account with the same email, once verified) and filling in your details when you buy.',
                'Legal basis: performance of the contract you accept when creating the account (Art. 6(1)(b) GDPR).',
                'Retention: until you delete the account, which you can do at any time from “My details”. Orders are kept, no longer linked to the account, for the periods set out in the previous section.',
              ],
            },
            'Creating an account is optional: you can buy without one.',
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
          id: 'analitica-publicidad',
          title: 'Analytics and advertising',
          when: 'optional',
          blocks: [
            {
              list: [
                'Data: cookie identifiers, your IP address, data about your browser and device, the shop pages you visit, the fragrances you view or add to your basket and, if you buy, the order number and amount. We do not send your name, email, phone number or address.',
                'Purpose: depending on what you accept, knowing statistically how the website is used (analytics) and showing you ads for our fragrances on other websites and social networks and measuring which campaigns lead to a purchase (advertising).',
                'Legal basis: your consent (art. 6.1.a GDPR and art. 22.2 LSSI), which you can withdraw at any time from “Cookie settings” at the bottom of every page, without affecting earlier processing.',
                'Retention: cookies last as stated in the [cookie policy](doc:cookies); what the companies below receive is kept according to their settings and their own policy.',
              ],
            },
            'Who receives this data, only if you accept the type of cookies it uses:',
            {
              when: 'ga4',
              blocks: [
                'Google Ireland Limited, for Google Analytics, as processor. It keeps each visitor’s data for 14 months at most. Google may transfer it to Google LLC, in the United States, certified under the EU-US Data Privacy Framework.',
              ],
            },
            {
              when: 'googleAds',
              blocks: [
                'Google Ireland Limited, for Google ads, as controller of what it does with that data afterwards under its policy. Google may transfer it to Google LLC, in the United States, certified under the EU-US Data Privacy Framework.',
              ],
            },
            {
              when: 'meta',
              blocks: [
                'Meta Platforms Ireland Limited, for Facebook and Instagram ads. We are joint controllers with Meta for collecting this data on the website and sending it to Meta; what Meta does afterwards is decided by Meta, as controller, under its policy. Meta may transfer it to Meta Platforms, Inc., in the United States, certified under the EU-US Data Privacy Framework.',
              ],
            },
            {
              when: 'tiktok',
              blocks: [
                'TikTok Technology Limited (Ireland), for TikTok ads, on the same terms as Meta. TikTok may access the data from outside the European Economic Area under the European Commission’s standard contractual clauses.',
              ],
            },
          ],
        },
        {
          id: 'destinatarios',
          title: 'Who can access your data',
          blocks: [
            'We do not sell your data. Only these providers access it, under a data processing agreement and solely to provide their service to us:',
            {
              list: [
                'Web hosting and database providers, with servers in the European Union.',
                'The provider that sends Club L’Atelier emails.',
                'The bank that processes payments, the carrier and the provider of order emails and of the replies to your enquiries.',
              ],
            },
            {
              when: 'optional',
              blocks: [
                'If you accept analytics or advertising cookies, the companies listed in [Analytics and advertising](doc:privacy#analitica-publicidad) also receive data.',
              ],
            },
            'If you choose to sign in with Google, Google verifies your identity as an independent controller, under its own [privacy policy](https://policies.google.com/privacy).',
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
            {
              when: 'ads',
              blocks: [
                'If you accept advertising cookies, the advertising platforms use your browsing to decide which ads to show you. This has no legal effects on you and does not significantly affect you, and you avoid it by rejecting those cookies.',
              ],
            },
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
            {
              when: 'noOptional',
              blocks: [
                'This website only uses technical cookies that it needs to work. We do not use analytics, advertising or social media cookies, and fonts are served from our own server, without calls to third parties.',
              ],
            },
            {
              when: 'optional',
              blocks: [
                'This website uses technical cookies that it needs to work and, only if you accept them, cookies from other companies for analytics or advertising, explained in the following sections. Fonts are served from our own server, without calls to third parties.',
              ],
            },
            {
              table: {
                caption: 'Technical cookies on this website',
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
                  {
                    when: 'optional',
                    cells: [
                      'atelier_cookies',
                      'Ours',
                      'Remember whether you accept or reject analytics and advertising cookies, and when you chose.',
                      '1 year',
                    ],
                  },
                  [
                    'atelier_cesta',
                    'Ours',
                    'Keep the fragrances you add to your basket while you shop. It is only created if you use the basket.',
                    '30 days',
                  ],
                  [
                    'atelier_pedido',
                    'Ours',
                    'Remember the order you have just placed so we can show you its status when you return from the bank. It is only created when you place an order.',
                    '30 days',
                  ],
                  [
                    'Account session',
                    'Ours',
                    'Keep you signed in to your customer account. They are only created if you sign in and are deleted when you sign out.',
                    'Until you sign out (400 days at most)',
                  ],
                  [
                    'Sign-in with Google',
                    'Ours',
                    'Complete signing in with Google securely. It is only created when you press “Continue with Google”.',
                    'Deleted once you are signed in',
                  ],
                ],
              },
            },
          ],
        },
        {
          id: 'analitica',
          title: 'Analytics cookies',
          when: 'analytics',
          blocks: [
            'Only if you accept them, we use Google Analytics, a service of Google Ireland Limited, to know statistically how many people visit us, how they arrive, which pages they see and which purchases are completed. Google receives your IP address (Google Analytics does not store it), data about your browser and device and the pages you visit. We do not send it your name, email or other contact details.',
            {
              table: {
                caption: 'Analytics cookies',
                head: ['Cookie', 'Owner', 'Purpose', 'Duration'],
                rows: [
                  {
                    when: 'ga4',
                    cells: [
                      '_ga',
                      'Google',
                      'Tell visitors apart statistically.',
                      '13 months',
                    ],
                  },
                  {
                    when: 'ga4',
                    cells: [
                      '_ga_<ID>',
                      'Google',
                      'Keep the state of the visit.',
                      '13 months',
                    ],
                  },
                ],
              },
            },
            'More information in [how Google uses information from sites that use its services](https://policies.google.com/technologies/partner-sites) and its [privacy policy](https://policies.google.com/privacy).',
          ],
        },
        {
          id: 'publicidad',
          title: 'Advertising cookies',
          when: 'ads',
          blocks: [
            'Only if you accept them, the companies in this table help us show you ads for our fragrances on their platforms and on other websites based on your visit (for example, the fragrances you have viewed) and measure which ads lead to a visit or a purchase. To do so they receive your IP address, data about your browser and device, the shop pages you visit, the fragrances you view or add to your basket and, if you buy, the order number and amount. We do not send them your name, email or other contact details.',
            'If you have an account with their services, each company may link this information to your account, as controller of that processing and under its own policy.',
            {
              table: {
                caption: 'Advertising cookies',
                head: ['Cookie', 'Owner', 'Purpose', 'Duration'],
                rows: [
                  {
                    when: 'googleAds',
                    cells: [
                      '_gcl_au',
                      'Google',
                      'Measure which Google ads lead to a visit or a purchase.',
                      '3 months',
                    ],
                  },
                  {
                    when: 'meta',
                    cells: [
                      '_fbp',
                      'Meta',
                      'Measure Facebook and Instagram ads and show you ads based on your visit.',
                      '3 months',
                    ],
                  },
                  {
                    when: 'meta',
                    cells: [
                      '_fbc',
                      'Meta',
                      'Remember the Facebook or Instagram ad you came from. It is only created if you come from one.',
                      '3 months',
                    ],
                  },
                  {
                    when: 'tiktok',
                    cells: [
                      '_ttp',
                      'TikTok',
                      'Measure TikTok ads and show you ads based on your visit.',
                      '13 months',
                    ],
                  },
                  {
                    when: 'tiktok',
                    cells: [
                      '_tt_enable_cookie',
                      'TikTok',
                      'Check that your browser accepts cookies.',
                      '13 months',
                    ],
                  },
                ],
              },
            },
            {
              when: 'googleAds',
              blocks: [
                'Google Ireland Limited: [how Google uses information from sites that use its services](https://policies.google.com/technologies/partner-sites) and [privacy policy](https://policies.google.com/privacy).',
              ],
            },
            {
              when: 'meta',
              blocks: [
                'Meta Platforms Ireland Limited: [privacy policy](https://www.facebook.com/privacy/policy/) and [cookie policy](https://www.facebook.com/privacy/policies/cookies/).',
              ],
            },
            {
              when: 'tiktok',
              blocks: [
                'TikTok Technology Limited: [privacy policy](https://www.tiktok.com/legal/page/eea/privacy-policy/en) and [cookie policy](https://www.tiktok.com/legal/page/global/cookie-policy/en).',
              ],
            },
            'These companies may also use their own cookies, on their own domains, and change their list; the current one is in their cookie policy.',
          ],
        },
        {
          id: 'consentimiento',
          title: 'Your consent',
          blocks: [
            'Technical cookies, and those that store a preference you choose, such as the language, are exempt from consent under article 22.2 of the LSSI and the guidance of the Spanish Data Protection Agency.',
            {
              when: 'noOptional',
              blocks: [
                'That is why we do not ask you to accept cookies: the notice you see when you arrive is to let you know our terms.',
                'If we ever use analytics or advertising cookies, we will ask for your permission before setting them, with the option to reject them as easily as accept them, and we will update this policy.',
              ],
            },
            {
              when: 'optional',
              blocks: [
                'Analytics and advertising cookies are only set if you accept them in the notice you see when you arrive, where you can accept them all, reject them all or choose by type just as easily. If you do not choose, they are not set, and if you reject them you can browse and buy just the same.',
                'We keep your choice for one year. After that, or if we add another company to a type of cookies you had accepted, we will ask you again.',
                'You can change your mind or withdraw your consent at any time from “Cookie settings” at the bottom of every page, or with this button:',
                { action: 'cookieSettings' },
                'If you withdraw it, we delete the analytics and advertising cookies of our domain from your browser. Those that these companies keep on their own domains are deleted from your browser settings or from your account with their services.',
              ],
            },
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
            {
              when: 'ga4',
              blocks: [
                'You can also stop Google Analytics from measuring you on any website with [Google’s opt-out browser add-on](https://tools.google.com/dlpage/gaoptout).',
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
