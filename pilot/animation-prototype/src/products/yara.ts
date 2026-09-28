import draftSrc from '@drafts/yara/yara_bottle-front_nb_v1_DRAFT.png';
import { LATTAFA_CYLINDER_PROFILE } from './asad';
import { PLACEHOLDER_DESCRIPTION } from './placeholders';
import { ProductConfigSchema } from './schema';

/*
 * Yara reutiliza el perfil de Asad (plan §3). En los drafts la proporción ancho/alto
 * coincide (≈0,40 frente a 0,40), pero falta CONFIRMARLO midiendo el frasco real.
 * Medidas ESTIMADAS (altura supuesta 140 mm). Draft Flash v1: el medallón lleva
 * un texto probablemente inventado (§9), así que la textura es solo de prueba.
 */
const DRAFT = {
  src: draftSrc,
  file: 'yara/yara_bottle-front_nb_v1_DRAFT.png',
  widthPx: 1024,
  heightPx: 1024,
};

export const yara = ProductConfigSchema.parse({
  slug: 'yara',
  name: 'Yara',
  brand: 'Lattafa',
  dataSource: 'pilot/PILOTO_ANIMACION_FLUJO.md §3 y §9; pilot/assets-drafts/PROVENANCE.md',
  measurements: {
    estimated: true,
    note: 'ESTIMADAS: perfil de Asad, pendiente de confirmar con el kit de tienda.',
    box: { widthMm: 72, heightMm: 152, depthMm: 72 },
  },
  scale: 1,
  bottle: {
    ...LATTAFA_CYLINDER_PROFILE,
    // Draft: aro del medallón en x≈486–586, y≈532–642 px.
    medallion: { radiusMm: 11, depthMm: 2, centerFromBaseMm: 51.8, offsetXMm: 5.6 },
  },
  materials: {
    body: { color: '#e9b9c3', roughness: 0.5, metalness: 0 },
    cap: { color: '#e9b9c3', roughness: 0.45, metalness: 0 },
    accent: { color: '#dcdde0', roughness: 0.14, metalness: 1 },
  },
  boxColor: '#e2dbd0',
  draftImage: { src: DRAFT.src, file: DRAFT.file },
  // Frasco de y=187 a y=822 px (sin la sombra), centro en x=510,5.
  frontTexture: { ...DRAFT, centerXPx: 510.5, baseYPx: 822, pxPerMm: 635 / 140 },
  panel: { priceLabel: '— €', description: PLACEHOLDER_DESCRIPTION },
});
