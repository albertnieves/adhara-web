import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { MeshStandardMaterial, SRGBColorSpace, type Group, type Texture } from 'three';
import { sample, type Timeline } from '../motion/timeline';
import { BOX_FACES, type BoxConfig, type BoxFace } from '../products/schema';
import { makeFaceTemplate } from './boxTemplates';
import type { ProductDims } from './dims';

type FaceTextures = Partial<Record<BoxFace, Texture>>;
type V3 = [number, number, number];

interface Props {
  box: BoxConfig;
  dims: ProductDims;
  timeline: Timeline;
  /** Formas grises: sin imágenes ni plantillas. */
  grey: boolean;
  greyColor: string;
  /** Muestra plantillas rotuladas en las caras que aún no tienen foto. */
  templates: boolean;
}

/**
 * Caja procedural: fondo + 4 paredes (abierta por arriba) y una solapa superior
 * con bisagra en el canto trasero (grupo pivotado). Cada cara exterior lleva su
 * imagen (foto del kit) o, si falta, el color del cartón o una plantilla.
 */
export function Box(props: Props) {
  const hasPhotos = !props.grey && Object.keys(props.box.faces).length > 0;
  return hasPhotos ? <BoxWithPhotos {...props} /> : <BoxMesh {...props} photos={{}} />;
}

/** Carga las fotos de las caras (Suspense) y las pasa a la malla. */
function BoxWithPhotos(props: Props) {
  const urls = useMemo(() => {
    const out: Partial<Record<BoxFace, string>> = {};
    for (const f of BOX_FACES) {
      const img = props.box.faces[f];
      if (img) out[f] = img.src;
    }
    return out as Record<string, string>;
  }, [props.box.faces]);
  const photos = useTexture(urls) as FaceTextures;
  useLayoutEffect(() => {
    for (const t of Object.values(photos)) {
      if (!t) continue;
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
    }
  }, [photos]);
  return <BoxMesh {...props} photos={photos} />;
}

function BoxMesh({
  box,
  dims,
  timeline,
  grey,
  greyColor,
  templates,
  photos,
}: Props & { photos: FaceTextures }) {
  const root = useRef<Group>(null);
  const flap = useRef<Group>(null);
  const { width: W, height: H, depth: D } = dims.box;
  const t = dims.wall;

  // Un material por cara con imagen + uno para el cartón y otro para el interior.
  const mats = useMemo(() => {
    const plain = (color: string) =>
      new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
    const base = plain(grey ? greyColor : box.color);
    const insidePlain = plain(grey ? greyColor : box.insideColor);
    const sizes: Record<BoxFace, [number, number]> = {
      front: [box.widthMm, box.heightMm],
      back: [box.widthMm, box.heightMm],
      left: [box.depthMm, box.heightMm],
      right: [box.depthMm, box.heightMm],
      top: [box.widthMm, box.depthMm],
      bottom: [box.widthMm, box.depthMm],
      inside: [box.widthMm, box.heightMm],
    };
    const face = {} as Record<BoxFace, MeshStandardMaterial>;
    const owned: MeshStandardMaterial[] = [base, insidePlain];
    for (const f of BOX_FACES) {
      const photo = grey ? undefined : photos[f];
      const tex = photo ?? (!grey && templates ? makeFaceTemplate(f, ...sizes[f]) : undefined);
      if (tex) {
        const m = new MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 });
        face[f] = m;
        owned.push(m);
      } else {
        face[f] = f === 'inside' ? insidePlain : base;
      }
    }
    return { base, face, owned };
  }, [box, grey, greyColor, templates, photos]);

  useEffect(
    () => () => {
      for (const m of mats.owned) {
        // Las plantillas son CanvasTexture propias; las fotos las gestiona la caché de drei.
        if (m.map && !Object.values(photos).includes(m.map)) m.map.dispose();
        m.dispose();
      }
    },
    [mats, photos],
  );

  useFrame(() => {
    const s = sample(timeline.spec, timeline.t);
    if (root.current) {
      root.current.position.y = -s.boxDrop * timeline.spec.s2Rise.boxDrop * H;
      root.current.visible = s.boxOpacity > 0.002;
    }
    if (flap.current) flap.current.rotation.x = s.flapAngle;
    // El fundido es uno solo para todas las caras.
    const fading = s.boxOpacity < 0.999;
    for (const m of mats.owned) {
      m.opacity = s.boxOpacity;
      if (m.transparent !== fading) {
        m.transparent = fading;
        m.depthWrite = !fading;
        m.needsUpdate = true;
      }
    }
  });

  const { base, face } = mats;
  const inside = face.inside;
  // Orden de materiales de BoxGeometry: +x, -x, +y, -y, +z, -z.
  const panel = (size: V3, pos: V3, materials: MeshStandardMaterial[]) => (
    <mesh position={pos} material={materials} castShadow>
      <boxGeometry args={size} />
    </mesh>
  );

  return (
    <group ref={root} name="box">
      {/* Fondo: base por fuera (-y), interior por dentro (+y). */}
      {panel([W, t, D], [0, t / 2, 0], [base, base, inside, face.bottom, base, base])}
      {/* Frontal (+z) y trasera (-z). */}
      {panel([W, H, t], [0, H / 2, D / 2 - t / 2], [base, base, base, base, face.front, inside])}
      {panel([W, H, t], [0, H / 2, -D / 2 + t / 2], [base, base, base, base, inside, face.back])}
      {/* Laterales: izquierdo (-x) y derecho (+x) mirando la frontal. */}
      {panel([t, H, D - 2 * t], [-W / 2 + t / 2, H / 2, 0], [inside, face.left, base, base, base, base])}
      {panel([t, H, D - 2 * t], [W / 2 - t / 2, H / 2, 0], [face.right, inside, base, base, base, base])}
      <group ref={flap} position={[0, H, -D / 2]}>
        {/* Solapa: tapa por fuera (+y), interior por dentro (-y). */}
        {panel([W, t, D], [0, t / 2, D / 2], [base, base, face.top, inside, base, base])}
        {/* Lengüeta que se mete por dentro de la pared frontal. */}
        {panel([W - 3 * t, D * 0.16, t], [0, -D * 0.08 + t, D - 2 * t], [
          inside,
          inside,
          inside,
          inside,
          inside,
          inside,
        ])}
      </group>
    </group>
  );
}
