import boxFrontFoil from '@pilot-refs/khamrah/box_front_foil.png';
import draftSrc from '@pilot-drafts/khamrah/khamrah_bottle-34_nbpro_v2_DRAFT.png';
import boxFront from '@pilot-refs/khamrah/box_front.jpg';
import boxRight from '@pilot-refs/khamrah/box_right.jpg';
import { asset } from './asset';
import { PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Khamrah: NO hay draft frontal (el válido es 3/4, §9). Las proporciones se
 * estiman desde la vista 3/4 (frasco de y=197 a y=815 px; caras visibles de
 * 317 y 163 px → giro ≈27°, lado ≈356 px) con una altura supuesta de 140 mm.
 * El vidrio se hace en código (transmission) con un normal map de estrías
 * PROVISIONAL. La placa usa el recorte de la placa del draft 3/4 (casi frontal).
 */
const DRAFT = {
  src: asset(draftSrc),
  file: 'khamrah/khamrah_bottle-34_nbpro_v2_DRAFT.png',
  widthPx: 1024,
  heightPx: 1024,
};

export const khamrah = ProductConfigSchema.parse({
  slug: 'khamrah',
  name: 'Khamrah',
  brand: 'Lattafa',
  dataSource:
    'pilot/PILOTO_ANIMACION_FLUJO.md §3 y §9; pilot/assets-drafts/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS desde el draft 3/4 (altura supuesta 140 mm). Pendiente del kit de tienda.',
  },
  /*
   * Caja: referencia oficial (pilot/assets-refs/khamrah). Tapa negra que se levanta de una
   * base con acabado de madera (81 % / 19 % de la altura). Proporciones ESTIMADAS respecto al
   * frasco en official_khamrah-2.jpg (alto ≈ 1,65 × frasco). El lateral izquierdo no aparece:
   * se usa el derecho (liso, negro y madera). Interior: color neutro (sin imagen).
   */
  box: {
    widthMm: 138,
    heightMm: 230,
    depthMm: 138,
    estimated: true,
    opening: 'lift-lid',
    lidFraction: 0.81,
    bottlePose: 'standing',
    color: '#1f1f1f',
    baseColor: '#cdbba7',
    insideColor: '#2a2622',
    faces: {
      front: {
        src: asset(boxFront),
        file: 'pilot/assets-refs/khamrah/box_front.jpg',
        origin: 'OFFICIAL',
        foil: {
          src: asset(boxFrontFoil),
          file: 'pilot/assets-refs/khamrah/box_front_foil.png',
        },
      },
      right: {
        src: asset(boxRight),
        file: 'pilot/assets-refs/khamrah/box_right.jpg',
        origin: 'OFFICIAL',
      },
      left: {
        src: asset(boxRight),
        file: 'pilot/assets-refs/khamrah/box_right.jpg',
        origin: 'OFFICIAL',
        simulated:
          'No aparece en ninguna imagen: copia del lateral derecho (liso).',
      },
    },
  },
  scale: 1,
  bottle: {
    archetype: 'square-glass',
    body: { widthMm: 80.6, heightMm: 83.8, bevelMm: 4, wallMm: 6, baseMm: 12 },
    liquidFill: 0.96,
    cap: { widthMm: 79, heightMm: 56.2, bevelMm: 4 },
    plate: {
      widthMm: 33,
      heightMm: 34,
      thicknessMm: 1.2,
      centerFromBaseMm: 37.8,
    },
    flutes: { repeat: 1.5, strength: 0.9 },
    plateTexture: {
      ...DRAFT,
      quadPx: [
        [528, 576],
        [658, 572],
        [658, 719],
        [528, 725],
      ],
    },
  },
  materials: {
    body: {
      color: '#ffffff',
      roughness: 0.05,
      metalness: 0,
      transmission: 1,
      ior: 1.5,
      thicknessMm: 20,
    },
    cap: {
      color: '#ffffff',
      roughness: 0.05,
      metalness: 0,
      transmission: 1,
      ior: 1.5,
      thicknessMm: 45,
    },
    accent: { color: '#e2c56b', roughness: 0.35, metalness: 0.9 },
    liquid: { color: '#9a4a14', roughness: 0.2, metalness: 0 },
  },
  draftImage: { src: DRAFT.src, file: DRAFT.file },
  frontTexture: null,
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
