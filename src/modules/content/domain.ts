import { z } from 'zod';
export const contentKind = z.enum(['home', 'store']);
export const contentLocale = z.enum(['es', 'ca', 'en']);
export type ContentKind = z.infer<typeof contentKind>;
const text = z.string().trim().max(4000);
const social = z.union([
  z.literal(''),
  z
    .string()
    .regex(
      /^https:\/\/([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}([/?#][^\s]*)?$/,
      'Usa una URL https válida, sin puerto ni credenciales.',
    )
    .pipe(z.url())
    .refine(
      (value) => new URL(value).protocol === 'https:',
      'Usa una dirección https.',
    ),
]);
export const homeContent = z
  .object({
    heroEyebrow: text,
    heroTitle: text.min(1),
    heroLead: text,
    heroCta: text.min(1),
    storeBody: text,
    imagePath: z.string().max(500),
    imageAlt: text,
    imageSource: text,
  })
  .strict()
  .refine(
    (data) => !data.imagePath || Boolean(data.imageAlt && data.imageSource),
    'La imagen necesita texto alternativo y procedencia.',
  );
export const storeContent = z
  .object({
    address: text.min(1),
    city: text.min(1),
    phone: z.string().trim().max(50),
    email: z.union([z.literal(''), z.email().max(254)]),
    hours: text,
    instagram: social,
    facebook: social,
  })
  .strict();
export type HomeContent = z.infer<typeof homeContent>;
export type StoreContent = z.infer<typeof storeContent>;
export const STORE_DEFAULTS: StoreContent = {
  address: 'Carrer de Pompeu Fabra 1',
  city: 'Castelldefels',
  phone: '',
  email: '',
  hours: '',
  instagram: '',
  facebook: '',
};
export const FIELD_LABELS: Record<string, string> = {
  heroEyebrow: 'Antetítulo',
  heroTitle: 'Título de portada',
  heroLead: 'Texto introductorio',
  heroCta: 'Texto del botón de colección',
  storeBody: 'Texto de la tienda física',
  imageAlt: 'Descripción de la imagen',
  imageSource: 'Procedencia de la imagen',
  address: 'Dirección',
  city: 'Localidad',
  phone: 'Teléfono',
  email: 'Correo de contacto',
  hours: 'Horarios',
  instagram: 'Instagram (URL https)',
  facebook: 'Facebook (URL https)',
};
