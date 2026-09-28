import { z } from 'zod';

/**
 * Configuración por producto. Es lo ÚNICO que cambia entre productos:
 * la coreografía (motion/spec.ts) es común.
 */

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Mm = z.number().positive();

export const MaterialSchema = z.object({
  color: Hex,
  roughness: z.number().min(0).max(1),
  metalness: z.number().min(0).max(1),
  /** Solo vidrio (MeshPhysicalMaterial). */
  transmission: z.number().min(0).max(1).optional(),
  ior: z.number().min(1).max(2.5).optional(),
  thicknessMm: z.number().min(0).optional(),
  clearcoat: z.number().min(0).max(1).optional(),
});
export type MaterialConfig = z.infer<typeof MaterialSchema>;

/** Arquetipo «cilindro con hombro redondeado» (LatheGeometry). Asad y Yara. */
const LatheShoulder = z.object({
  archetype: z.literal('lathe-shoulder'),
  capHeightMm: Mm,
  capRadiusMm: Mm,
  /** Aro metálico en el canto superior del tapón. */
  capRimHeightMm: z.number().min(0),
  neckHeightMm: Mm,
  neckRadiusMm: Mm,
  bodyHeightMm: Mm,
  bodyTopRadiusMm: Mm,
  bodyBottomRadiusMm: Mm,
  shoulderFilletMm: Mm,
  baseFilletMm: Mm,
  /** Aro metálico en la parte superior del cuerpo. */
  bodyRingHeightMm: z.number().min(0),
  /** Medallón frontal (+Z). En formas grises sirve de marca de «frente». */
  medallion: z.object({ radiusMm: Mm, depthMm: Mm, centerFromBaseMm: Mm }).nullable(),
});

export const BottleShapeSchema = z.discriminatedUnion('archetype', [LatheShoulder]);
export type BottleShape = z.infer<typeof BottleShapeSchema>;

export const ProductConfigSchema = z.object({
  slug: z.string(),
  /** Datos de producto: SOLO los que constan en pilot/ (no se inventan). */
  name: z.string(),
  brand: z.string(),
  dataSource: z.string(),
  measurements: z.object({
    /** true mientras no haya medidas del kit de tienda (§4 paso 1). */
    estimated: z.boolean(),
    note: z.string(),
    box: z.object({ widthMm: Mm, heightMm: Mm, depthMm: Mm }),
  }),
  /** Escala global del producto (frasco + caja) para ajustar cuando lleguen medidas reales. */
  scale: z.number().positive(),
  bottle: BottleShapeSchema,
  materials: z.object({
    body: MaterialSchema,
    cap: MaterialSchema,
    accent: MaterialSchema,
  }),
  /** Color de la caja: PLACEHOLDER neutro (no hay arte de caja aprobado). */
  boxColor: Hex,
  /** Imagen GENERATED/DRAFT: textura de prueba y fallback sin WebGL. Nunca publicable. */
  draftImage: z.object({ src: z.string(), file: z.string() }),
  panel: z.object({
    priceLabel: z.literal('— €'),
    description: z.string(),
  }),
});

export type ProductConfig = z.infer<typeof ProductConfigSchema>;
