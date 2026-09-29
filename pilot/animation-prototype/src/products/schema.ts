import { z } from 'zod';

/**
 * Configuración por producto. Es lo ÚNICO que cambia entre productos:
 * la coreografía (motion/spec.ts) es común.
 */

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Mm = z.number().positive();
const Px = z.number().min(0);

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

const DraftFile = z.object({
  /** URL resuelta por Vite (import del PNG). */
  src: z.string(),
  /** Ruta relativa a pilot/assets-drafts, para trazabilidad. */
  file: z.string(),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
});

/**
 * Proyección frontal de un draft sobre la geometría: cada vértice (x, y en mm,
 * origen en el centro de la base) se lleva al píxel del draft que le corresponde.
 * Calibrada midiendo el draft: centro horizontal, base y píxeles por mm.
 */
export const FrontProjectionSchema = DraftFile.extend({
  centerXPx: Px,
  baseYPx: Px,
  pxPerMm: z.number().positive(),
});
export type FrontProjection = z.infer<typeof FrontProjectionSchema>;

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
  /**
   * Medallón frontal (+Z). En formas grises sirve de marca de «frente».
   * `offsetXMm` lo alinea con el draft (en los drafts no está centrado).
   */
  medallion: z
    .object({ radiusMm: Mm, depthMm: Mm, centerFromBaseMm: Mm, offsetXMm: z.number() })
    .nullable(),
  /** Arco frontal (±grados) sobre el que se proyecta la textura. */
  textureArcDeg: z.number().min(10).max(85),
});

/** Arquetipo «prisma rectangular» con tapón cuadrado, cuello y colgante. CDN LE. */
const RectPrism = z.object({
  archetype: z.literal('rect-prism'),
  body: z.object({ widthMm: Mm, heightMm: Mm, depthMm: Mm, bevelMm: Mm }),
  collar: z.object({ heightMm: Mm, radiusMm: Mm }),
  neck: z.object({ heightMm: Mm, radiusMm: Mm }),
  cap: z.object({ widthMm: Mm, heightMm: Mm, depthMm: Mm, bevelMm: Mm }),
  /** Cadena y medallón simplificados (eslabones toroidales + disco). */
  pendant: z
    .object({
      radiusMm: Mm,
      depthMm: Mm,
      centerFromBaseMm: Mm,
      links: z.number().int().min(0).max(40),
      linkRadiusMm: Mm,
    })
    .nullable(),
});

/** Arquetipo «vidrio de base cuadrada con líquido». Khamrah. */
const SquareGlass = z.object({
  archetype: z.literal('square-glass'),
  body: z.object({ widthMm: Mm, heightMm: Mm, bevelMm: Mm, wallMm: Mm, baseMm: Mm }),
  /** Nivel del líquido 0–1 sobre el volumen interior. */
  liquidFill: z.number().min(0).max(1),
  cap: z.object({ widthMm: Mm, heightMm: Mm, bevelMm: Mm }),
  plate: z.object({ widthMm: Mm, heightMm: Mm, thicknessMm: Mm, centerFromBaseMm: Mm }),
  /** Normal map procedural PROVISIONAL de estrías en espiga (null = sin estrías). */
  flutes: z.object({ repeat: z.number().positive(), strength: z.number().min(0) }).nullable(),
  /**
   * Textura de la placa: cuadrilátero (px) de la placa en un draft, en orden
   * superior-izq., superior-der., inferior-der., inferior-izq.
   */
  plateTexture: DraftFile.extend({
    quadPx: z.tuple([
      z.tuple([Px, Px]),
      z.tuple([Px, Px]),
      z.tuple([Px, Px]),
      z.tuple([Px, Px]),
    ]),
  }).nullable(),
});

/** Caras de la caja. «left»/«right» = izquierda/derecha mirando la cara frontal. */
export const BOX_FACES = ['front', 'back', 'left', 'right', 'top', 'bottom', 'inside'] as const;
export type BoxFace = (typeof BOX_FACES)[number];

/**
 * Imagen de una cara ya enderezada y recortada al tamaño de la cara.
 * `origin` preserva la procedencia: PHOTO = foto propia del kit de tienda;
 * OFFICIAL = imagen oficial de la marca, solo como referencia interna (no publicable).
 */
const BoxFaceImage = z.object({
  src: z.string(),
  /** Ruta relativa al repo (p. ej. pilot/assets-refs/asad/box_front.jpg). */
  file: z.string(),
  origin: z.enum(['PHOTO', 'OFFICIAL', 'GENERATED']),
  /** URL de origen si no es foto propia. */
  sourceUrl: z.string().optional(),
  /**
   * Mapa de estampación (foil) derivado de la misma imagen: G = rugosidad, B = metalicidad.
   * Hace que el dorado/plateado refleje la luz como en la caja real.
   */
  foil: z.object({ src: z.string(), file: z.string() }).optional(),
  /** Parte de la cara reconstruida (no visible en la fuente). Se documenta en PROVENANCE. */
  simulated: z.string().optional(),
});

export const BoxSchema = z.object({
  widthMm: Mm,
  heightMm: Mm,
  depthMm: Mm,
  /** false cuando las medidas vienen del kit de tienda. */
  estimated: z.boolean(),
  /**
   * Tipo de apertura (mismos tiempos para todos, S1):
   * - top-flap: estuche de cartón con solapa superior y bisagra trasera;
   * - lift-lid: tapa que se levanta y se aparta de una base (Khamrah);
   * - hinged-lid: estuche rígido con tapa de bisagra trasera (CDN LE).
   */
  opening: z.enum(['top-flap', 'lift-lid', 'hinged-lid']),
  /** Parte de la altura que corresponde a la tapa (lift-lid, hinged-lid). */
  lidFraction: z.number().min(0).max(1),
  /** Posición del frasco dentro de la caja: de pie o tumbado boca arriba (se endereza en S2). */
  bottlePose: z.enum(['standing', 'lying']),
  /** Color de la tapa/cartón donde no hay imagen. */
  color: Hex,
  /** Color de la base si difiere (p. ej. la base de madera de Khamrah). */
  baseColor: Hex.optional(),
  /** Color del interior si no hay imagen «inside». */
  insideColor: Hex,
  faces: z.partialRecord(z.enum(BOX_FACES), BoxFaceImage),
});
export type BoxConfig = z.infer<typeof BoxSchema>;

export const BottleShapeSchema = z.discriminatedUnion('archetype', [
  LatheShoulder,
  RectPrism,
  SquareGlass,
]);
export type BottleShape = z.infer<typeof BottleShapeSchema>;
export type ShapeOf<A extends BottleShape['archetype']> = Extract<BottleShape, { archetype: A }>;

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
  }),
  box: BoxSchema,
  /** Escala global del producto (frasco + caja) para ajustar cuando lleguen medidas reales. */
  scale: z.number().positive(),
  bottle: BottleShapeSchema,
  materials: z.object({
    body: MaterialSchema,
    cap: MaterialSchema,
    accent: MaterialSchema,
    liquid: MaterialSchema.optional(),
  }),
  /** Imagen GENERATED/DRAFT del fallback sin WebGL. Nunca publicable. */
  draftImage: z.object({ src: z.string(), file: z.string() }),
  /** Textura de prueba proyectada en el frente (GENERATED/DRAFT). null = sin textura frontal. */
  frontTexture: FrontProjectionSchema.nullable(),
  panel: z.object({
    priceLabel: z.literal('— €'),
    description: z.string(),
  }),
});

export type ProductConfig = z.infer<typeof ProductConfigSchema>;
