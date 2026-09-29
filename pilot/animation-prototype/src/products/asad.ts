import draftSrc from '@drafts/asad/asad_bottle-front_nbpro_v1_DRAFT.png';
import { BOX_PLACEHOLDER, PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Medidas ESTIMADAS: proporciones medidas en píxeles sobre el draft
 * asad_bottle-front_nbpro_v1_DRAFT.png (frasco de y=221 a y=982 px, ancho/alto ≈ 0,40)
 * y escaladas a una altura supuesta de 140 mm. La caja es una suposición
 * (frasco + holgura). Sustituir por las medidas del kit de tienda (§4 paso 1).
 */
export const ASAD_DRAFT = {
  src: draftSrc,
  file: 'asad/asad_bottle-front_nbpro_v1_DRAFT.png',
  widthPx: 896,
  heightPx: 1200,
};

/**
 * Perfil compartido por Asad y Yara (plan §3: «mismo modelo»).
 * El medallón se calibra por producto contra su draft.
 */
export const LATTAFA_CYLINDER_PROFILE = {
  archetype: 'lathe-shoulder',
  capHeightMm: 27.7,
  capRadiusMm: 28.3,
  capRimHeightMm: 4,
  neckHeightMm: 4.4,
  neckRadiusMm: 22,
  bodyHeightMm: 107.9,
  bodyTopRadiusMm: 28.3,
  bodyBottomRadiusMm: 24,
  shoulderFilletMm: 2.5,
  baseFilletMm: 4,
  bodyRingHeightMm: 6,
  textureArcDeg: 72,
} as const;

export const asad = ProductConfigSchema.parse({
  slug: 'asad',
  name: 'Asad',
  brand: 'Lattafa',
  dataSource: 'pilot/PILOTO_ANIMACION_FLUJO.md §3 y §9; pilot/assets-drafts/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS desde el draft (altura supuesta 140 mm). Pendiente del kit de tienda.',
  },
  box: {
    ...BOX_PLACEHOLDER,
    widthMm: 72,
    heightMm: 152,
    depthMm: 72,
    // Sin fotos todavía: se añaden en faces (front, back, left, right, top, bottom, inside).
    faces: {},
  },
  scale: 1,
  bottle: {
    ...LATTAFA_CYLINDER_PROFILE,
    // Draft: aro del medallón en x≈424–535, y≈622–735 px.
    medallion: { radiusMm: 10.2, depthMm: 2, centerFromBaseMm: 55.7, offsetXMm: 5.8 },
  },
  materials: {
    body: { color: '#121212', roughness: 0.85, metalness: 0 },
    cap: { color: '#121212', roughness: 0.8, metalness: 0 },
    accent: { color: '#c9a24a', roughness: 0.18, metalness: 1 },
  },
  draftImage: { src: ASAD_DRAFT.src, file: ASAD_DRAFT.file },
  frontTexture: { ...ASAD_DRAFT, centerXPx: 447.5, baseYPx: 982, pxPerMm: 761 / 140 },
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
