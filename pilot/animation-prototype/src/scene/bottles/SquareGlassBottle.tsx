import { useTexture } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import {
  DataTexture,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MaterialConfig, ShapeOf } from '../../products/schema';
import { PbrMaterial, type BottleMaterials } from '../materials';
import { mapPlaneToQuad } from '../projection';

type Shape = ShapeOf<'square-glass'>;

export function squareGlassSize(s: Shape) {
  return {
    heightMm: s.body.heightMm + s.cap.heightMm,
    /** Anchura máxima durante el giro: la diagonal de la planta cuadrada. */
    widthMm: Math.SQRT2 * Math.max(s.body.widthMm, s.cap.widthMm),
    depthMm: Math.max(s.body.widthMm, s.cap.widthMm),
  };
}

/**
 * Normal map PROVISIONAL de estrías en espiga (chevron), generado en código.
 * Solo aproxima el relieve del draft; la versión final saldrá de fotos del kit.
 */
function makeFlutesNormalMap(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const k = 2 * Math.PI * 6; // 6 estrías por tesela
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const side = u < 0.5 ? -1 : 1;
      const phase = k * (Math.abs(u - 0.5) + v);
      // Derivadas de h = sin(phase): perfil ondulado a 45° reflejado en el centro.
      const d = Math.cos(phase);
      const nx = -d * side;
      const ny = -d;
      const len = Math.hypot(nx, ny, 1.6);
      const i = (y * size + x) * 4;
      data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1.6 / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function GlassMaterial({
  config,
  flutes,
  normalMap,
}: {
  config: MaterialConfig;
  flutes: Shape['flutes'];
  normalMap: DataTexture | null;
}) {
  const scale = useMemo(() => new Vector2(flutes?.strength ?? 0, flutes?.strength ?? 0), [flutes]);
  return (
    <meshPhysicalMaterial
      color={config.color}
      roughness={config.roughness}
      metalness={config.metalness}
      transmission={config.transmission ?? 1}
      ior={config.ior ?? 1.5}
      thickness={config.thicknessMm ?? 10}
      clearcoat={config.clearcoat ?? 0}
      normalMap={normalMap}
      normalScale={scale}
      specularIntensity={1}
      envMapIntensity={1.4}
      attenuationColor="#f3ead8"
      attenuationDistance={120}
    />
  );
}

function PlateTexture({
  src,
  config,
}: {
  src: string;
  config: MaterialConfig;
}) {
  const tex = useTexture(src);
  useLayoutEffect(() => {
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex]);
  return (
    <meshStandardMaterial
      map={tex}
      roughness={config.roughness}
      metalness={0.25}
      polygonOffset
      polygonOffsetFactor={-1}
    />
  );
}

interface Props {
  shape: Shape;
  m: BottleMaterials;
  grey: boolean;
}

/** Khamrah: vidrio cuadrado (transmission), líquido ámbar interior y placa dorada frontal. */
export function SquareGlassBottle({ shape: s, m, grey }: Props) {
  const geo = useMemo(() => {
    const b = s.body;
    const body = new RoundedBoxGeometry(b.widthMm, b.heightMm, b.widthMm, 4, b.bevelMm);
    body.translate(0, b.heightMm / 2, 0);
    const innerW = b.widthMm - 2 * b.wallMm;
    const innerH = (b.heightMm - b.baseMm - b.wallMm) * s.liquidFill;
    const liquid = new RoundedBoxGeometry(innerW, innerH, innerW, 3, Math.min(3, b.bevelMm));
    liquid.translate(0, b.baseMm + innerH / 2, 0);
    const c = s.cap;
    const cap = new RoundedBoxGeometry(c.widthMm, c.heightMm, c.widthMm, 4, c.bevelMm);
    cap.translate(0, b.heightMm + c.heightMm / 2, 0);
    const p = s.plate;
    const plateZ = b.widthMm / 2 + p.thicknessMm / 2;
    const plate = new RoundedBoxGeometry(p.widthMm, p.heightMm, p.thicknessMm, 2, 0.4);
    plate.translate(0, p.centerFromBaseMm, plateZ);
    const plateFront = s.plateTexture
      ? mapPlaneToQuad(
          new PlaneGeometry(1, 1),
          s.plateTexture.quadPx,
          s.plateTexture.widthPx,
          s.plateTexture.heightPx,
        )
      : null;
    plateFront?.scale(p.widthMm - 0.8, p.heightMm - 0.8, 1);
    plateFront?.translate(0, p.centerFromBaseMm, plateZ + p.thicknessMm / 2 + 0.05);
    return { body, liquid, cap, plate, plateFront };
  }, [s]);

  const normalMap = useMemo(() => (s.flutes ? makeFlutesNormalMap() : null), [s.flutes]);
  useLayoutEffect(() => {
    normalMap?.repeat.set(s.flutes?.repeat ?? 1, s.flutes?.repeat ?? 1);
  }, [normalMap, s.flutes]);

  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g?.dispose();
      normalMap?.dispose();
    },
    [geo, normalMap],
  );

  if (grey) {
    // Formas grises: sin vidrio ni texturas, solo volumen (el líquido no se ve).
    return (
      <>
        <mesh geometry={geo.body}>
          <PbrMaterial config={m.body} />
        </mesh>
        <mesh geometry={geo.cap}>
          <PbrMaterial config={m.cap} />
        </mesh>
        <mesh geometry={geo.plate}>
          <PbrMaterial config={m.accent} />
        </mesh>
      </>
    );
  }

  return (
    <>
      {m.liquid && (
        <mesh geometry={geo.liquid}>
          <PbrMaterial config={m.liquid} />
        </mesh>
      )}
      <mesh geometry={geo.body}>
        <GlassMaterial config={m.body} flutes={s.flutes} normalMap={normalMap} />
      </mesh>
      <mesh geometry={geo.cap}>
        <GlassMaterial config={m.cap} flutes={s.flutes} normalMap={normalMap} />
      </mesh>
      <mesh geometry={geo.plate}>
        <PbrMaterial config={m.accent} />
      </mesh>
      {geo.plateFront && s.plateTexture && (
        <mesh geometry={geo.plateFront}>
          <PlateTexture src={s.plateTexture.src} config={m.accent} />
        </mesh>
      )}
    </>
  );
}
