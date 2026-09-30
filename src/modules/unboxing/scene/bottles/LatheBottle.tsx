import { useEffect, useMemo } from 'react';
import type { FrontProjection, ShapeOf } from '../../products/schema';
import { DraftMaterial } from '../DraftMaterial';
import { PbrMaterial, type BottleMaterials } from '../materials';
import { fadeLatheEdges, projectFront } from '../projection';
import { buildLatheShoulder } from './latheShoulder';

interface Props {
  shape: ShapeOf<'lathe-shoulder'>;
  m: BottleMaterials;
  /** Textura frontal (null en formas grises o si no hay draft). */
  front: FrontProjection | null;
}

/** Asad y Yara: mismo arquetipo, cambian medidas, materiales y textura. */
export function LatheBottle({ shape, m, front }: Props) {
  const geo = useMemo(() => buildLatheShoulder(shape), [shape]);
  const textured = useMemo(() => {
    if (!front) return null;
    const arc = (shape.textureArcDeg * Math.PI) / 180;
    const fade = arc * 0.35;
    return {
      body: fadeLatheEdges(
        projectFront(geo.bodySkin.clone(), front),
        arc,
        fade,
      ),
      cap: fadeLatheEdges(projectFront(geo.capSkin.clone(), front), arc, fade),
      medallion: geo.medallion
        ? projectFront(geo.medallion.clone(), front)
        : null,
    };
  }, [geo, front, shape.textureArcDeg]);

  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g?.dispose();
      for (const g of Object.values(textured ?? {})) g?.dispose();
    },
    [geo, textured],
  );

  return (
    <>
      <mesh geometry={geo.body}>
        <PbrMaterial config={m.body} />
      </mesh>
      <mesh geometry={geo.neck}>
        <PbrMaterial config={m.accent} />
      </mesh>
      <mesh geometry={geo.cap}>
        <PbrMaterial config={m.cap} />
      </mesh>
      {geo.bodyRing && (
        <mesh geometry={geo.bodyRing}>
          <PbrMaterial config={m.accent} />
        </mesh>
      )}
      {geo.capRim && (
        <mesh geometry={geo.capRim}>
          <PbrMaterial config={m.accent} />
        </mesh>
      )}
      {textured && front ? (
        <>
          <mesh geometry={textured.body}>
            <DraftMaterial src={front.src} config={m.body} fadeEdges />
          </mesh>
          <mesh geometry={textured.cap}>
            <DraftMaterial src={front.src} config={m.cap} fadeEdges />
          </mesh>
          {textured.medallion && (
            <mesh geometry={textured.medallion}>
              <DraftMaterial src={front.src} config={m.accent} />
            </mesh>
          )}
        </>
      ) : (
        geo.medallion && (
          <mesh geometry={geo.medallion}>
            <PbrMaterial config={m.accent} />
          </mesh>
        )
      )}
    </>
  );
}
