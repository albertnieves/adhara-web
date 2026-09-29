import draftSrc from '@drafts/club-de-nuit-intense-man-le/cdn-le_bottle-front_nbpro_v2_DRAFT.png';
import { BOX_PLACEHOLDER, PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Edición: CLUB DE NUIT INTENSE MAN LIMITED EDITION (decisión C-03, §9).
 * Medidas ESTIMADAS desde cdn-le_bottle-front_nbpro_v2_DRAFT.png (frasco de y=166 a
 * y=1028 px, centro x=452) escaladas a una altura supuesta de 140 mm.
 * El FONDO del prisma no se ve en el draft: 42 mm es una suposición.
 */
const DRAFT = {
  src: draftSrc,
  file: 'club-de-nuit-intense-man-le/cdn-le_bottle-front_nbpro_v2_DRAFT.png',
  widthPx: 896,
  heightPx: 1200,
};

export const clubDeNuitIntenseManLE = ProductConfigSchema.parse({
  slug: 'club-de-nuit-intense-man-le',
  name: 'Club de Nuit Intense Man Limited Edition',
  brand: 'Armaf',
  dataSource: 'pilot/PILOTO_ANIMACION_FLUJO.md §3 y §9 (decisión C-03); PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS desde el draft (altura supuesta 140 mm; fondo supuesto 42 mm).',
  },
  box: {
    ...BOX_PLACEHOLDER,
    widthMm: 100,
    heightMm: 152,
    depthMm: 60,
    // Sin fotos todavía: se añaden en faces (front, back, left, right, top, bottom, inside).
    faces: {},
  },
  scale: 1,
  bottle: {
    archetype: 'rect-prism',
    body: { widthMm: 84.1, heightMm: 101, depthMm: 42, bevelMm: 3 },
    collar: { heightMm: 5.5, radiusMm: 20.2 },
    neck: { heightMm: 3.6, radiusMm: 15 },
    cap: { widthMm: 45.6, heightMm: 29.9, depthMm: 45.6, bevelMm: 2 },
    pendant: { radiusMm: 16.9, depthMm: 3, centerFromBaseMm: 46.8, links: 9, linkRadiusMm: 1.7 },
  },
  materials: {
    body: { color: '#57565c', roughness: 0.32, metalness: 0.55 },
    cap: { color: '#3d3c41', roughness: 0.28, metalness: 0.8 },
    accent: { color: '#2f2e33', roughness: 0.3, metalness: 0.9 },
  },
  draftImage: { src: DRAFT.src, file: DRAFT.file },
  frontTexture: { ...DRAFT, centerXPx: 452, baseYPx: 1028, pxPerMm: 862 / 140 },
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
