import { useEffect, useMemo } from 'react';
import { CylinderGeometry, PlaneGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FrontProjection, ShapeOf } from '../../products/schema';
import { DraftMaterial } from '../DraftMaterial';
import { PbrMaterial, type BottleMaterials } from '../materials';
import { projectFront } from '../projection';

type Shape = ShapeOf<'rect-prism'>;

/** Separación de las caras texturizadas (mm). */
const SKIN = 0.15;

export function rectPrismSize(s: Shape) {
  return {
    heightMm:
      s.body.heightMm + s.collar.heightMm + s.neck.heightMm + s.cap.heightMm,
    /** Anchura máxima durante el giro: la diagonal de la planta. */
    widthMm: Math.hypot(s.body.widthMm, s.body.depthMm),
    /** Grosor de frente a espalda. */
    depthMm: s.body.depthMm,
  };
}

function build(s: Shape) {
  const b = s.body;
  const body = new RoundedBoxGeometry(
    b.widthMm,
    b.heightMm,
    b.depthMm,
    4,
    b.bevelMm,
  );
  body.translate(0, b.heightMm / 2, 0);
  const bodyFront = new PlaneGeometry(
    b.widthMm - 2 * b.bevelMm,
    b.heightMm - 2 * b.bevelMm,
  );
  bodyFront.translate(0, b.heightMm / 2, b.depthMm / 2 + SKIN);

  const collarY = b.heightMm + s.collar.heightMm / 2;
  const collar = new CylinderGeometry(
    s.collar.radiusMm,
    s.collar.radiusMm,
    s.collar.heightMm,
    64,
  );
  collar.translate(0, collarY, 0);
  const neckY = b.heightMm + s.collar.heightMm + s.neck.heightMm / 2;
  const neck = new CylinderGeometry(
    s.neck.radiusMm,
    s.neck.radiusMm,
    s.neck.heightMm + 0.5,
    48,
  );
  neck.translate(0, neckY, 0);

  const c = s.cap;
  const capY0 = b.heightMm + s.collar.heightMm + s.neck.heightMm;
  const cap = new RoundedBoxGeometry(
    c.widthMm,
    c.heightMm,
    c.depthMm,
    3,
    c.bevelMm,
  );
  cap.translate(0, capY0 + c.heightMm / 2, 0);
  const capFront = new PlaneGeometry(
    c.widthMm - 2 * c.bevelMm,
    c.heightMm - 2 * c.bevelMm,
  );
  capFront.translate(0, capY0 + c.heightMm / 2, c.depthMm / 2 + SKIN);

  // Colgante: disco delante del frente + cadena de eslabones desde el collarín.
  let pendant: CylinderGeometry | null = null;
  const links: {
    geo: TorusGeometry;
    pos: [number, number, number];
    rotY: number;
  }[] = [];
  if (s.pendant) {
    const p = s.pendant;
    const z = b.depthMm / 2 + p.depthMm / 2 + 1.2;
    pendant = new CylinderGeometry(p.radiusMm, p.radiusMm, p.depthMm, 64);
    pendant.rotateX(Math.PI / 2);
    pendant.translate(0, p.centerFromBaseMm, z);
    const top = collarY;
    const bottom = p.centerFromBaseMm + p.radiusMm;
    const z0 = s.collar.radiusMm + p.linkRadiusMm;
    const linkGeo = new TorusGeometry(
      p.linkRadiusMm,
      p.linkRadiusMm * 0.28,
      8,
      16,
    );
    for (let i = 0; i < p.links; i++) {
      const k = p.links === 1 ? 0 : i / (p.links - 1);
      links.push({
        geo: linkGeo,
        pos: [0, top + (bottom - top) * k, z0 + (z - z0) * Math.min(1, k * 3)],
        rotY: i % 2 === 0 ? 0 : Math.PI / 2,
      });
    }
  }
  return { body, bodyFront, collar, neck, cap, capFront, pendant, links };
}

interface Props {
  shape: Shape;
  m: BottleMaterials;
  front: FrontProjection | null;
}

/** Club de Nuit Intense Man LE: prisma gunmetal, tapón cuadrado, cadena y medallón simplificados. */
export function RectPrismBottle({ shape, m, front }: Props) {
  const geo = useMemo(() => build(shape), [shape]);
  const textured = useMemo(() => {
    if (!front) return null;
    return {
      bodyFront: projectFront(geo.bodyFront.clone(), front),
      capFront: projectFront(geo.capFront.clone(), front),
      pendant: geo.pendant ? projectFront(geo.pendant.clone(), front) : null,
    };
  }, [geo, front]);

  useEffect(
    () => () => {
      const { links, ...rest } = geo;
      for (const g of Object.values(rest)) g?.dispose();
      links[0]?.geo.dispose();
      for (const g of Object.values(textured ?? {})) g?.dispose();
    },
    [geo, textured],
  );

  return (
    <>
      <mesh geometry={geo.body}>
        <PbrMaterial config={m.body} />
      </mesh>
      <mesh geometry={geo.collar}>
        <PbrMaterial config={m.accent} />
      </mesh>
      <mesh geometry={geo.neck}>
        <PbrMaterial config={m.accent} />
      </mesh>
      <mesh geometry={geo.cap}>
        <PbrMaterial config={m.cap} />
      </mesh>
      {geo.links.map((l, i) => (
        <mesh key={i} geometry={l.geo} position={l.pos} rotation-y={l.rotY}>
          <PbrMaterial config={m.accent} />
        </mesh>
      ))}
      {textured && front ? (
        <>
          <mesh geometry={textured.bodyFront}>
            <DraftMaterial src={front.src} config={m.body} />
          </mesh>
          <mesh geometry={textured.capFront}>
            <DraftMaterial src={front.src} config={m.cap} />
          </mesh>
          {textured.pendant && (
            <mesh geometry={textured.pendant}>
              <DraftMaterial src={front.src} config={m.accent} />
            </mesh>
          )}
        </>
      ) : (
        geo.pendant && (
          <mesh geometry={geo.pendant}>
            <PbrMaterial config={m.accent} />
          </mesh>
        )
      )}
    </>
  );
}
