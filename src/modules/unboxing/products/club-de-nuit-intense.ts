import frontSrc from '@pilot-refs/club-de-nuit-intense/bottle_front.jpg';
import boxFront from '@pilot-refs/club-de-nuit-intense/box_front.jpg';
import { asset } from './asset';
import { PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/**
 * Molde de Club de Nuit (105 ml) medido en la foto frontal oficial
 * Intense_Man_Bottle-2 (frasco de y=89 a y=1097 px a 1200 px), altura supuesta
 * 140 mm. El FONDO del prisma no se ve de frente: 42 mm, como en el LE, coincide
 * con la vista 3/4 de Iconic (≈43 mm). Lo comparte Club de Nuit Iconic.
 */
export const CLUB_DE_NUIT_PRISM = {
  archetype: 'rect-prism',
  body: { widthMm: 80.6, heightMm: 102.6, depthMm: 42, bevelMm: 3 },
  collar: { heightMm: 5.1, radiusMm: 19.9 },
  neck: { heightMm: 2.1, radiusMm: 14.9 },
  cap: { widthMm: 41.1, heightMm: 29.9, depthMm: 41.1, bevelMm: 2 },
} as const;

/**
 * Estuche de Club de Nuit Intense (frontal oficial, 0,643 ancho/alto; alto ≈ 1,19 ×
 * frasco). El fondo no se ve en ninguna foto: 55 mm, supuesto.
 */
export const CLUB_DE_NUIT_BOX = {
  widthMm: 107,
  heightMm: 166,
  depthMm: 55,
} as const;

const FRONT = {
  src: asset(frontSrc),
  file: 'pilot/assets-refs/club-de-nuit-intense/bottle_front.jpg',
  widthPx: 720,
  heightPx: 1100,
};

export const clubDeNuitIntense = ProductConfigSchema.parse({
  slug: 'club-de-nuit-intense',
  name: 'Club de Nuit Intense',
  brand: 'Armaf',
  dataSource:
    'Fotos oficiales de armaf.com/products/club-de-nuit-intense-man-4; pilot/assets-refs/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS desde la foto oficial (altura supuesta 140 mm; fondo supuesto 42 mm).',
  },
  /*
   * Caja: frontal oficial en plano (Intense_Group-1). Laterales, trasera y tapa no
   * aparecen: color muestreado. Apertura no visible: se supone solapa superior.
   */
  box: {
    ...CLUB_DE_NUIT_BOX,
    estimated: true,
    opening: 'top-flap',
    lidFraction: 0,
    bottlePose: 'standing',
    color: '#1d1d20',
    insideColor: '#141416',
    faces: {
      front: {
        src: asset(boxFront),
        file: 'pilot/assets-refs/club-de-nuit-intense/box_front.jpg',
        origin: 'OFFICIAL',
        sourceUrl:
          'https://cdn.shopify.com/s/files/1/0875/1513/6299/files/Intense_Group-1_copy.jpg',
      },
    },
  },
  scale: 1,
  bottle: {
    ...CLUB_DE_NUIT_PRISM,
    // Foto: medallón con centro en x≈613, y≈782 px y radio ≈115 px.
    pendant: {
      radiusMm: 16,
      depthMm: 3,
      centerFromBaseMm: 43.8,
      links: 9,
      linkRadiusMm: 1.7,
    },
  },
  materials: {
    body: { color: '#26262b', roughness: 0.55, metalness: 0.2 },
    cap: { color: '#2e2d33', roughness: 0.4, metalness: 0.5 },
    accent: { color: '#a3a6ae', roughness: 0.25, metalness: 0.9 },
  },
  draftImage: { src: FRONT.src, file: FRONT.file },
  frontTexture: {
    ...FRONT,
    centerXPx: 360,
    baseYPx: 1057,
    pxPerMm: 7.2,
    origin: 'OFFICIAL',
    sourceUrl:
      'https://cdn.shopify.com/s/files/1/0875/1513/6299/files/Intense_Man_Bottle-2_copy.jpg',
  },
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
