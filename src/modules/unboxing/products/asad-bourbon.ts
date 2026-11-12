import frontSrc from '@pilot-refs/asad-bourbon/bottle_front.jpg';
import { LATTAFA_CYLINDER_PROFILE } from './asad';
import { asset } from './asset';
import { PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Molde cilíndrico de Asad con las proporciones medidas en la foto oficial
 * (pilot/assets-refs/PROVENANCE.md): frasco de y=85 a y=1539 px, altura supuesta
 * 140 mm, como en los pilotos. Medidas ESTIMADAS hasta el kit de tienda.
 */
const FRONT = {
  src: asset(frontSrc),
  file: 'pilot/assets-refs/asad-bourbon/bottle_front.jpg',
  widthPx: 609,
  heightPx: 1100,
};

export const asadBourbon = ProductConfigSchema.parse({
  slug: 'asad-bourbon',
  name: 'Asad Bourbon',
  brand: 'Lattafa',
  dataSource:
    'Foto oficial de la ficha (product_media, lattafa.com); pilot/assets-refs/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS desde la foto oficial (altura supuesta 140 mm). Pendiente del kit de tienda.',
  },
  /*
   * Caja: NO hay imagen oficial del estuche de 100 ml (solo del estuche de regalo,
   * que es otra caja). Sin caras: medidas de la caja de Asad (mismo frasco) y el
   * marrón del estuche de regalo, como suposición.
   */
  box: {
    widthMm: 92,
    heightMm: 158,
    depthMm: 90,
    estimated: true,
    opening: 'top-flap',
    lidFraction: 0,
    bottlePose: 'standing',
    color: '#6d3930',
    insideColor: '#4a2620',
    faces: {},
  },
  scale: 1,
  bottle: {
    ...LATTAFA_CYLINDER_PROFILE,
    capHeightMm: 30.5,
    capRadiusMm: 28.4,
    neckHeightMm: 3.1,
    neckRadiusMm: 21.5,
    bodyHeightMm: 106.4,
    bodyTopRadiusMm: 28.2,
    bodyBottomRadiusMm: 24,
    // Foto: medallón con centro en x≈462, y≈945 px y radio ≈115 px.
    medallion: {
      radiusMm: 11.1,
      depthMm: 2,
      centerFromBaseMm: 57.2,
      offsetXMm: 6.7,
    },
  },
  materials: {
    body: { color: '#7a4b39', roughness: 0.6, metalness: 0 },
    cap: { color: '#7a4b39', roughness: 0.55, metalness: 0 },
    accent: { color: '#9b7a5e', roughness: 0.22, metalness: 1 },
  },
  draftImage: { src: FRONT.src, file: FRONT.file },
  frontTexture: {
    ...FRONT,
    centerXPx: 304.1,
    baseYPx: 1041.2,
    pxPerMm: 7.0174,
    origin: 'OFFICIAL',
    sourceUrl: 'https://lattafa.com/product/asad-bourbon/',
  },
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
