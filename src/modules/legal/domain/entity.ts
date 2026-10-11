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
  /** Zonas de envío (p. ej. España peninsular y Baleares). */
  shippingZones: null,
  /** Tarifa de envío. */
  shippingCost: null,
  /** Importe a partir del cual el envío es gratis. */
  freeShippingFrom: null,
  /** Plazo de entrega habitual. */
  deliveryTime: null,
  /** Empresa de transporte. */
  carrier: null,
  /** Medios de pago aceptados. */
  paymentMethods: null,
  /** Si se adhiere a la Junta Arbitral de Consum de Catalunya (u otra entidad). */
  arbitration: null,
};

/** Correo de contacto de los textos si Panel → Configuración no tiene uno. */
export const LEGAL_CONTACT_EMAIL = 'latelierdudesert@gmail.com';

/** Fecha de la versión vigente de los textos (AAAA-MM-DD). */
export const LEGAL_UPDATED_AT = '2026-10-10';

/**
 * Cookie técnica que recuerda que el visitante aceptó el aviso de entrada.
 * Su valor es la versión de los textos: si cambia `LEGAL_UPDATED_AT`, el
 * aviso se vuelve a mostrar. Dura un año.
 */
export const LEGAL_CONSENT_COOKIE = 'atelier_aviso';
export const LEGAL_CONSENT_MAX_AGE = 60 * 60 * 24 * 365;
