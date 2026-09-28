import draftSrc from '@drafts/asad/asad_bottle-front_nbpro_v1_DRAFT.png';
import { PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Medidas ESTIMADAS: proporciones medidas en píxeles sobre el draft
 * asad_bottle-front_nbpro_v1_DRAFT.png (frasco ≈ 757 px de alto, ancho/alto ≈ 0,40)
 * y escaladas a una altura supuesta de 140 mm. La caja es una suposición
 * (frasco + holgura). Sustituir por las medidas del kit de tienda (§4 paso 1).
 */
export const asad = ProductConfigSchema.parse({
  slug: 'asad',
  name: 'Asad',
  brand: 'Lattafa',
  dataSource: 'pilot/PILOTO_ANIMACION_FLUJO.md §3 y §9; pilot/assets-drafts/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS desde el draft (altura supuesta 140 mm). Pendiente del kit de tienda.',
    box: { widthMm: 72, heightMm: 152, depthMm: 72 },
  },
  scale: 1,
  bottle: {
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
    medallion: { radiusMm: 7.8, depthMm: 2, centerFromBaseMm: 60.7 },
  },
  materials: {
    body: { color: '#121212', roughness: 0.85, metalness: 0 },
    cap: { color: '#121212', roughness: 0.8, metalness: 0 },
    accent: { color: '#c9a24a', roughness: 0.18, metalness: 1 },
  },
  boxColor: '#ece7df',
  draftImage: { src: draftSrc, file: 'asad/asad_bottle-front_nbpro_v1_DRAFT.png' },
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
