import boxFrontFoil from '@pilot-refs/yara-moi/box_front_foil.png';
import boxLeftFoil from '@pilot-refs/yara-moi/box_left_foil.png';
import frontSrc from '@pilot-refs/yara-moi/bottle_front.jpg';
import boxFront from '@pilot-refs/yara-moi/box_front.jpg';
import boxLeft from '@pilot-refs/yara-moi/box_left.jpg';
import { LATTAFA_CYLINDER_PROFILE } from './asad';
import { asset } from './asset';
import { PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Molde cilíndrico de Yara con las proporciones medidas en la foto oficial
 * Yara-Moi-1.png (frasco de y=272 a y=1224 px), altura supuesta 140 mm.
 * Medidas ESTIMADAS hasta el kit de tienda.
 */
const FRONT = {
  src: asset(frontSrc),
  file: 'pilot/assets-refs/yara-moi/bottle_front.jpg',
  widthPx: 609,
  heightPx: 1100,
};

export const yaraMoi = ProductConfigSchema.parse({
  slug: 'yara-moi',
  name: 'Yara Moi',
  brand: 'Lattafa',
  dataSource:
    'Fotos oficiales de lattafa-usa.com/products/yara-moi; pilot/assets-refs/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS desde la foto oficial (altura supuesta 140 mm). Pendiente del kit de tienda.',
  },
  /*
   * Caja: frontal y lateral izquierdo enderezados de Yara-Moi-3.png (vista 3/4). Las
   * medidas son las de la caja de Yara (misma línea): la foto en 3/4 no da la
   * proporción real. Trasera y tapa no aparecen: color muestreado.
   */
  box: {
    widthMm: 91,
    heightMm: 156,
    depthMm: 88,
    estimated: true,
    opening: 'top-flap',
    lidFraction: 0,
    bottlePose: 'standing',
    color: '#dcdbd0',
    insideColor: '#cfcec3',
    faces: {
      front: {
        src: asset(boxFront),
        file: 'pilot/assets-refs/yara-moi/box_front.jpg',
        origin: 'OFFICIAL',
        sourceUrl:
          'https://cdn.shopify.com/s/files/1/0754/4936/8799/files/Yara-Moi-3_6c37b36d-c2d5-4f3c-8d8e-13f4a01f1d1b.png',
        foil: {
          src: asset(boxFrontFoil),
          file: 'pilot/assets-refs/yara-moi/box_front_foil.png',
        },
      },
      left: {
        src: asset(boxLeft),
        file: 'pilot/assets-refs/yara-moi/box_left.jpg',
        origin: 'OFFICIAL',
        sourceUrl:
          'https://cdn.shopify.com/s/files/1/0754/4936/8799/files/Yara-Moi-3_6c37b36d-c2d5-4f3c-8d8e-13f4a01f1d1b.png',
        foil: {
          src: asset(boxLeftFoil),
          file: 'pilot/assets-refs/yara-moi/box_left_foil.png',
        },
      },
      right: {
        src: asset(boxLeft),
        file: 'pilot/assets-refs/yara-moi/box_left.jpg',
        origin: 'OFFICIAL',
        foil: {
          src: asset(boxLeftFoil),
          file: 'pilot/assets-refs/yara-moi/box_left_foil.png',
        },
        simulated: 'No aparece en ninguna imagen: copia del lateral izquierdo.',
      },
    },
  },
  scale: 1,
  bottle: {
    ...LATTAFA_CYLINDER_PROFILE,
    capHeightMm: 30.3,
    capRadiusMm: 26.8,
    neckHeightMm: 3.5,
    neckRadiusMm: 21,
    bodyHeightMm: 106.2,
    bodyTopRadiusMm: 27,
    bodyBottomRadiusMm: 24,
    // Foto: medallón con centro en x≈782, y≈832 px y radio ≈74 px.
    medallion: {
      radiusMm: 10.9,
      depthMm: 2,
      centerFromBaseMm: 57.6,
      offsetXMm: 4,
    },
  },
  materials: {
    body: { color: '#f3f3f6', roughness: 0.35, metalness: 0 },
    cap: { color: '#f3f3f6', roughness: 0.3, metalness: 0 },
    accent: { color: '#d6b46a', roughness: 0.16, metalness: 1 },
  },
  draftImage: { src: FRONT.src, file: FRONT.file },
  frontTexture: {
    ...FRONT,
    centerXPx: 304.4,
    baseYPx: 1041.2,
    pxPerMm: 7.0169,
    origin: 'OFFICIAL',
    sourceUrl:
      'https://cdn.shopify.com/s/files/1/0754/4936/8799/files/Yara-Moi-1_81ec2a74-066f-45ef-b35a-465dfda22eac.png',
  },
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
