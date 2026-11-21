import type { LegalField } from './types';

type Locale = 'es' | 'ca' | 'en';
/** Un valor igual en todos los idiomas, uno por idioma o `null` (pendiente). */
export type LegalValue = string | Record<Locale, string> | null;

/**
 * Datos del titular y de la venta online que exigen la LSSI (art. 10) y la
 * ley de consumo (TRLGDCU, art. 97). Los del titular los facilitó el
 * cliente el 10/10/2026 (autónomo, sin Registro Mercantil). Los que valen
 * `null` siguen pendientes: esa línea no se publica y la vista previa del
 * personal muestra «Pendiente: …». No se inventan (docs/LEGAL.md).
 *
 * El teléfono y la dirección de la tienda salen de Panel → Configuración,
 * como en el pie; el correo también, y si allí está vacío se usa
 * `LEGAL_CONTACT_EMAIL`.
 */
export const LEGAL_ENTITY: Record<
  Exclude<LegalField, 'email' | 'phone' | 'storeAddress'>,
  LegalValue
> = {
  /** Razón social o nombre y apellidos del autónomo. */
  holder: 'Patricia Adriana Pecora',
  /** NIF o CIF (aquí, NIE). */
  taxId: 'X8044791N',
  /** Domicilio de la actividad (el de la tienda). */
  registeredAddress:
    'Carrer de Pompeu Fabra, 1, 08860 Castelldefels (Barcelona)',
  /** Registro Mercantil: no aplica a un autónomo, la línea no se publica. */
  registry: null,
  /** Dominio definitivo de la web. */
  domain: 'www.latelierdudesert.com',
  /** Zonas de envío: las decidió el usuario el 12/10/2026 (DECISIONS §136). */
  shippingZones: {
    es: 'la España peninsular y las Illes Balears',
    ca: 'l’Espanya peninsular i les Illes Balears',
    en: 'mainland Spain and the Balearic Islands',
  },
  /**
   * Tarifa de envío y desde cuánto es gratis: con `null` salen de las
   * tarifas activas de Panel → Configuración → Tarifas de envío (DECISIONS
   * §168), como en el checkout. Un texto aquí las sustituye.
   */
  shippingCost: null,
  freeShippingFrom: null,
  /**
   * Plazo de entrega habitual: lo decidió el titular el 21/11/2026 (hasta un
   * día laborable para preparar el pedido más las 48 h de Correos, DECISIONS
   * §196).
   */
  deliveryTime: {
    es: 'de 2 a 4 días laborables',
    ca: 'de 2 a 4 dies laborables',
    en: '2 to 4 working days',
  },
  /** Empresa de transporte: Correos, Paq Estándar a domicilio (§196). */
  carrier: 'Correos',
  /**
   * Medios de pago aceptados: los del TPV virtual de BBVA según su correo del
   * 23/10/2026 (DECISIONS §167). Se confirman en la prueba con el banco.
   */
  paymentMethods: {
    es: 'tarjeta bancaria y Bizum',
    ca: 'targeta bancària i Bizum',
    en: 'bank card and Bizum',
  },
  /** Si se adhiere a la Junta Arbitral de Consum de Catalunya (u otra entidad). */
  arbitration: null,
};

/** Correo de contacto de los textos si Panel → Configuración no tiene uno. */
export const LEGAL_CONTACT_EMAIL = 'latelierdudesert@gmail.com';

/** Fecha de la versión vigente de los textos (AAAA-MM-DD). */
export const LEGAL_UPDATED_AT = '2026-11-21';

/**
 * Cookie técnica que recuerda que el visitante aceptó el aviso de entrada.
 * Su valor es la versión de los textos: si cambia `LEGAL_UPDATED_AT`, el
 * aviso se vuelve a mostrar. Dura un año.
 */
export const LEGAL_CONSENT_COOKIE = 'atelier_aviso';
export const LEGAL_CONSENT_MAX_AGE = 60 * 60 * 24 * 365;
