/**
 * Textos legales de la tienda (aviso legal, condiciones de venta, privacidad,
 * cookies y envíos y devoluciones), en es, ca y en. El texto vive en el
 * código, revisado por PR; los datos que faltan se escriben como marcadores
 * `{clave}` y se rellenan con `LEGAL_ENTITY` y los datos de la tienda.
 */

export const LEGAL_DOCUMENTS = [
  'legalNotice',
  'terms',
  'privacy',
  'cookies',
  'shipping',
] as const;
export type LegalDocumentKey = (typeof LEGAL_DOCUMENTS)[number];

/** Datos que se insertan en los textos. `null` = pendiente del negocio. */
export const LEGAL_FIELDS = [
  'holder',
  'taxId',
  'registeredAddress',
  'registry',
  'email',
  'phone',
  'domain',
  'storeAddress',
  'shippingZones',
  'shippingCost',
  'freeShippingFrom',
  'deliveryTime',
  'carrier',
  'paymentMethods',
  'arbitration',
] as const;
export type LegalField = (typeof LEGAL_FIELDS)[number];

/** Un bloque de texto: párrafo, lista, tabla o nota destacada. */
export type LegalBlock =
  | string
  | { list: string[]; ordered?: boolean }
  | { table: { head: string[]; rows: string[][]; caption: string } }
  | { note: string };

export type LegalSection = {
  /** Ancla estable (no cambia con el idioma). */
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  title: string;
  /** Una frase bajo el título y en la descripción de la página. */
  summary: string;
  sections: LegalSection[];
};

export type LegalCopy = {
  /** Etiquetas de la página. */
  ui: {
    eyebrow: string;
    updated: string;
    contents: string;
    pending: string;
    related: string;
  };
  /** Qué falta, en palabras del idioma, para el marcador «Pendiente: …». */
  fields: Record<LegalField, string>;
  documents: Record<LegalDocumentKey, LegalDocument>;
};
