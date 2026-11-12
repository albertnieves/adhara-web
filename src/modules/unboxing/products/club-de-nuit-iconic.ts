import frontSrc from '@pilot-refs/club-de-nuit-iconic/bottle_front.jpg';
import { asset } from './asset';
import { CLUB_DE_NUIT_BOX, CLUB_DE_NUIT_PRISM } from './club-de-nuit-intense';
import { PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Mismo molde que Club de Nuit Intense (comprobado en la foto oficial del de 105 ml,
 * 35721_6.png: tapón, collarín y cuerpo en las mismas proporciones). La foto está
 * en 3/4: el frontal y la cara del tapón se enderezaron a 10 px/mm sobre las medidas
 * del molde (pilot/assets-refs/PROVENANCE.md).
 */
const FRONT = {
  src: asset(frontSrc),
  file: 'pilot/assets-refs/club-de-nuit-iconic/bottle_front.jpg',
  widthPx: 900,
  heightPx: 1500,
};

export const clubDeNuitIconic = ProductConfigSchema.parse({
  slug: 'club-de-nuit-iconic',
  name: 'Club de Nuit Iconic',
  brand: 'Armaf',
  dataSource:
    'Foto oficial del formato de 105 ml en armaf.com/products/club-de-nuit-blue-iconic-200ml; pilot/assets-refs/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS: molde de Club de Nuit Intense (altura supuesta 140 mm).',
  },
  /*
   * Caja: la única foto oficial es la del estuche de 200 ml (pone «200ML»), que no
   * es la del formato que se vende. Sin caras: medidas del estuche de Intense y el
   * azul del frontal de esa caja, como suposición.
   */
  box: {
    ...CLUB_DE_NUIT_BOX,
    estimated: true,
    opening: 'top-flap',
    lidFraction: 0,
    bottlePose: 'standing',
    color: '#0186f4',
    insideColor: '#e9eef5',
    faces: {},
  },
  scale: 1,
  bottle: {
    ...CLUB_DE_NUIT_PRISM,
    // Medallón alineado con el frontal enderezado (centro a +5,5 mm del eje).
    pendant: {
      radiusMm: 18.3,
      depthMm: 3,
      centerFromBaseMm: 49.9,
      links: 9,
      linkRadiusMm: 1.7,
      offsetXMm: 5.5,
    },
  },
  materials: {
    body: { color: '#1f48c8', roughness: 0.3, metalness: 0.25 },
    cap: { color: '#d4d6da', roughness: 0.2, metalness: 1 },
    accent: { color: '#c8cbd0', roughness: 0.2, metalness: 1 },
  },
  draftImage: { src: FRONT.src, file: FRONT.file },
  frontTexture: {
    ...FRONT,
    centerXPx: 450,
    baseYPx: 1450,
    pxPerMm: 10,
    origin: 'OFFICIAL',
    sourceUrl:
      'https://cdn.shopify.com/s/files/1/0875/1513/6299/files/35721_6.png',
  },
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
