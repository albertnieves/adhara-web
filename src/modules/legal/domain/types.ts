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

/**
 * Lo que solo se publica con una configuración (DECISIONS §178): con alguna
 * cookie opcional (`optional`) o sin ninguna (`noOptional`), con un tipo
 * (`analytics`, `ads`) o con un proveedor concreto.
 */
export const LEGAL_CONDITIONS = [
  'optional',
  'noOptional',
  'analytics',
  'ads',
  'ga4',
  'googleAds',
  'meta',
  'tiktok',
] as const;
export type LegalCondition = (typeof LEGAL_CONDITIONS)[number];

/** Una fila de tabla, siempre o solo con una condición. */
export type LegalRow = string[] | { when: LegalCondition; cells: string[] };

/**
 * Un bloque de texto: párrafo, lista, tabla, nota destacada, un grupo que
 * solo se publica con una condición o el botón «Configurar cookies».
 */
export type LegalBlock =
  | string
  | { list: string[]; ordered?: boolean }
  | { table: { head: string[]; rows: LegalRow[]; caption: string } }
  | { note: string }
  | { when: LegalCondition; blocks: LegalBlock[] }
  | { action: 'cookieSettings' };

export type LegalSection = {
  /** Ancla estable (no cambia con el idioma). */
  id: string;
  title: string;
  /** La sección entera solo se publica con esta condición. */
  when?: LegalCondition;
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
    /** Botón para cambiar la elección de cookies. */
    cookieSettings: string;
    /** Vista previa: «Solo se publica con …». */
    onlyWith: string;
  };
  /** Cada condición en palabras, para la vista previa del personal. */
  conditions: Record<LegalCondition, string>;
  /** Qué falta, en palabras del idioma, para el marcador «Pendiente: …». */
  fields: Record<LegalField, string>;
  documents: Record<LegalDocumentKey, LegalDocument>;
};
