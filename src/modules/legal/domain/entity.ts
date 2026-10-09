import type { LegalField } from './types';

type Locale = 'es' | 'ca' | 'en';
/** Un valor igual en todos los idiomas, uno por idioma o `null` (pendiente). */
export type LegalValue = string | Record<Locale, string> | null;

/**
 * Datos del titular y de la venta online que exigen la LSSI (art. 10) y la
 * ley de consumo (TRLGDCU, art. 97). **Pendientes del negocio** (STATUS,
 * pendiente 8): mientras valgan `null`, la página muestra «Pendiente: …» en
 * su lugar. No se inventan: se rellenan con lo que facilite el cliente y se
 * revisan con la asesoría (docs/LEGAL.md).
 *
 * El correo, el teléfono y la dirección de la tienda no van aquí: salen de
 * Panel → Configuración, los mismos que el pie.
 */
export const LEGAL_ENTITY: Record<
  Exclude<LegalField, 'email' | 'phone' | 'storeAddress'>,
  LegalValue
> = {
  /** Razón social o nombre y apellidos del autónomo. */
  holder: null,
  /** NIF o CIF. */
  taxId: null,
  /** Domicilio social o fiscal (puede no coincidir con la tienda). */
  registeredAddress: null,
  /** Registro Mercantil (tomo, folio, hoja) o «no inscrita» si es autónomo. */
  registry: null,
  /** Dominio definitivo de la web (p. ej. www.…). */
  domain: null,
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

/** Fecha de la versión vigente de los textos (AAAA-MM-DD). */
export const LEGAL_UPDATED_AT = '2026-10-09';
