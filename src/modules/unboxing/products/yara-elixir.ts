import boxFrontFoil from '@pilot-refs/yara-elixir/box_front_foil.png';
import frontSrc from '@pilot-refs/yara-elixir/bottle_front.jpg';
import boxFront from '@pilot-refs/yara-elixir/box_front.jpg';
import { LATTAFA_CYLINDER_PROFILE } from './asad';
import { asset } from './asset';
import { PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Molde cilíndrico de Yara con las proporciones medidas en la foto oficial
 * YaraElixirBottle.png (frasco de y=178 a y=1323 px), altura supuesta 140 mm.
 * Medidas ESTIMADAS hasta el kit de tienda.
 */
const FRONT = {
  src: asset(frontSrc),
  file: 'pilot/assets-refs/yara-elixir/bottle_front.jpg',
  widthPx: 609,
  heightPx: 1100,
};

export const yaraElixir = ProductConfigSchema.parse({
  slug: 'yara-elixir',
  name: 'Yara Elixir',
  brand: 'Lattafa',
  dataSource:
    'Fotos oficiales de lattafa-usa.com/products/yara-elixir; pilot/assets-refs/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS desde la foto oficial (altura supuesta 140 mm). Pendiente del kit de tienda.',
  },
  /*
   * Caja: frontal oficial en plano (YaraElixirBox.png, 0,598 ancho/alto); alto y fondo
   * de la caja de Yara (misma línea). Laterales y tapa no aparecen: color muestreado.
   */
  box: {
    widthMm: 93,
    heightMm: 156,
    depthMm: 88,
    estimated: true,
    opening: 'top-flap',
    lidFraction: 0,
    bottlePose: 'standing',
    color: '#e3a6b6',
    insideColor: '#d3a0ae',
    faces: {
      front: {
        src: asset(boxFront),
        file: 'pilot/assets-refs/yara-elixir/box_front.jpg',
        origin: 'OFFICIAL',
        sourceUrl:
          'https://cdn.shopify.com/s/files/1/0754/4936/8799/files/YaraElixirBox.png',
        foil: {
          src: asset(boxFrontFoil),
          file: 'pilot/assets-refs/yara-elixir/box_front_foil.png',
        },
      },
    },
  },
  scale: 1,
  bottle: {
    ...LATTAFA_CYLINDER_PROFILE,
    capHeightMm: 30.4,
    capRadiusMm: 28.5,
    neckHeightMm: 2.7,
    neckRadiusMm: 21.6,
    bodyHeightMm: 106.9,
    bodyTopRadiusMm: 28.3,
    bodyBottomRadiusMm: 24,
    // Foto: medallón con centro en x≈758, y≈910 px y radio ≈88 px.
    medallion: {
      radiusMm: 10.8,
      depthMm: 2,
      centerFromBaseMm: 50.5,
      offsetXMm: 5.7,
    },
  },
  materials: {
    body: { color: '#d7a7aa', roughness: 0.45, metalness: 0 },
    cap: { color: '#d7a7aa', roughness: 0.4, metalness: 0 },
    accent: { color: '#d9a28f', roughness: 0.16, metalness: 1 },
  },
  draftImage: { src: FRONT.src, file: FRONT.file },
  frontTexture: {
    ...FRONT,
    centerXPx: 304.4,
    baseYPx: 1041.6,
    pxPerMm: 7.023,
    origin: 'OFFICIAL',
    sourceUrl:
      'https://cdn.shopify.com/s/files/1/0754/4936/8799/files/YaraElixirBottle.png',
  },
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
