import { CylinderGeometry, LatheGeometry, Vector2 } from 'three';
import type { BottleShape } from '../../products/schema';

type Lathe = Extract<BottleShape, { archetype: 'lathe-shoulder' }>;

const SEGMENTS = 96;

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

/**
 * Geometrías en milímetros, con el origen en el centro de la base y el frente en +Z.
 * El grupo que las contiene aplica la escala mm → unidades.
 */
export function buildLatheShoulder(s: Lathe) {
  // Cuerpo: base redondeada, flanco con ligera conicidad y hombro redondeado.
  const body: Vector2[] = [new Vector2(0, 0)];
  const rb = s.bodyBottomRadiusMm;
  const rt = s.bodyTopRadiusMm;
  const h = s.bodyHeightMm;
  fillet(body, rb - s.baseFilletMm, s.baseFilletMm, s.baseFilletMm, -90, 0);
  fillet(body, rt - s.shoulderFilletMm, h - s.shoulderFilletMm, s.shoulderFilletMm, 0, 90);
  body.push(new Vector2(0, h));

  // Tapón: cilindro con cantos redondeados.
  const capY0 = h + s.neckHeightMm;
  const capY1 = capY0 + s.capHeightMm;
  const f = Math.min(2, s.capHeightMm / 6);
  const cap: Vector2[] = [new Vector2(0, capY0)];
  fillet(cap, s.capRadiusMm - f, capY0 + f, f, -90, 0, 5);
  fillet(cap, s.capRadiusMm - f, capY1 - f, f, 0, 90, 5);
  cap.push(new Vector2(0, capY1));

  const neck = new CylinderGeometry(s.neckRadiusMm, s.neckRadiusMm, s.neckHeightMm + 1, SEGMENTS);
  neck.translate(0, h + s.neckHeightMm / 2, 0);

  // Aros metálicos: ligeramente por fuera del cuerpo/tapón para no z-fightear.
  const bodyRing =
    s.bodyRingHeightMm > 0
      ? new CylinderGeometry(rt + 0.35, bodyRadiusAt(s, h - s.bodyRingHeightMm) + 0.35, s.bodyRingHeightMm, SEGMENTS, 1, true)
      : null;
  bodyRing?.translate(0, h - s.bodyRingHeightMm / 2 - s.shoulderFilletMm * 0.4, 0);

  const capRim =
    s.capRimHeightMm > 0
      ? new CylinderGeometry(s.capRadiusMm + 0.35, s.capRadiusMm + 0.35, s.capRimHeightMm, SEGMENTS, 1, true)
      : null;
  capRim?.translate(0, capY1 - s.capRimHeightMm / 2 - f * 0.4, 0);

  let medallion: CylinderGeometry | null = null;
  if (s.medallion) {
    const m = s.medallion;
    medallion = new CylinderGeometry(m.radiusMm, m.radiusMm, m.depthMm, 48);
    medallion.rotateX(Math.PI / 2);
    const r = bodyRadiusAt(s, m.centerFromBaseMm);
    medallion.translate(0, m.centerFromBaseMm, r + m.depthMm / 2 - 0.4);
  }

  return {
    body: new LatheGeometry(body, SEGMENTS),
    cap: new LatheGeometry(cap, SEGMENTS),
    neck,
    bodyRing,
    capRim,
    medallion,
    heightMm: capY1,
    widthMm: 2 * Math.max(s.capRadiusMm, rt),
  };
}

export function latheShoulderSize(s: Lathe) {
  return {
    heightMm: s.bodyHeightMm + s.neckHeightMm + s.capHeightMm,
    widthMm: 2 * Math.max(s.capRadiusMm, s.bodyTopRadiusMm),
  };
}
