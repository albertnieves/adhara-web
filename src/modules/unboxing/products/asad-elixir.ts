import boxFrontFoil from '@pilot-refs/asad-elixir/box_front_foil.png';
import frontSrc from '@pilot-refs/asad-elixir/bottle_front.jpg';
import boxFront from '@pilot-refs/asad-elixir/box_front.jpg';
import { LATTAFA_CYLINDER_PROFILE } from './asad';
import { asset } from './asset';
import { PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Molde cilíndrico de Asad con las proporciones medidas en la foto oficial
 * ASADELIXIRBOTTLE.png (frasco de y=154 a y=1355 px), altura supuesta 140 mm.
 * Medidas ESTIMADAS hasta el kit de tienda.
 */
const FRONT = {
  src: asset(frontSrc),
  file: 'pilot/assets-refs/asad-elixir/bottle_front.jpg',
  widthPx: 608,
  heightPx: 1100,
};

export const asadElixir = ProductConfigSchema.parse({
  slug: 'asad-elixir',
  name: 'Asad Elixir',
  brand: 'Lattafa',
  dataSource:
    'Fotos oficiales de lattafa-usa.com/products/asad-elixir; pilot/assets-refs/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS desde la foto oficial (altura supuesta 140 mm). Pendiente del kit de tienda.',
  },
  /*
   * Caja: frontal oficial en plano (AsadElixirBox.png, 0,576 ancho/alto). Medidas de
   * la caja de Asad (misma línea). Laterales y tapa no aparecen: color muestreado.
   */
  box: {
    widthMm: 92,
    heightMm: 158,
    depthMm: 90,
    estimated: true,
    opening: 'top-flap',
    lidFraction: 0,
    bottlePose: 'standing',
    color: '#2a2829',
    insideColor: '#1a1a1a',
    faces: {
      front: {
        src: asset(boxFront),
        file: 'pilot/assets-refs/asad-elixir/box_front.jpg',
        origin: 'OFFICIAL',
        sourceUrl:
          'https://cdn.shopify.com/s/files/1/0754/4936/8799/files/AsadElixirBox.png',
        foil: {
          src: asset(boxFrontFoil),
          file: 'pilot/assets-refs/asad-elixir/box_front_foil.png',
        },
      },
    },
  },
  scale: 1,
  bottle: {
    ...LATTAFA_CYLINDER_PROFILE,
    capHeightMm: 30.4,
    capRadiusMm: 27,
    neckHeightMm: 2,
    neckRadiusMm: 20.6,
    bodyHeightMm: 107.6,
    bodyTopRadiusMm: 26.9,
    bodyBottomRadiusMm: 23.4,
    // Foto: medallón con centro en x≈737, y≈833 px y radio ≈93 px.
    medallion: {
      radiusMm: 10.8,
      depthMm: 2,
      centerFromBaseMm: 60.8,
      offsetXMm: 3.3,
    },
  },
  materials: {
    body: { color: '#2b2b2b', roughness: 0.8, metalness: 0 },
    cap: { color: '#2b2b2b', roughness: 0.75, metalness: 0 },
    accent: { color: '#8e8e92', roughness: 0.2, metalness: 1 },
  },
  draftImage: { src: FRONT.src, file: FRONT.file },
  frontTexture: {
    ...FRONT,
    centerXPx: 304.2,
    baseYPx: 1041.1,
    pxPerMm: 7.0159,
    origin: 'OFFICIAL',
    sourceUrl:
      'https://cdn.shopify.com/s/files/1/0754/4936/8799/files/ASADELIXIRBOTTLE.png',
  },
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
