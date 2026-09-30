import type { Cents } from '@/lib/money';

export const CONCENTRATIONS = [
  'EDC',
  'EDT',
  'EDP',
  'PARFUM',
  'EXTRAIT',
  'OIL',
  'OTHER',
] as const;
export type Concentration = (typeof CONCENTRATIONS)[number];

/** Nombres en el panel (en la tienda vienen de messages/). */
export const CONCENTRATION_NAMES: Record<Concentration, string> = {
  EDC: 'Eau de Cologne',
  EDT: 'Eau de Toilette',
  EDP: 'Eau de Parfum',
  PARFUM: 'Parfum',
  EXTRAIT: 'Extrait de Parfum',
  OIL: 'Aceite perfumado',
  OTHER: 'Otra',
};

export const AUDIENCES = ['women', 'men', 'unisex'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const PRODUCT_STATUSES = ['draft', 'published', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const AVAILABILITY = ['in_stock', 'low_stock', 'out_of_stock'] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** Procedencia de una imagen (AGENTS.md: preservar procedencia y fuentes). */
export const MEDIA_ORIGINS = [
  'own_photo',
  'catalog_pdf',
  'brand_official',
  'generated_draft',
] as const;
export type MediaOrigin = (typeof MEDIA_ORIGINS)[number];

export type ProductVariant = {
  id: string;
  label: string | null;
  sizeMl: number | null;
  priceCents: Cents | null;
  compareAtCents: Cents | null;
  position: number;
};

export type ProductMedia = {
  url: string;
  alt: string | null;
  role: 'hero' | 'gallery' | 'box';
  origin: MediaOrigin;
  provisional: boolean;
  position: number;
};

export type StorefrontProduct = {
  id: string;
  slug: string;
  name: string;
  brand: { slug: string; name: string };
  concentration: Concentration | null;
  audience: Audience | null;
  featured: boolean;
  position: number;
  unboxingScene: string | null;
  tagline: string | null;
  description: string | null;
  variants: ProductVariant[];
  media: ProductMedia[];
};

/** PVP más bajo entre los formatos con precio; null si ninguno lo tiene aún. */
export function lowestPrice(product: StorefrontProduct): Cents | null {
  const prices = product.variants
    .map((variant) => variant.priceCents)
    .filter((price): price is Cents => price !== null);
  return prices.length ? Math.min(...prices) : null;
}

/** Imagen principal: la marcada como «hero»; si no, la primera por posición. */
export function heroMedia(product: StorefrontProduct): ProductMedia | null {
  const sorted = [...product.media].sort((a, b) => a.position - b.position);
  return sorted.find((media) => media.role === 'hero') ?? sorted[0] ?? null;
}

/** Etiqueta del formato: la escrita a mano o «100 ml». */
export function variantLabel(variant: ProductVariant): string {
  if (variant.label?.trim()) return variant.label.trim();
  return variant.sizeMl ? `${variant.sizeMl} ml` : '—';
}

export function isConcentration(value: unknown): value is Concentration {
  return CONCENTRATIONS.includes(value as Concentration);
}

export function isAudience(value: unknown): value is Audience {
  return AUDIENCES.includes(value as Audience);
}

/** «Khamrah Qahwa» → «khamrah-qahwa» (sin acentos ni símbolos). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
