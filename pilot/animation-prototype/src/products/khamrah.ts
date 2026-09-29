import draftSrc from '@drafts/khamrah/khamrah_bottle-34_nbpro_v2_DRAFT.png';
import { BOX_PLACEHOLDER, PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Khamrah: NO hay draft frontal (el válido es 3/4, §9). Las proporciones se
 * estiman desde la vista 3/4 (frasco de y=197 a y=815 px; caras visibles de
 * 317 y 163 px → giro ≈27°, lado ≈356 px) con una altura supuesta de 140 mm.
 * El vidrio se hace en código (transmission) con un normal map de estrías
 * PROVISIONAL. La placa usa el recorte de la placa del draft 3/4 (casi frontal).
 */
const DRAFT = {
  src: draftSrc,
  file: 'khamrah/khamrah_bottle-34_nbpro_v2_DRAFT.png',
  widthPx: 1024,
  heightPx: 1024,
};

export const khamrah = ProductConfigSchema.parse({
  slug: 'khamrah',
  name: 'Khamrah',
  brand: 'Lattafa',
  dataSource: 'pilot/PILOTO_ANIMACION_FLUJO.md §3 y §9; pilot/assets-drafts/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS desde el draft 3/4 (altura supuesta 140 mm). Pendiente del kit de tienda.',
  },
  box: {
    ...BOX_PLACEHOLDER,
    widthMm: 94,
    heightMm: 152,
    depthMm: 94,
    // Sin fotos todavía: se añaden en faces (front, back, left, right, top, bottom, inside).
    faces: {},
  },
  scale: 1,
  bottle: {
    archetype: 'square-glass',
    body: { widthMm: 80.6, heightMm: 83.8, bevelMm: 4, wallMm: 6, baseMm: 12 },
    liquidFill: 0.96,
    cap: { widthMm: 79, heightMm: 56.2, bevelMm: 4 },
    plate: { widthMm: 33, heightMm: 34, thicknessMm: 1.2, centerFromBaseMm: 37.8 },
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
    body: { color: '#ffffff', roughness: 0.05, metalness: 0, transmission: 1, ior: 1.5, thicknessMm: 20 },
    cap: { color: '#ffffff', roughness: 0.05, metalness: 0, transmission: 1, ior: 1.5, thicknessMm: 45 },
    accent: { color: '#e2c56b', roughness: 0.35, metalness: 0.9 },
    liquid: { color: '#9a4a14', roughness: 0.2, metalness: 0 },
  },
  draftImage: { src: DRAFT.src, file: DRAFT.file },
  frontTexture: null,
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
