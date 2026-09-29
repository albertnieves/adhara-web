import { CylinderGeometry, LatheGeometry, Vector2 } from 'three';
import type { ShapeOf } from '../../products/schema';

type Lathe = ShapeOf<'lathe-shoulder'>;

const SEGMENTS = 96;
/** Separación de la «piel» texturizada sobre el cuerpo (mm), para evitar z-fighting. */
const SKIN = 0.12;

/** Arco de cuarto de círculo entre dos puntos del perfil (esquina redondeada). */
function fillet(
  out: Vector2[],
  cx: number,
  cy: number,
  r: number,
  fromDeg: number,
  toDeg: number,
  steps = 8,
) {
  for (let i = 0; i <= steps; i++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    out.push(new Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
}

/** Radio del cuerpo a una altura dada (el cuerpo se estrecha hacia la base). */
export function bodyRadiusAt(s: Lathe, y: number) {
  const k = Math.min(1, Math.max(0, y / s.bodyHeightMm));
  return s.bodyBottomRadiusMm + (s.bodyTopRadiusMm - s.bodyBottomRadiusMm) * k;
}

function profiles(s: Lathe) {
  // Cuerpo: base redondeada, flanco con ligera conicidad y hombro redondeado.
  const body: Vector2[] = [new Vector2(0, 0)];
  const h = s.bodyHeightMm;
  fillet(body, s.bodyBottomRadiusMm - s.baseFilletMm, s.baseFilletMm, s.baseFilletMm, -90, 0);
  fillet(
    body,
    s.bodyTopRadiusMm - s.shoulderFilletMm,
    h - s.shoulderFilletMm,
    s.shoulderFilletMm,
    0,
    90,
  );
  body.push(new Vector2(0, h));

  // Tapón: cilindro con cantos redondeados.
  const capY0 = h + s.neckHeightMm;
  const capY1 = capY0 + s.capHeightMm;
  const f = Math.min(2, s.capHeightMm / 6);
  const cap: Vector2[] = [new Vector2(0, capY0)];
  fillet(cap, s.capRadiusMm - f, capY0 + f, f, -90, 0, 5);
  fillet(cap, s.capRadiusMm - f, capY1 - f, f, 0, 90, 5);
  cap.push(new Vector2(0, capY1));
  return { body, cap, capY1, f };
}

/** Solo el flanco del perfil (sin los polos), desplazado hacia fuera. */
const skin = (pts: Vector2[]) =>
  pts.filter((p) => p.x > 0.5).map((p) => new Vector2(p.x + SKIN, p.y));

/**
 * Geometrías en milímetros, con el origen en el centro de la base y el frente en +Z.
 * El grupo que las contiene aplica la escala mm → unidades.
 */
export function buildLatheShoulder(s: Lathe) {
  const { body, cap, capY1, f } = profiles(s);
  const h = s.bodyHeightMm;
  const rt = s.bodyTopRadiusMm;

  const neck = new CylinderGeometry(s.neckRadiusMm, s.neckRadiusMm, s.neckHeightMm + 1, SEGMENTS);
  neck.translate(0, h + s.neckHeightMm / 2, 0);

  // Aros metálicos: ligeramente por fuera del cuerpo/tapón.
  let bodyRing: CylinderGeometry | null = null;
  if (s.bodyRingHeightMm > 0) {
    const rBelow = bodyRadiusAt(s, h - s.bodyRingHeightMm);
    bodyRing = new CylinderGeometry(rt + 0.35, rBelow + 0.35, s.bodyRingHeightMm, SEGMENTS, 1, true);
    bodyRing.translate(0, h - s.bodyRingHeightMm / 2 - s.shoulderFilletMm * 0.4, 0);
  }
  let capRim: CylinderGeometry | null = null;
  if (s.capRimHeightMm > 0) {
    const r = s.capRadiusMm + 0.35;
    capRim = new CylinderGeometry(r, r, s.capRimHeightMm, SEGMENTS, 1, true);
    capRim.translate(0, capY1 - s.capRimHeightMm / 2 - f * 0.4, 0);
  }

  let medallion: CylinderGeometry | null = null;
  if (s.medallion) {
    const m = s.medallion;
    medallion = new CylinderGeometry(m.radiusMm, m.radiusMm, m.depthMm, 48);
    medallion.rotateX(Math.PI / 2);
    const r = bodyRadiusAt(s, m.centerFromBaseMm);
    const z = Math.sqrt(Math.max(0, r * r - m.offsetXMm * m.offsetXMm));
    medallion.translate(m.offsetXMm, m.centerFromBaseMm, z + m.depthMm / 2 - 0.4);
  }

  // «Piel» frontal: mismo perfil en un arco limitado, para la textura proyectada.
  const arc = (s.textureArcDeg * Math.PI) / 180;
  const bodySkin = new LatheGeometry(skin(body), SEGMENTS / 2, -arc, 2 * arc);
  const capSkin = new LatheGeometry(skin(cap), SEGMENTS / 2, -arc, 2 * arc);

  return {
    body: new LatheGeometry(body, SEGMENTS),
    cap: new LatheGeometry(cap, SEGMENTS),
    neck,
    bodyRing,
    capRim,
    medallion,
    bodySkin,
    capSkin,
  };
}

export function latheShoulderSize(s: Lathe) {
  return {
    heightMm: s.bodyHeightMm + s.neckHeightMm + s.capHeightMm,
    /** Anchura máxima durante el giro. */
    widthMm: 2 * Math.max(s.capRadiusMm, s.bodyTopRadiusMm),
  };
}
